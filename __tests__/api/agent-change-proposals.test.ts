/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/agent/change-proposals/route';
import {
  ChangeProposalService,
  ProposalItemValidationError,
  GeodataImmutabilityError,
} from '@/services/change-proposals';
import { recordCrawlRun } from '@/services/crawl-runs';
import { updateShopLearnedConfig } from '@/services/shop-agent-configs';

jest.mock('@/services/change-proposals', () => {
  const actual = jest.requireActual('@/services/change-proposals');
  return {
    ...actual,
    ChangeProposalService: {
      createProposalFromItems: jest.fn(),
    },
  };
});

jest.mock('@/services/crawl-runs', () => ({
  recordCrawlRun: jest.fn().mockResolvedValue({ id: 'crawl-run-1' }),
}));

jest.mock('@/services/shop-agent-configs', () => ({
  extractLearnedAgentConfig: jest.requireActual('@/services/shop-agent-configs').extractLearnedAgentConfig,
  updateShopLearnedConfig: jest.fn().mockResolvedValue({}),
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
      body: JSON.stringify({ shopId: 'shop-1', sourceUrl: 'https://example.com', items: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('validates required fields and returns 400 when shopId, sourceUrl, or items array is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ shopId: 'shop-1', sourceUrl: 'https://example.com' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/items must be an array/i);
  });

  it('stages explicit agent-authored Change Proposal Items and returns 201', async () => {
    (ChangeProposalService.createProposalFromItems as jest.Mock).mockResolvedValue({
      proposal: { id: 'prop-123', status: 'pending' },
      summaryCounts: { add: 1, update: 1, delist: 0, unchanged: 1 },
      itemsCount: 3,
    });

    const submittedItems = [
      {
        entityType: 'motorcycle',
        action: 'add',
        brandName: 'Honda',
        modelName: 'PCX 160',
        proposedData: { year: 2024, rates: [{ minDays: 1, ratePerDay: 15, currency: 'USD' }] },
      },
      {
        entityType: 'motorcycle',
        action: 'update',
        entityId: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
        brandName: 'Yamaha',
        modelName: 'QBIX',
        originalData: { brand: 'Honda', modelName: 'QBIX', rates: [{ minDays: 1, ratePerDay: 17, currency: 'USD' }] },
        proposedData: { brand: 'Yamaha', modelName: 'QBIX', rates: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }] },
        diffSummary: { brand: { old: 'Honda', new: 'Yamaha' } },
      },
      {
        entityType: 'motorcycle',
        action: 'unchanged',
        entityId: 'bike-unchanged-1',
        brandName: 'Honda',
        modelName: 'Click 125',
        proposedData: { year: 2023, rates: [{ minDays: 1, ratePerDay: 10, currency: 'USD' }] },
      },
    ];

    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        shopId: 'shop-123',
        sourceUrl: 'https://example.com/fleet',
        agentRunId: 'run-abc',
        items: submittedItems,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      proposalId: 'prop-123',
      summaryCounts: { add: 1, update: 1, delist: 0, unchanged: 1 },
      itemsCount: 3,
    });
    expect(ChangeProposalService.createProposalFromItems).toHaveBeenCalledWith({
      shopId: 'shop-123',
      sourceUrl: 'https://example.com/fleet',
      agentRunId: 'run-abc',
      items: submittedItems,
    });
    expect(recordCrawlRun).toHaveBeenCalledWith({
      shopId: 'shop-123',
      status: 'success',
      proposalId: 'prop-123',
      agentRunId: 'run-abc',
      metadata: { itemsCount: 3 },
    });
  });

  it('persists learned extraction hints and discovered source URL when provided in Change Proposal payload', async () => {
    (ChangeProposalService.createProposalFromItems as jest.Mock).mockResolvedValue({
      proposal: { id: 'prop-456', status: 'pending' },
      summaryCounts: { add: 1, update: 0, delist: 0, unchanged: 0 },
      itemsCount: 1,
    });

    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        shopId: 'shop-456',
        sourceUrl: 'https://example.com/bikes',
        items: [{ action: 'add', brandName: 'Yamaha', modelName: 'NMAX' }],
        learnedExtractionHints: 'Rates in EUR on /rentals. 2 helmets included.',
        discoveredSourceUrl: 'https://example.com/rentals/motorcycles',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(updateShopLearnedConfig).toHaveBeenCalledWith(
      'shop-456',
      {
        extractionHints: 'Rates in EUR on /rentals. 2 helmets included.',
        discoveredSourceUrl: 'https://example.com/rentals/motorcycles',
      }
    );
  });

  it('returns 400 when ProposalItemValidationError or GeodataImmutabilityError is thrown', async () => {
    (ChangeProposalService.createProposalFromItems as jest.Mock).mockRejectedValueOnce(
      new ProposalItemValidationError("Item at index 0 with action 'update' requires a non-empty entityId.")
    );

    const request1 = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        shopId: 'shop-123',
        sourceUrl: 'https://example.com/',
        items: [{ action: 'update', brandName: 'Yamaha', modelName: 'QBIX' }],
      }),
    });

    const response1 = await POST(request1);
    expect(response1.status).toBe(400);
    expect(await response1.json()).toEqual({
      error: "Item at index 0 with action 'update' requires a non-empty entityId.",
    });

    (ChangeProposalService.createProposalFromItems as jest.Mock).mockRejectedValueOnce(
      new GeodataImmutabilityError('place_id')
    );

    const request2 = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        shopId: 'shop-123',
        sourceUrl: 'https://example.com/',
        items: [
          {
            entityType: 'rental_shop',
            action: 'update',
            entityId: 'shop-123',
            proposedData: { place_id: 'ChIJ-forbidden' },
          },
        ],
      }),
    });

    const response2 = await POST(request2);
    expect(response2.status).toBe(400);
    expect((await response2.json()).error).toMatch(/Forbidden geodata mutation/i);
  });

  it('returns 500 with error details and does not record a success crawl run when staging fails', async () => {
    (ChangeProposalService.createProposalFromItems as jest.Mock).mockRejectedValue(
      new Error('Failed to stage change proposal items: database connection error')
    );

    const request = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-agent-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        shopId: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
        sourceUrl: 'https://wescooterrentalsiemreap.com/',
        agentRunId: 'hermes-we-scooter-run',
        items: [{ action: 'add', brandName: 'Honda', modelName: 'PCX' }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Internal server error staging proposal',
      details: 'Failed to stage change proposal items: database connection error',
    });
    expect(recordCrawlRun).not.toHaveBeenCalled();
  });
});
