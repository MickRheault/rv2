export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { openAITools, executeTool, formatToolResultForLLM } from '@/lib/mcp/tools';
import {
    CHAT_RATE_LIMIT_MAX_REQUESTS,
    CHAT_RATE_LIMIT_WINDOW_MS,
    CHAT_REDIRECT_MESSAGE,
    MAX_MESSAGE_LENGTH,
    MAX_OUTPUT_TOKENS,
    MAX_TOOL_ITERATIONS,
    MAX_TOTAL_TOOL_CALLS,
    SYSTEM_PROMPT,
    isRepetitionOrPaddingPrompt,
    sanitizeConversationHistory,
} from '@/lib/chat/prompt';
import { getRateLimitHeaders, rateLimit } from '@/lib/api/rate-limit';
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

        if (message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
                { status: 400 }
            );
        }

        const rateLimitResult = rateLimit(
            request,
            CHAT_RATE_LIMIT_MAX_REQUESTS,
            CHAT_RATE_LIMIT_WINDOW_MS
        );
        if (!rateLimitResult.allowed) {
            const retryAfterSeconds = Math.max(
                1,
                Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            );
            return NextResponse.json(
                { error: 'Too many chat requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        ...getRateLimitHeaders(
                            rateLimitResult.remaining,
                            rateLimitResult.resetAt,
                            CHAT_RATE_LIMIT_MAX_REQUESTS
                        ),
                        'Retry-After': String(retryAfterSeconds),
                    },
                }
            );
        }

        if (isRepetitionOrPaddingPrompt(message)) {
            return NextResponse.json({
                response: CHAT_REDIRECT_MESSAGE,
            });
        }

        const sanitizedHistory = sanitizeConversationHistory(conversationHistory);

        // Build messages array
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...sanitizedHistory,
            { role: 'user', content: message },
        ];

        // Call OpenAI with tools
        let response = await getOpenAI().chat.completions.create({
            model: 'gpt-4.1-mini',
            messages,
            tools: openAITools,
            tool_choice: 'auto',
            max_completion_tokens: MAX_OUTPUT_TOKENS,
        });

        let assistantMessage = response.choices[0].message;
        const toolCalls: { name: string; args: string; result: string }[] = [];
        let toolIterations = 0;

        // Handle tool calls (loop for multi-step reasoning, bounded by iteration & call limits)
        while (
            assistantMessage.tool_calls &&
            assistantMessage.tool_calls.length > 0 &&
            toolIterations < MAX_TOOL_ITERATIONS &&
            toolCalls.length < MAX_TOTAL_TOOL_CALLS
        ) {
            toolIterations++;
            const remainingToolBudget = MAX_TOTAL_TOOL_CALLS - toolCalls.length;
            const allowedToolCalls = assistantMessage.tool_calls.slice(0, remainingToolBudget);

            // Add assistant message with only the allowed tool calls
            messages.push({
                ...assistantMessage,
                tool_calls: allowedToolCalls,
            });

            // Execute each allowed tool call
            for (const toolCall of allowedToolCalls) {
                // Only handle function-type tool calls
                if (toolCall.type !== 'function') continue;

                const toolName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);

                console.log('Executing tool:', toolCall.function.name, {
                    question: message,
                    args: args,
                });

                // Execute the tool (calls services directly)
                const result = await executeTool(toolName, args);
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

            const reachedToolCap =
                toolIterations >= MAX_TOOL_ITERATIONS ||
                toolCalls.length >= MAX_TOTAL_TOOL_CALLS;

            // Get next response from OpenAI
            response = await getOpenAI().chat.completions.create({
                model: 'gpt-4.1-mini',
                messages,
                tools: openAITools,
                tool_choice: reachedToolCap ? 'none' : 'auto',
                max_completion_tokens: MAX_OUTPUT_TOKENS,
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
