export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { openAITools, executeTool, formatToolResultForLLM } from '@/lib/mcp/tools';
import { timingSafeEqual } from 'node:crypto';

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

const SYSTEM_PROMPT = `You are a helpful assistant for Global Moto Rentals, a motorcycle rental platform across Southeast Asia.

You help users find motorcycles, compare rental shops, and get location info.

RESPONSE FORMAT:
- Use **bold** for model names and important details
- Always include markdown links: [Model Name](url) for motorcycles, [Shop Name](url) for shops
- Format prices as: ฿{price}/day or \${price}/day (if no price, say "Price on request")
- ALWAYS include the shop name for each motorcycle

MOTORCYCLE EXAMPLE:
1. **[Honda PCX 160](/motorcycle/abc123)** - ฿350/day
   - Shop: [Mike's Rentals](/shop/thailand/bangkok/mikes-rentals) ⭐ 4.8 • Bangkok

SHOP EXAMPLE:
1. **[BigBike Rentals](/shop/thailand/phuket/bigbike-rentals)** ⭐ 4.9
   - 15 motorcycles available • Phuket

IMPORTANT: Every motorcycle MUST show which shop it's from with a link.
If no results found, suggest alternatives (different city, category, or price range).`;


export async function POST(request: NextRequest) {
    const accessSecret = process.env.AI_CHAT_ACCESS_SECRET;
    if (!accessSecret || !accessSecret.trim()) {
        return NextResponse.json(
            { error: 'Chat access is not configured' },
            { status: 503 }
        );
    }

    const authorization = request.headers.get('authorization');
    const suppliedSecret = authorization?.match(/^Bearer (.+)$/i)?.[1] ?? '';
    const expected = Buffer.from(accessSecret);
    const supplied = Buffer.from(suppliedSecret);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        return NextResponse.json(
            { error: 'Access denied' },
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
            { role: 'system', content: SYSTEM_PROMPT },
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

        // Handle tool calls (loop for multi-step reasoning)
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            // Add assistant message with tool calls
            messages.push(assistantMessage);

            // Execute each tool call
            for (const toolCall of assistantMessage.tool_calls) {
                // Only handle function-type tool calls
                if (toolCall.type !== 'function') continue;

                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);

                console.log(`Executing tool: ${toolName}`, toolArgs);

                // Execute the tool (calls services directly)
                const result = await executeTool(toolName, toolArgs);
                const resultString = formatToolResultForLLM(result);

                toolCalls.push({
                    name: toolName,
                    args: toolCall.function.arguments,
                    result: resultString,
                });

                // Add tool result to messages
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: resultString,
                });
            }

            // Get next response from OpenAI
            response = await getOpenAI().chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                tools: openAITools,
                tool_choice: 'auto',
            });

            assistantMessage = response.choices[0].message;
        }

        // Return final response
        return NextResponse.json({
            response: assistantMessage.content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });
    } catch (error) {
        console.error('Chat error:', error);

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
