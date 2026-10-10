/**
 * @jest-environment node
 */

import {
  computeShopInventoryDiff,
  ZeroDropSafeguardError,
  type CrawledBikeSnapshot,
  type ExistingBikeRecord,
} from '@/services/diff-engine';

describe('Diff Engine', () => {
  const existingActiveBikes: ExistingBikeRecord[] = [
    {
      id: 'bike-uuid-1',
      brand_name: 'Honda',
      model_name: 'Click 125i',
      year: 2023,
      engine_capacity_cc: 125,
      availability_status: 'available',
      rates: [{ min_days: 1, max_days: 6, rate_per_day: 250 }],
    },
    {
      id: 'bike-uuid-2',
      brand_name: 'Yamaha',
      model_name: 'NMAX 155',
      year: 2024,
      engine_capacity_cc: 155,
      availability_status: 'available',
      rates: [{ min_days: 1, max_days: 6, rate_per_day: 450 }],
    },
  ];

  it('detects new bike additions', () => {
    const crawledBikes: CrawledBikeSnapshot[] = [
      ...existingActiveBikes.map(b => ({
        brand: b.brand_name,
        modelName: b.model_name,
        year: b.year,
        rates: [{ minDays: 1, maxDays: 6, ratePerDay: b.rates[0].rate_per_day }],
      })),
      {
        brand: 'Honda',
        modelName: 'Forza 350',
        year: 2024,
        engineCapacityCc: 330,
        rates: [{ minDays: 1, maxDays: 6, ratePerDay: 700 }],
      },
    ];

    const diff = computeShopInventoryDiff(existingActiveBikes, crawledBikes);

    expect(diff.items).toHaveLength(1);
    expect(diff.items[0].action).toBe('add');
    expect(diff.items[0].model_name).toBe('Forza 350');
    expect(diff.items[0].brand_name).toBe('Honda');
    expect(diff.summaryCounts).toEqual({ add: 1, update: 0, delist: 0 });
  });

  it('detects rate and spec updates on existing bikes using canonical matching', () => {
    const crawledBikes: CrawledBikeSnapshot[] = [
      {
        brand: 'honda', // test case-insensitivity
        modelName: 'click 125i',
        year: 2023,
        engineCapacityCc: 125,
        rates: [{ minDays: 1, maxDays: 6, ratePerDay: 300 }], // Price changed 250 -> 300
      },
      {
        brand: 'Yamaha',
        modelName: 'NMAX 155',
        year: 2024,
        engineCapacityCc: 155,
        rates: [{ minDays: 1, maxDays: 6, ratePerDay: 450 }], // Identical
      },
    ];

    const diff = computeShopInventoryDiff(existingActiveBikes, crawledBikes);

    expect(diff.items).toHaveLength(1);
    expect(diff.items[0].action).toBe('update');
    expect(diff.items[0].entity_id).toBe('bike-uuid-1');
    expect(diff.items[0].diff_summary).toBeDefined();
    expect(diff.summaryCounts).toEqual({ add: 0, update: 1, delist: 0 });
  });

  it('detects missing inventory and flags as soft-delist (availability_status = unavailable)', () => {
    // Only Honda Click observed; Yamaha NMAX missing from crawl
    const crawledBikes: CrawledBikeSnapshot[] = [
      {
        brand: 'Honda',
        modelName: 'Click 125i',
        year: 2023,
        engineCapacityCc: 125,
        rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250 }],
      },
    ];

    const diff = computeShopInventoryDiff(existingActiveBikes, crawledBikes);

    expect(diff.items).toHaveLength(1);
    expect(diff.items[0].action).toBe('delist');
    expect(diff.items[0].entity_id).toBe('bike-uuid-2');
    expect(diff.items[0].model_name).toBe('NMAX 155');
    expect(diff.items[0].proposed_data).toEqual({ availability_status: 'unavailable' });
    expect(diff.summaryCounts).toEqual({ add: 0, update: 0, delist: 1 });
  });

  it('triggers zero-drop safeguard and throws when crawl yields 0 bikes for shop with active inventory', () => {
    const emptyCrawl: CrawledBikeSnapshot[] = [];

    expect(() => {
      computeShopInventoryDiff(existingActiveBikes, emptyCrawl);
    }).toThrow(ZeroDropSafeguardError);
  });

  it('allows 0 bikes without throwing if existing database inventory is also empty', () => {
    const emptyExisting: ExistingBikeRecord[] = [];
    const emptyCrawl: CrawledBikeSnapshot[] = [];

    const diff = computeShopInventoryDiff(emptyExisting, emptyCrawl);
    expect(diff.items).toHaveLength(0);
    expect(diff.summaryCounts).toEqual({ add: 0, update: 0, delist: 0 });
  });
});
