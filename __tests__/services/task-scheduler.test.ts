/**
 * @jest-environment node
 */

import {
  calculateUrgencyScore,
  CADENCE_DAYS,
  TaskSchedulerService,
} from '@/services/task-scheduler';
import {
  isActiveBusinessStatusCode,
  isShopBusinessStatusActive,
} from '@/services/shops';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

describe('TaskSchedulerService', () => {
  describe('calculateUrgencyScore', () => {
    const fixedNow = new Date('2026-10-10T12:00:00Z');

    it('calculates score 1.0 when elapsed time equals tier cadence', () => {
      // Tier 1: 7 days
      const lastRunTier1 = new Date(fixedNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgencyScore(lastRunTier1, lastRunTier1, 1, fixedNow)).toBeCloseTo(1.0, 2);

      // Tier 2: 30 days
      const lastRunTier2 = new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgencyScore(lastRunTier2, lastRunTier2, 2, fixedNow)).toBeCloseTo(1.0, 2);

      // Tier 3: 60 days
      const lastRunTier3 = new Date(fixedNow.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgencyScore(lastRunTier3, lastRunTier3, 3, fixedNow)).toBeCloseTo(1.0, 2);
    });

    it('correctly scales score proportionally to elapsed time', () => {
      // Tier 1: 14 days overdue (2 cycles)
      const lastRun14 = new Date(fixedNow.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgencyScore(lastRun14, lastRun14, 1, fixedNow)).toBeCloseTo(2.0, 2);

      // Tier 1: 3.5 days (half cycle)
      const lastRunHalf = new Date(fixedNow.getTime() - 3.5 * 24 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgencyScore(lastRunHalf, lastRunHalf, 1, fixedNow)).toBeCloseTo(0.5, 2);
    });

    it('prevents starvation by prioritizing severely overdue lower-cadence tiers', () => {
      // Tier 3 (60 days) not crawled in 150 days -> ratio = 2.5
      const tier3LastRun = new Date(fixedNow.getTime() - 150 * 24 * 60 * 60 * 1000).toISOString();
      const tier3Score = calculateUrgencyScore(tier3LastRun, tier3LastRun, 3, fixedNow);

      // Tier 1 (7 days) not crawled in 10 days -> ratio = 1.43
      const tier1LastRun = new Date(fixedNow.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const tier1Score = calculateUrgencyScore(tier1LastRun, tier1LastRun, 1, fixedNow);

      expect(tier3Score).toBeGreaterThan(tier1Score);
      expect(tier3Score).toBeCloseTo(2.5, 1);
      expect(tier1Score).toBeCloseTo(1.43, 2);
    });

    it('handles null last_run_at by treating newly added shops as due', () => {
      const createdAt = new Date(fixedNow.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const score = calculateUrgencyScore(null, createdAt, 1, fixedNow);
      expect(score).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe('sortConfigsByUrgency', () => {
    it('orders configs by urgency score descending', () => {
      const fixedNow = new Date('2026-10-10T12:00:00Z');
      const configs = [
        {
          id: '1',
          tier: 1,
          last_run_at: new Date(fixedNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3/7 = 0.43
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: '2',
          tier: 2,
          last_run_at: new Date(fixedNow.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60/30 = 2.0
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: '3',
          tier: 1,
          last_run_at: new Date(fixedNow.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10/7 = 1.43
          created_at: '2026-01-01T00:00:00Z',
        },
      ];

      const scored = configs.map(c => ({
        ...c,
        urgencyScore: calculateUrgencyScore(c.last_run_at, c.created_at, c.tier, fixedNow),
      })).sort((a, b) => b.urgencyScore - a.urgencyScore);

      expect(scored.map(s => s.id)).toEqual(['2', '3', '1']);
    });
  });

  describe('getDueTasks baseline enrichment and shopId filtering', () => {
    it('returns full existingInventory and currentShop baseline for due tasks and supports filtering by shopId', async () => {
      (getSupabaseAdmin as jest.Mock).mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === 'shop_agent_configs') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'task-cfg-1',
                      shop_id: 'shop-1',
                      tier: 1,
                      source_url: 'https://siemreapscooterrental.com/',
                      extraction_hints: 'Check table rates',
                      is_active: true,
                      last_run_at: '2026-10-01T00:00:00Z',
                      created_at: '2026-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-1',
                        provider_name: 'Siem Reap Scooter Rental',
                        business_description: 'Scooter rentals in Siem Reap',
                        phone: '+855 12 345 678',
                        website: 'https://siemreapscooterrental.com/',
                        business_status_id: 1,
                        business_statuses: {
                          id: 1,
                          status_code: 'OPERATIONAL',
                        },
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
                order: jest.fn().mockResolvedValue({
                  data: [{ name: 'Honda' }, { name: 'Yamaha' }],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'bike-1',
                        shop_id: 'shop-1',
                        model: 'PG-1',
                        year: 2024,
                        year_to: 2026,
                        engine_capacity_cc: 115,
                        availability_status: 'available',
                        source_url: 'https://siemreapscooterrental.com/pg-1',
                        brands: { name: 'Yamaha' },
                        rental_rate_tiers: [
                          { min_days: 1, max_days: 6, rate_per_day: 12, currency: 'USD' },
                        ],
                        motorcycle_conditions: [
                          {
                            condition_type_id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
                            notes: 'USD 100 or Passport',
                            condition_types: {
                              id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
                              name: 'Security Deposit',
                            },
                          },
                        ],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
                      name: 'Security Deposit',
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'rental_shop_inclusions') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: [{ shop_id: 'shop-1', inclusion_text: '2 helmets included' }],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: [{ shop_id: 'shop-1', condition_value: 'Passport or cash deposit' }],
                  error: null,
                }),
              }),
            };
          }
          return {};
        }),
      });

      const tasks = await TaskSchedulerService.getDueTasks({ shopId: 'shop-1' });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].conditionTypes).toEqual([
        {
          id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
          name: 'Security Deposit',
        },
      ]);
      expect(tasks[0].existingInventory).toEqual([
        {
          id: 'bike-1',
          brand: 'Yamaha',
          model: 'PG-1',
          year: 2024,
          year_to: 2026,
          engineCapacityCc: 115,
          availabilityStatus: 'available',
          sourceUrl: 'https://siemreapscooterrental.com/pg-1',
          rates: [{ minDays: 1, maxDays: 6, ratePerDay: 12, currency: 'USD' }],
          conditions: [
            {
              condition_type_id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
              name: 'Security Deposit',
              notes: 'USD 100 or Passport',
            },
          ],
        },
      ]);
      expect(tasks[0].currentShop).toEqual({
        id: 'shop-1',
        providerName: 'Siem Reap Scooter Rental',
        businessDescription: 'Scooter rentals in Siem Reap',
        phone: '+855 12 345 678',
        website: 'https://siemreapscooterrental.com/',
        inclusions: ['2 helmets included'],
        conditions: ['Passport or cash deposit'],
      });
    });

    it('supports all eligible Operational/Active case variants and excludes Inactive, Temporarily Closed, Permanently Closed, and missing statuses in the shared helper', () => {
      for (const eligible of ['OPERATIONAL', 'operational', 'Operational', 'ACTIVE', 'active', 'Active']) {
        expect(isActiveBusinessStatusCode(eligible)).toBe(true);
        expect(
          isShopBusinessStatusActive({
            business_status_id: 1,
            business_statuses: { status_code: eligible },
          })
        ).toBe(true);
      }

      for (const ineligible of [
        'Inactive',
        'inactive',
        'INACTIVE',
        'Temporarily Closed',
        'TEMPORARILY_CLOSED',
        'temporarily_closed',
        'Permanently Closed',
        'PERMANENTLY_CLOSED',
        'permanently_closed',
        'pending',
        '',
        '   ',
        null,
        undefined,
      ]) {
        expect(isActiveBusinessStatusCode(ineligible)).toBe(false);
        expect(
          isShopBusinessStatusActive({
            business_status_id: 2,
            business_statuses: ineligible ? { status_code: ineligible } : null,
          })
        ).toBe(false);
      }

      expect(isShopBusinessStatusActive(null)).toBe(false);
      expect(isShopBusinessStatusActive(undefined)).toBe(false);
      expect(isShopBusinessStatusActive({})).toBe(false);
      expect(isShopBusinessStatusActive({ business_status_id: null, business_statuses: null })).toBe(false);
    });

    it('excludes Mr. Scooter Rentals Bangkok while Inactive for both normal queue and direct shopId requests', async () => {
      const mrScooterShopId = 'cca7fb21-743c-4ba8-beaa-be07ae92ef07';
      (getSupabaseAdmin as jest.Mock).mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === 'shop_agent_configs') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'task-mr-scooter',
                      shop_id: mrScooterShopId,
                      tier: 1,
                      source_url: 'https://mrscooterbangkok.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: null,
                      created_at: '2026-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: mrScooterShopId,
                        provider_name: 'Mr. Scooter Rentals Bangkok',
                        business_description: 'Scooter rental in Bangkok',
                        phone: '+66 81 234 5678',
                        website: 'https://mrscooterbangkok.com/',
                        business_status_id: 2,
                        business_statuses: {
                          id: 2,
                          status_code: 'Inactive',
                        },
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
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
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
      });

      const directTasks = await TaskSchedulerService.getDueTasks({
        shopId: mrScooterShopId,
        limit: 10,
      });
      expect(directTasks).toEqual([]);

      const queueTasks = await TaskSchedulerService.getDueTasks({ limit: 10 });
      expect(queueTasks).toEqual([]);
    });

    it('excludes Inactive, Temporarily Closed, Permanently Closed, and missing-status shops before pagination/limits so excluded shops do not consume queue limits', async () => {
      const mrScooterShopId = 'cca7fb21-743c-4ba8-beaa-be07ae92ef07';
      (getSupabaseAdmin as jest.Mock).mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === 'shop_agent_configs') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'task-inactive',
                      shop_id: mrScooterShopId,
                      tier: 1,
                      source_url: 'https://mrscooterbangkok.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: mrScooterShopId,
                        provider_name: 'Mr. Scooter Rentals Bangkok',
                        business_description: null,
                        phone: null,
                        website: 'https://mrscooterbangkok.com/',
                        business_status_id: 2,
                        business_statuses: { id: 2, status_code: 'Inactive' },
                      },
                    },
                    {
                      id: 'task-temp-closed',
                      shop_id: 'shop-temp-closed',
                      tier: 1,
                      source_url: 'https://tempclosed.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-temp-closed',
                        provider_name: 'Temp Closed Moto',
                        business_description: null,
                        phone: null,
                        website: 'https://tempclosed.example.com/',
                        business_status_id: 3,
                        business_statuses: { id: 3, status_code: 'Temporarily Closed' },
                      },
                    },
                    {
                      id: 'task-perm-closed',
                      shop_id: 'shop-perm-closed',
                      tier: 1,
                      source_url: 'https://permclosed.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-perm-closed',
                        provider_name: 'Perm Closed Moto',
                        business_description: null,
                        phone: null,
                        website: 'https://permclosed.example.com/',
                        business_status_id: 4,
                        business_statuses: { id: 4, status_code: 'Permanently Closed' },
                      },
                    },
                    {
                      id: 'task-missing-status',
                      shop_id: 'shop-missing-status',
                      tier: 1,
                      source_url: 'https://missingstatus.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2025-01-01T00:00:00Z',
                      created_at: '2025-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-missing-status',
                        provider_name: 'Missing Status Moto',
                        business_description: null,
                        phone: null,
                        website: 'https://missingstatus.example.com/',
                        business_status_id: null,
                        business_statuses: null,
                      },
                    },
                    {
                      id: 'task-operational',
                      shop_id: 'shop-operational',
                      tier: 2,
                      source_url: 'https://operational.example.com/',
                      extraction_hints: 'Check table',
                      is_active: true,
                      last_run_at: '2026-08-01T00:00:00Z',
                      created_at: '2026-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-operational',
                        provider_name: 'Operational Bikes',
                        business_description: null,
                        phone: null,
                        website: 'https://operational.example.com/',
                        business_status_id: 1,
                        business_statuses: { id: 1, status_code: 'Operational' },
                      },
                    },
                    {
                      id: 'task-active',
                      shop_id: 'shop-active',
                      tier: 3,
                      source_url: 'https://active.example.com/',
                      extraction_hints: null,
                      is_active: true,
                      last_run_at: '2026-09-01T00:00:00Z',
                      created_at: '2026-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: 'shop-active',
                        provider_name: 'Active Scooters',
                        business_description: null,
                        phone: null,
                        website: 'https://active.example.com/',
                        business_status_id: 5,
                        business_statuses: { id: 5, status_code: 'active' },
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
      });

      const tasks = await TaskSchedulerService.getDueTasks({ limit: 2 });
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.shopId)).toEqual(['shop-operational', 'shop-active']);
    });

    it('automatically makes a shop task eligible again when its status is restored to Operational/Active without recreating config', async () => {
      const mrScooterShopId = 'cca7fb21-743c-4ba8-beaa-be07ae92ef07';
      let currentStatus = 'Inactive';

      (getSupabaseAdmin as jest.Mock).mockImplementation(() => ({
        from: jest.fn((table: string) => {
          if (table === 'shop_agent_configs') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'existing-config-id-1',
                      shop_id: mrScooterShopId,
                      tier: 1,
                      source_url: 'https://mrscooterbangkok.com/rates',
                      extraction_hints: 'Preserved extraction hints',
                      is_active: true,
                      last_run_at: '2026-09-15T00:00:00Z',
                      created_at: '2026-01-01T00:00:00Z',
                      consecutive_errors: 0,
                      rental_shops: {
                        id: mrScooterShopId,
                        provider_name: 'Mr. Scooter Rentals Bangkok',
                        business_description: 'Bangkok scooters',
                        phone: '+66 81 234 5678',
                        website: 'https://mrscooterbangkok.com/',
                        business_status_id: currentStatus === 'Inactive' ? 2 : 1,
                        business_statuses: {
                          id: currentStatus === 'Inactive' ? 2 : 1,
                          status_code: currentStatus,
                        },
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

      // 1. Excluded while Inactive
      const tasksWhileInactive = await TaskSchedulerService.getDueTasks({ shopId: mrScooterShopId });
      expect(tasksWhileInactive).toEqual([]);

      // 2. Restore status to Operational without modifying shop_agent_configs
      currentStatus = 'Operational';
      const tasksAfterRestore = await TaskSchedulerService.getDueTasks({ shopId: mrScooterShopId });
      expect(tasksAfterRestore).toHaveLength(1);
      expect(tasksAfterRestore[0]).toMatchObject({
        taskId: 'existing-config-id-1',
        shopId: mrScooterShopId,
        providerName: 'Mr. Scooter Rentals Bangkok',
        targetUrl: 'https://mrscooterbangkok.com/rates',
        extractionHints: 'Preserved extraction hints',
        tier: 1,
        lastRunAt: '2026-09-15T00:00:00Z',
      });
    });
  });
});

