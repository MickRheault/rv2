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
import { finalizeAssistantResponse } from '@/lib/chat/response';
import {
    buildToolExecutionTrace,
    buildTurnCompletedTrace,
    emitChatTrace,
    sanitizeTraceArgs,
} from '@/lib/chat/trace';
import { getRateLimitHeaders, rateLimit } from '@/lib/api/rate-limit';
import { randomUUID, timingSafeEqual } from 'node:crypto';

interface ExecutedToolCallSummary {
    name: string;
    args: string;
    result: string;
}

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

function createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    toolChoice: 'auto' | 'none' = 'auto'
) {
    return getOpenAI().chat.completions.create({
        model: 'gpt-4.1-mini',
        messages,
        tools: openAITools,
        tool_choice: toolChoice,
        temperature: 0,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
    });
}

function respondWithCompletedTurn(params: {
    requestId: string;
    prompt: string;
    messageCount: number;
    toolCalls: ExecutedToolCallSummary[];
    finishReason: string | null | undefined;
    response: string | null | undefined;
    turnStartedAt: number;
}) {
    const {
        requestId,
        prompt,
        messageCount,
        toolCalls,
        finishReason,
        response,
        turnStartedAt,
    } = params;

    emitChatTrace(
        buildTurnCompletedTrace({
            requestId,
            prompt,
            messageCount,
            toolNames: toolCalls.map(tc => tc.name),
            finishReason,
            response,
            hasError: false,
            durationMs: Date.now() - turnStartedAt,
        })
    );

    return NextResponse.json({
        response,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        requestId,
    });
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

    const requestId = randomUUID();
    const turnStartedAt = Date.now();
    let promptForTrace = '';
    let messageCount = 0;
    const toolCalls: ExecutedToolCallSummary[] = [];

    try {
        const { message, conversationHistory = [] } = await request.json();

        if (!message || typeof message !== 'string' || !message.trim()) {
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

        promptForTrace = message;
        const sanitizedHistory = sanitizeConversationHistory(conversationHistory);
        messageCount = sanitizedHistory.length + 1;

        if (isRepetitionOrPaddingPrompt(message)) {
            return respondWithCompletedTurn({
                requestId,
                prompt: message,
                messageCount,
                toolCalls,
                finishReason: 'redirect',
                response: CHAT_REDIRECT_MESSAGE,
                turnStartedAt,
            });
        }

        // Build messages array
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...sanitizedHistory,
            { role: 'user', content: message },
        ];

        // Call OpenAI with tools
        let response = await createChatCompletion(messages, 'auto');

        let assistantMessage = response.choices[0].message;
        let toolIterations = 0;

        // Handle tool calls (loop for multi-step reasoning, bounded by iteration & call limits)
        while (
            assistantMessage.tool_calls &&
            assistantMessage.tool_calls.length > 0 &&
            toolIterations < MAX_TOOL_ITERATIONS &&
            toolCalls.length < MAX_TOTAL_TOOL_CALLS
        ) {
            const functionToolCalls = assistantMessage.tool_calls.filter(
                (toolCall): toolCall is OpenAI.Chat.ChatCompletionMessageFunctionToolCall =>
                    toolCall.type === 'function'
            );
            if (functionToolCalls.length === 0) break;

            toolIterations++;
            const remainingToolBudget = MAX_TOTAL_TOOL_CALLS - toolCalls.length;
            const allowedToolCalls = functionToolCalls.slice(0, remainingToolBudget);

            // Add assistant message with only the allowed function tool calls
            messages.push({
                ...assistantMessage,
                tool_calls: allowedToolCalls,
            });

            // Execute each allowed tool call
            for (const toolCall of allowedToolCalls) {
                const toolName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                const sanitizedArgs = sanitizeTraceArgs(args);

                console.log('Executing tool:', toolName, {
                    question: message,
                    args: sanitizedArgs,
                });

                // Execute the tool (calls services directly)
                const toolStartedAt = Date.now();
                const result = await executeTool(toolName, args);
                const toolDurationMs = Date.now() - toolStartedAt;
                emitChatTrace(
                    buildToolExecutionTrace({
                        requestId,
                        tool: toolName,
                        args,
                        sanitizedArgs,
                        result,
                        durationMs: toolDurationMs,
                    })
                );
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
            response = await createChatCompletion(
                messages,
                reachedToolCap ? 'none' : 'auto'
            );

            assistantMessage = response.choices[0].message;
        }

        // Return final response
        const finishReason = response.choices[0]?.finish_reason;
        const finalResponse = finalizeAssistantResponse(
            assistantMessage.content,
            finishReason
        );
        return respondWithCompletedTurn({
            requestId,
            prompt: message,
            messageCount,
            toolCalls,
            finishReason,
            response: finalResponse,
            turnStartedAt,
        });
    } catch (error) {
        emitChatTrace(
            buildTurnCompletedTrace({
                requestId,
                prompt: promptForTrace,
                messageCount,
                toolNames: toolCalls.map(tc => tc.name),
                finishReason: 'error',
                response: null,
                hasError: true,
                durationMs: Date.now() - turnStartedAt,
            })
        );

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
