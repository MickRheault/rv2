/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/agent/change-proposals/route';
import { ChangeProposalService } from '@/services/change-proposals';
import { ZeroDropSafeguardError } from '@/services/diff-engine';

import { recordCrawlRun } from '@/services/crawl-runs';

jest.mock('@/services/change-proposals', () => ({
  ChangeProposalService: {
    createProposalFromCrawl: jest.fn(),
  },
}));

jest.mock('@/services/crawl-runs', () => ({
  recordCrawlRun: jest.fn().mockResolvedValue({ id: 'crawl-run-1' }),
}));

describe('POST /api/agent/change-proposals', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGENT_API_KEY: 'secret-agent-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects request without authorization header with 401', async () => {
    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      body: JSON.stringify({ shopId: 'shop-1', sourceUrl: 'https://example.com', bikes: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('validates required fields and returns 400 when missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ shopId: '' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('catches ZeroDropSafeguardError and returns 422', async () => {
    (ChangeProposalService.createProposalFromCrawl as jest.Mock).mockRejectedValue(
      new ZeroDropSafeguardError()
    );

    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        shopId: 'shop-with-bikes',
        sourceUrl: 'https://example.com/rates',
        bikes: [],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toMatch(/Zero-drop safeguard triggered/i);
  });

  it('stages proposal and returns 201 on valid crawl payload', async () => {
    (ChangeProposalService.createProposalFromCrawl as jest.Mock).mockResolvedValue({
      proposal: { id: 'prop-123', status: 'pending' },
      diff: {
        items: [{ action: 'add', model_name: 'PCX' }],
        summaryCounts: { add: 1, update: 0, delist: 0 },
      },
    });

    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        shopId: 'shop-123',
        sourceUrl: 'https://example.com/fleet',
        bikes: [{ brand: 'Honda', modelName: 'PCX' }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.proposalId).toBe('prop-123');
    expect(body.summaryCounts).toEqual({ add: 1, update: 0, delist: 0 });
    expect(recordCrawlRun).toHaveBeenCalledWith({
      shopId: 'shop-123',
      status: 'success',
      proposalId: 'prop-123',
      agentRunId: null,
      metadata: { bikesCount: 1 },
    });
  });
});
