/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/agent/tasks/route';
import { POST } from '@/app/api/agent/tasks/[id]/status/route';
import { TaskSchedulerService } from '@/services/task-scheduler';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

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
      expect(TaskSchedulerService.getDueTasks).toHaveBeenCalledWith({ limit: 5, shopId: undefined });
    });

    it('forwards shopId query parameter to TaskSchedulerService.getDueTasks', async () => {
      (TaskSchedulerService.getDueTasks as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/agent/tasks?shopId=shop-42&limit=1', {
        headers: {
          authorization: 'Bearer valid-agent-key-secret',
        },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      expect(TaskSchedulerService.getDueTasks).toHaveBeenCalledWith({
        limit: 1,
        shopId: 'shop-42',
      });
    });

    it('returns HTTP 200 with count: 0 and tasks: [] for a direct shopId request on an excluded Inactive shop', async () => {
      const inactiveShopId = 'cca7fb21-743c-4ba8-beaa-be07ae92ef07';
      (TaskSchedulerService.getDueTasks as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost:3000/api/agent/tasks?shopId=${inactiveShopId}`,
        {
          headers: {
            authorization: 'Bearer valid-agent-key-secret',
          },
        }
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        success: true,
        count: 0,
        tasks: [],
      });
      expect(TaskSchedulerService.getDueTasks).toHaveBeenCalledWith({
        limit: 10,
        shopId: inactiveShopId,
      });
    });

    it('filters out non-eligible shop statuses end-to-end across queue selection and explicit shopId requests, and restores eligibility when status returns to Operational/Active', async () => {
      const { TaskSchedulerService: ActualScheduler } = jest.requireActual('@/services/task-scheduler');
      (TaskSchedulerService.getDueTasks as jest.Mock).mockImplementation((opts) =>
        ActualScheduler.getDueTasks(opts)
      );

      const mrScooterId = 'cca7fb21-743c-4ba8-beaa-be07ae92ef07';
      let mrScooterStatus = 'Inactive';

      (getSupabaseAdmin as jest.Mock).mockImplementation(() => ({
        from: jest.fn((table: string) => {
          if (table === 'shop_agent_configs') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'task-mr-scooter',
                      shop_id: mrScooterId,
                      tier: 1,
                      source_url: 'https://mrscooterbangkok.com/',
                      extraction_hints: 'Bangkok rates',
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: mrScooterId,
                        provider_name: 'Mr. Scooter Rentals Bangkok',
                        business_description: null,
                        phone: null,
                        website: 'https://mrscooterbangkok.com/',
                        business_status_id: mrScooterStatus === 'Inactive' ? 2 : 1,
                        business_statuses: {
                          id: mrScooterStatus === 'Inactive' ? 2 : 1,
                          status_code: mrScooterStatus,
                        },
                      },
                    },
                    {
                      id: 'task-temp-closed',
                      shop_id: 'shop-temp',
                      tier: 1,
                      source_url: 'https://temp.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-temp',
                        provider_name: 'Temp Closed Shop',
                        business_description: null,
                        phone: null,
                        website: 'https://temp.example.com/',
                        business_status_id: 3,
                        business_statuses: { id: 3, status_code: 'Temporarily Closed' },
                      },
                    },
                    {
                      id: 'task-perm-closed',
                      shop_id: 'shop-perm',
                      tier: 1,
                      source_url: 'https://perm.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-perm',
                        provider_name: 'Perm Closed Shop',
                        business_description: null,
                        phone: null,
                        website: 'https://perm.example.com/',
                        business_status_id: 4,
                        business_statuses: { id: 4, status_code: 'Permanently Closed' },
                      },
                    },
                    {
                      id: 'task-missing',
                      shop_id: 'shop-missing',
                      tier: 1,
                      source_url: 'https://missing.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-missing',
                        provider_name: 'Missing Status Shop',
                        business_description: null,
                        phone: null,
                        website: 'https://missing.example.com/',
                        business_status_id: null,
                        business_statuses: null,
                      },
                    },
                    {
                      id: 'task-active-1',
                      shop_id: 'shop-active-1',
                      tier: 2,
                      source_url: 'https://active1.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2026-08-01T00:00:00Z',
                      created_at: '2026-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-active-1',
                        provider_name: 'Active Shop 1',
                        business_description: null,
                        phone: null,
                        website: 'https://active1.example.com/',
                        business_status_id: 1,
                        business_statuses: { id: 1, status_code: 'OPERATIONAL' },
                      },
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'brands') {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [{ name: 'Honda' }], error: null }),
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          if (table === 'rental_shop_inclusions' || table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          return {};
        }),
      }));

      // 1. Direct shopId request for Mr. Scooter Rentals Bangkok while Inactive -> 200, count: 0, tasks: []
      const directInactiveReq = new NextRequest(
        `http://localhost:3000/api/agent/tasks?shopId=${mrScooterId}`,
        { headers: { authorization: 'Bearer valid-agent-key-secret' } }
      );
      const directInactiveRes = await GET(directInactiveReq);
      expect(directInactiveRes.status).toBe(200);
      expect(await directInactiveRes.json()).toEqual({
        success: true,
        count: 0,
        tasks: [],
      });

      // 2. Normal queue request with limit=1 -> excluded shops do not consume limit or inflate count
      const queueReq = new NextRequest('http://localhost:3000/api/agent/tasks?limit=1', {
        headers: { authorization: 'Bearer valid-agent-key-secret' },
      });
      const queueRes = await GET(queueReq);
      expect(queueRes.status).toBe(200);
      const queueBody = await queueRes.json();
      expect(queueBody.success).toBe(true);
      expect(queueBody.count).toBe(1);
      expect(queueBody.tasks).toHaveLength(1);
      expect(queueBody.tasks[0].shopId).toBe('shop-active-1');

      // 3. Restore Mr. Scooter Rentals Bangkok to Active -> task is eligible again without recreating config
      mrScooterStatus = 'Active';
      const directRestoredReq = new NextRequest(
        `http://localhost:3000/api/agent/tasks?shopId=${mrScooterId}`,
        { headers: { authorization: 'Bearer valid-agent-key-secret' } }
      );
      const directRestoredRes = await GET(directRestoredReq);
      expect(directRestoredRes.status).toBe(200);
      const directRestoredBody = await directRestoredRes.json();
      expect(directRestoredBody.success).toBe(true);
      expect(directRestoredBody.count).toBe(1);
      expect(directRestoredBody.tasks[0]).toMatchObject({
        taskId: 'task-mr-scooter',
        shopId: mrScooterId,
        providerName: 'Mr. Scooter Rentals Bangkok',
        extractionHints: 'Bangkok rates',
      });
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

    it('records learned extraction hints and discovered source URL when provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/agent/tasks/task-123/status', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-agent-key-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'success',
          learnedExtractionHints: 'Rates in THB, deposit 2000 cash',
          discoveredSourceUrl: 'https://shop.com/fleet-rates',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'task-123' }) });
      expect(response.status).toBe(200);
      expect(TaskSchedulerService.updateTaskStatus).toHaveBeenCalledWith(
        'task-123',
        'success',
        undefined,
        {
          extractionHints: 'Rates in THB, deposit 2000 cash',
          discoveredSourceUrl: 'https://shop.com/fleet-rates',
        }
      );
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
