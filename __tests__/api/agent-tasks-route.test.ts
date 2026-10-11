/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/agent/tasks/route';
import { POST } from '@/app/api/agent/tasks/[id]/status/route';
import { TaskSchedulerService } from '@/services/task-scheduler';

jest.mock('@/services/task-scheduler', () => ({
  TaskSchedulerService: {
    getDueTasks: jest.fn(),
    updateTaskStatus: jest.fn(),
  },
}));

jest.mock('@/services/crawl-runs', () => ({
  recordCrawlRun: jest.fn().mockResolvedValue({ id: 'crawl-run-1' }),
}));

import { recordCrawlRun } from '@/services/crawl-runs';

describe('Agent Tasks API Endpoints', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGENT_API_KEY: 'valid-agent-key-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /api/agent/tasks', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/agent/tasks');
      const response = await GET(request);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toMatch(/Unauthorized/i);
    });

    it('returns 401 when Authorization key is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/agent/tasks', {
        headers: {
          authorization: 'Bearer wrong-key',
        },
      });
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('returns 200 with due tasks when valid key provided', async () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          shopId: 'shop-1',
          providerName: 'Motor Shop',
          targetUrl: 'https://example.com/shop',
          extractionHints: 'Check rates page',
          tier: 1,
          urgencyScore: 1.5,
          lastRunAt: '2026-10-01T00:00:00Z',
          canonicalBrands: ['Honda', 'Yamaha'],
          knownModels: [{ brand: 'Honda', modelName: 'PCX 160' }],
        },
      ];
      (TaskSchedulerService.getDueTasks as jest.Mock).mockResolvedValue(mockTasks);

      const request = new NextRequest('http://localhost:3000/api/agent/tasks?limit=5', {
        headers: {
          authorization: 'Bearer valid-agent-key-secret',
        },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.tasks).toEqual(mockTasks);
      expect(TaskSchedulerService.getDueTasks).toHaveBeenCalledWith({ limit: 5 });
    });
  });

  describe('POST /api/agent/tasks/[id]/status', () => {
    it('returns 401 when Authorization header is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/agent/tasks/task-123/status', {
        method: 'POST',
        headers: { authorization: 'Bearer invalid' },
        body: JSON.stringify({ status: 'success' }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'task-123' }) });
      expect(response.status).toBe(401);
    });

    it('records successful crawl and returns 200', async () => {
      (TaskSchedulerService.updateTaskStatus as jest.Mock).mockResolvedValue({
        id: 'task-123',
        shop_id: 'shop-123',
        last_error: null,
        consecutive_errors: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/agent/tasks/task-123/status', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-agent-key-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'success' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'task-123' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(TaskSchedulerService.updateTaskStatus).toHaveBeenCalledWith('task-123', 'success', undefined);
      expect(recordCrawlRun).toHaveBeenCalledWith({
        shopId: 'shop-123',
        status: 'success',
        agentRunId: null,
        errorMessage: null,
        metadata: {},
      });
    });

    it('records failed crawl with error message and returns 200', async () => {
      (TaskSchedulerService.updateTaskStatus as jest.Mock).mockResolvedValue({
        id: 'task-123',
        shop_id: 'shop-123',
        last_error: 'Cloudflare block',
        consecutive_errors: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/agent/tasks/task-123/status', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-agent-key-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'failed', error: 'Cloudflare block' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'task-123' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(TaskSchedulerService.updateTaskStatus).toHaveBeenCalledWith('task-123', 'failed', 'Cloudflare block');
      expect(recordCrawlRun).toHaveBeenCalledWith({
        shopId: 'shop-123',
        status: 'failed',
        agentRunId: null,
        errorMessage: 'Cloudflare block',
        metadata: {},
      });
    });

    it('rejects invalid status payload with 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/agent/tasks/task-123/status', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-agent-key-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'unknown_status' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'task-123' }) });
      expect(response.status).toBe(400);
    });
  });
});
