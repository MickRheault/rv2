/** @jest-environment node */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { POST } from './route';
import { executeTool, formatToolResultForLLM } from '@/lib/mcp/tools';

const mockCreateCompletion = jest.fn();
jest.mock('openai', () => ({
    __esModule: true,
    default: Object.assign(jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreateCompletion } },
    })), { APIError: class APIError extends Error {} }),
}));
jest.mock('@/lib/mcp/tools', () => ({
    openAITools: [],
    executeTool: jest.fn(),
    formatToolResultForLLM: jest.fn(),
}));

const configuredSecret = 'test-only-chat-access-code';
const originalSecret = process.env.AI_CHAT_ACCESS_SECRET;

function request(authorization?: string, message: unknown = 'Find scooters in Bangkok') {
    return new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ message }),
    });
}

beforeEach(() => {
    process.env.AI_CHAT_ACCESS_SECRET = configuredSecret;
    mockCreateCompletion.mockResolvedValue({
        choices: [{ message: { role: 'assistant', content: 'Here are some scooters.' } }],
    });
});

afterAll(() => {
    if (originalSecret === undefined) delete process.env.AI_CHAT_ACCESS_SECRET;
    else process.env.AI_CHAT_ACCESS_SECRET = originalSecret;
});

it.each([undefined, '', '   '])('allows public chat without credentials when the access code is not configured (%s)', async value => {
    if (value === undefined) delete process.env.AI_CHAT_ACCESS_SECRET;
    else process.env.AI_CHAT_ACCESS_SECRET = value;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ response: 'Here are some scooters.' });
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
});

it('ignores old or invalid credentials in public mode', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const response = await POST(request('Bearer old-code'));
    expect(response.status).toBe(200);
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
});

it.each([undefined, '', 123])('validates messages in public mode (%s)', async message => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const req = request();
    jest.spyOn(req, 'json').mockResolvedValue({ message });
    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Message is required' });
    expect(mockCreateCompletion).not.toHaveBeenCalled();
});

it('uses the current access mode when the configuration changes', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    expect((await POST(request())).status).toBe(200);
    process.env.AI_CHAT_ACCESS_SECRET = configuredSecret;
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request(`Bearer ${configuredSecret}`))).status).toBe(200);
    delete process.env.AI_CHAT_ACCESS_SECRET;
    expect((await POST(request())).status).toBe(200);
    expect(mockCreateCompletion).toHaveBeenCalledTimes(3);
});

it('preserves tool execution in public mode', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const toolResult = { success: true, data: { motorcycles: [] } };
    jest.mocked(executeTool).mockResolvedValueOnce(toolResult);
    jest.mocked(formatToolResultForLLM).mockReturnValueOnce('No motorcycles found.');
    mockCreateCompletion.mockResolvedValueOnce({
        choices: [{ message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call-1', type: 'function', function: {
                name: 'search_motorcycles', arguments: '{"city":"Bangkok"}',
            } }],
        } }],
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
        const response = await POST(request());
        expect(response.status).toBe(200);
        expect(executeTool).toHaveBeenCalledWith('search_motorcycles', { city: 'Bangkok' });
        expect(mockCreateCompletion).toHaveBeenCalledTimes(2);
        expect(await response.json()).toEqual({
            response: 'Here are some scooters.',
            toolCalls: [{ name: 'search_motorcycles', args: '{"city":"Bangkok"}', result: 'No motorcycles found.' }],
        });
    } finally {
        log.mockRestore();
    }
});

it.each([undefined, 'Bearer wrong-code', `Basic ${configuredSecret}`, `Bearer ${configuredSecret}extra`])(
    'rejects missing or invalid access before reading the body or calling OpenAI (%s)', async header => {
        const req = request(header);
        const readBody = jest.spyOn(req, 'json');
        const response = await POST(req);
        expect(response.status).toBe(401);
        expect(readBody).not.toHaveBeenCalled();
        expect(OpenAI).not.toHaveBeenCalled();
        expect(mockCreateCompletion).not.toHaveBeenCalled();
        expect(executeTool).not.toHaveBeenCalled();
    }
);

it('preserves the OpenAI chat response for the correct access code', async () => {
    const response = await POST(request(`Bearer ${configuredSecret}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ response: 'Here are some scooters.' });
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
});

it.each(['public', 'restricted'])('returns JSON explaining exhausted OpenAI credits in %s mode', async mode => {
    if (mode === 'public') delete process.env.AI_CHAT_ACCESS_SECRET;
    const error = Object.assign(new OpenAI.APIError(429, undefined, 'No credits remaining', undefined), {
        code: 'credit_balance_exhausted',
        type: 'insufficient_quota',
    });
    mockCreateCompletion.mockRejectedValueOnce(error);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        const response = await POST(request(`Bearer ${configuredSecret}`));
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({
            error: 'The AI assistant is unavailable because its OpenAI API credits are exhausted. Please contact the site owner.',
        });
    } finally {
        log.mockRestore();
    }
});
