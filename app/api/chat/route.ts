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
Use the actual shop name and shopUrl supplied by the motorcycle tool results. Never use a placeholder such as "Shop Name" or invent a shop or URL. If shop information or its URL is unavailable, say so and show any known shop name as plain text.
If no results found, suggest alternatives (different city, category, or price range).`;


export async function POST(request: NextRequest) {
    const accessSecret = process.env.AI_CHAT_ACCESS_SECRET;
    // An absent or blank access secret makes chat public. The provider key stays required.
    if (accessSecret?.trim()) {
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
        if (error instanceof OpenAI.APIError) {
            // Keep provider headers, cookies, and credentials out of runtime logs.
            console.error('Chat AI service error:', { status: error.status, code: error.code, type: error.type });
            if (error.code === 'credit_balance_exhausted') {
                return NextResponse.json(
                    { error: 'The AI assistant is unavailable because its OpenAI API credits are exhausted. Please contact the site owner.' },
                    { status: 503 }
                );
            }
            if (error.type === 'insufficient_quota') {
                return NextResponse.json(
                    { error: 'The AI assistant has reached its OpenAI API billing or usage limit. Please contact the site owner.' },
                    { status: 503 }
                );
            }
            return NextResponse.json(
                { error: 'AI service error. Please try again.' },
                { status: 503 }
            );
        }

        console.error('Chat error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
