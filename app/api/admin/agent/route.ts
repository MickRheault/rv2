export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { openAITools, executeTool, formatToolResultForLLM } from '@/lib/mcp/tools';
import { createClient } from '@/lib/supabase/server';

// Lazy initialization to avoid build-time failure
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openaiClient;
}

const ADMIN_SYSTEM_PROMPT = `You are an admin assistant for Global Moto Rentals platform management.

You help administrators:
- Query and analyze platform data (motorcycles, shops, locations)
- Get insights about rental inventory
- Find data discrepancies or issues

You have access to the same tools as the public chatbot, but you're focused on platform management tasks.

Be precise and data-focused. When presenting data, use structured formats.`;

/**
 * Verify admin authentication using Supabase session
 */
async function verifyAdmin(): Promise<{ authorized: boolean; userId?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return { authorized: false };
        }

        // Check for admin permission using authorize RPC
        const { data: authorized } = await (supabase as unknown as {
            rpc: (fn: string, args: { requested_permission: string }) => Promise<{ data: boolean | null }>
        }).rpc('authorize', { requested_permission: 'system.manage' });

        if (!authorized) {
            return { authorized: false };
        }

        return { authorized: true, userId: user.id };
    } catch {
        return { authorized: false };
    }
}

export async function POST(request: NextRequest) {
    // Verify admin authentication
    const auth = await verifyAdmin();
    if (!auth.authorized) {
        return NextResponse.json(
            { error: 'Unauthorized. Admin access required.' },
            { status: 401 }
        );
    }

    try {
        const { message, conversationHistory = [] } = await request.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // Build messages array
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: ADMIN_SYSTEM_PROMPT },
            ...conversationHistory,
            { role: 'user', content: message },
        ];

        // Call OpenAI with tools
        let response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools: openAITools,
            tool_choice: 'auto',
        });

        let assistantMessage = response.choices[0].message;
        const toolCalls: { name: string; args: string; result: string }[] = [];

        // Handle tool calls
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            messages.push(assistantMessage);

            for (const toolCall of assistantMessage.tool_calls) {
                // Only handle function-type tool calls
                if (toolCall.type !== 'function') continue;

                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);

                console.log(`[Admin] Executing tool: ${toolName}`, toolArgs);

                const result = await executeTool(toolName, toolArgs);
                const resultString = formatToolResultForLLM(result);

                toolCalls.push({
                    name: toolName,
                    args: toolCall.function.arguments,
                    result: resultString,
                });

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: resultString,
                });
            }

            response = await getOpenAI().chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                tools: openAITools,
                tool_choice: 'auto',
            });

            assistantMessage = response.choices[0].message;
        }

        return NextResponse.json({
            response: assistantMessage.content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            adminUserId: auth.userId,
        });
    } catch (error) {
        console.error('Admin agent error:', error);

        if (error instanceof OpenAI.APIError) {
            return NextResponse.json(
                { error: 'AI service error. Please try again.' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
