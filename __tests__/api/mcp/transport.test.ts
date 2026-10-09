/** @jest-environment node */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { NextResponse } from 'next/server';

it('preserves Next.js response compatibility when the MCP transport initializes', async () => {
    const originalRequest = globalThis.Request;
    const originalResponse = globalThis.Response;
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
        expect(globalThis.Request).toBe(originalRequest);
        expect(globalThis.Response).toBe(originalResponse);
        const response = NextResponse.json({ response: 'Chat still works' });
        expect(response).toBeInstanceOf(Response);
        expect(await response.json()).toEqual({ response: 'Chat still works' });
    } finally {
        await transport.close();
    }
});
