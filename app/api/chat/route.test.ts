/** @jest-environment node */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { POST } from './route';

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

function request(authorization?: string) {
    return new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ message: 'Find scooters in Bangkok' }),
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

it.each([undefined, '', '   '])('fails closed when the access code is not configured (%s)', async value => {
    if (value === undefined) delete process.env.AI_CHAT_ACCESS_SECRET;
    else process.env.AI_CHAT_ACCESS_SECRET = value;
    const response = await POST(request(`Bearer ${configuredSecret}`));
    expect(response.status).toBe(503);
    expect(OpenAI).not.toHaveBeenCalled();
    expect(mockCreateCompletion).not.toHaveBeenCalled();
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
    }
);

it('preserves the OpenAI chat response for the correct access code', async () => {
    const response = await POST(request(`Bearer ${configuredSecret}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ response: 'Here are some scooters.' });
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
});

it('returns JSON explaining exhausted OpenAI credits', async () => {
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
