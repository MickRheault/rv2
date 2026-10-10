/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as handleProposalPost } from '@/app/api/agent/change-proposals/route';
import { POST as handleStatusPost } from '@/app/api/agent/tasks/[id]/status/route';
import { ChangeProposalService } from '@/services/change-proposals';
import { TaskSchedulerService } from '@/services/task-scheduler';
import { recordCrawlRun } from '@/services/crawl-runs';

jest.mock('@/services/change-proposals', () => ({
  ChangeProposalService: {
    createProposalFromCrawl: jest.fn(),
  },
}));

jest.mock('@/services/task-scheduler', () => ({
  TaskSchedulerService: {
    updateTaskStatus: jest.fn(),
  },
}));

jest.mock('@/services/crawl-runs', () => ({
  recordCrawlRun: jest.fn(),
}));

describe('Agent Crawl Runs Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGENT_API_KEY: 'test-agent-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Proposal Ingestion creates Crawl Run', () => {
    it('inserts a success crawl_run record when proposal is staged', async () => {
      (ChangeProposalService.createProposalFromCrawl as jest.Mock).mockResolvedValue({
        proposal: { id: 'prop-uuid-999', status: 'pending' },
        diff: {
          items: [{ action: 'add', model_name: 'Forza 350' }],
          summaryCounts: { add: 1, update: 0, delist: 0 },
        },
      });
      (recordCrawlRun as jest.Mock).mockResolvedValue({ id: 'crawl-run-1' });

      const req = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          shopId: 'shop-uuid-1',
          sourceUrl: 'https://rentalshop.com/bikes',
          agentRunId: 'hermes-run-42',
          bikes: [
            { brand: 'Honda', modelName: 'Forza 350' },
            { brand: 'Yamaha', modelName: 'NMAX 155' },
          ],
        }),
      });

      const res = await handleProposalPost(req);
      expect(res.status).toBe(201);

      expect(recordCrawlRun).toHaveBeenCalledTimes(1);
      expect(recordCrawlRun).toHaveBeenCalledWith({
        shopId: 'shop-uuid-1',
        status: 'success',
        proposalId: 'prop-uuid-999',
        agentRunId: 'hermes-run-42',
        metadata: { bikesCount: 2 },
      });
    });
  });

  describe('Task Status Reporting creates Crawl Run', () => {
    it('inserts a failed crawl_run record when external agent reports failure', async () => {
      (TaskSchedulerService.updateTaskStatus as jest.Mock).mockResolvedValue({
        id: 'task-100',
        shop_id: 'shop-uuid-2',
        last_error: 'HTTP 403 Forbidden: Cloudflare protection',
        consecutive_errors: 2,
      });
      (recordCrawlRun as jest.Mock).mockResolvedValue({ id: 'crawl-run-2' });

      const req = new NextRequest('http://localhost:3000/api/agent/tasks/task-100/status', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'failed',
          error: 'HTTP 403 Forbidden: Cloudflare protection',
          agentRunId: 'hermes-run-99',
          metadata: { ipBlocked: true },
        }),
      });

      const res = await handleStatusPost(req, { params: Promise.resolve({ id: 'task-100' }) });
      expect(res.status).toBe(200);

      expect(recordCrawlRun).toHaveBeenCalledTimes(1);
      expect(recordCrawlRun).toHaveBeenCalledWith({
        shopId: 'shop-uuid-2',
        status: 'failed',
        agentRunId: 'hermes-run-99',
        errorMessage: 'HTTP 403 Forbidden: Cloudflare protection',
        metadata: { ipBlocked: true },
      });
    });

    it('inserts a success crawl_run record for clean crawl when external agent reports success with no changes', async () => {
      (TaskSchedulerService.updateTaskStatus as jest.Mock).mockResolvedValue({
        id: 'task-200',
        shop_id: 'shop-uuid-3',
        last_error: null,
        consecutive_errors: 0,
      });

      const req = new NextRequest('http://localhost:3000/api/agent/tasks/task-200/status', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'success',
          agentRunId: 'hermes-run-101',
        }),
      });

      const res = await handleStatusPost(req, { params: Promise.resolve({ id: 'task-200' }) });
      expect(res.status).toBe(200);

      expect(recordCrawlRun).toHaveBeenCalledTimes(1);
      expect(recordCrawlRun).toHaveBeenCalledWith({
        shopId: 'shop-uuid-3',
        status: 'success',
        agentRunId: 'hermes-run-101',
        errorMessage: null,
        metadata: {},
      });
    });

    it('does not insert duplicate crawl_run when external agent reports success with proposalId or proposalCreated', async () => {
      (TaskSchedulerService.updateTaskStatus as jest.Mock).mockResolvedValue({
        id: 'task-200',
        shop_id: 'shop-uuid-3',
        last_error: null,
        consecutive_errors: 0,
      });

      const req = new NextRequest('http://localhost:3000/api/agent/tasks/task-200/status', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'success',
          proposalId: 'prop-uuid-999',
          agentRunId: 'hermes-run-101',
        }),
      });

      const res = await handleStatusPost(req, { params: Promise.resolve({ id: 'task-200' }) });
      expect(res.status).toBe(200);

      expect(recordCrawlRun).not.toHaveBeenCalled();
    });
  });
});
