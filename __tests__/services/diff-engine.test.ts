/**
 * @jest-environment node
 */

import {
  computeShopInventoryDiff,
  normalizeCrawledBikeSnapshot,
  computeRateTiersDiff,
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

  it('detects new bike additions while preserving unchanged bikes', () => {
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

    expect(diff.items).toHaveLength(3);
    const added = diff.items.find(i => i.action === 'add');
    expect(added).toBeDefined();
    expect(added?.model_name).toBe('Forza 350');
    expect(added?.brand_name).toBe('Honda');

    const unchanged = diff.items.filter(i => i.action === 'unchanged');
    expect(unchanged).toHaveLength(2);
    expect(diff.summaryCounts).toEqual({ add: 1, update: 0, delist: 0, unchanged: 2 });
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

    expect(diff.items).toHaveLength(2);
    const updated = diff.items.find(i => i.action === 'update');
    expect(updated).toBeDefined();
    expect(updated?.entity_id).toBe('bike-uuid-1');
    expect(updated?.diff_summary).toBeDefined();

    const unchanged = diff.items.find(i => i.action === 'unchanged');
    expect(unchanged).toBeDefined();
    expect(unchanged?.entity_id).toBe('bike-uuid-2');
    expect(unchanged?.diff_summary).toBeNull();

    expect(diff.summaryCounts).toEqual({ add: 0, update: 1, delist: 0, unchanged: 1 });
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

    expect(diff.items).toHaveLength(2);
    const delisted = diff.items.find(i => i.action === 'delist');
    expect(delisted).toBeDefined();
    expect(delisted?.entity_id).toBe('bike-uuid-2');
    expect(delisted?.model_name).toBe('NMAX 155');
    expect(delisted?.proposed_data).toEqual({ availability_status: 'unavailable' });

    const unchanged = diff.items.find(i => i.action === 'unchanged');
    expect(unchanged).toBeDefined();
    expect(unchanged?.entity_id).toBe('bike-uuid-1');

    expect(diff.summaryCounts).toEqual({ add: 0, update: 0, delist: 1, unchanged: 1 });
  });

  it('emits unchanged action with fully populated original_data and proposed_data for matching bikes', () => {
    const crawledBikes: CrawledBikeSnapshot[] = [
      {
        brand: 'Honda',
        modelName: 'Click 125i',
        year: 2023,
        engineCapacityCc: 125,
        rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250 }],
      },
    ];

    const diff = computeShopInventoryDiff([existingActiveBikes[0]], crawledBikes);

    expect(diff.items).toHaveLength(1);
    const item = diff.items[0];
    expect(item.action).toBe('unchanged');
    expect(item.entity_id).toBe('bike-uuid-1');
    expect(item.brand_name).toBe('Honda');
    expect(item.model_name).toBe('Click 125i');
    expect(item.diff_summary).toBeNull();

    // Verify complete original_data snapshot
    expect(item.original_data).toEqual({
      year: 2023,
      year_to: null,
      engine_capacity_cc: 125,
      availability_status: 'available',
      rates: [{ min_days: 1, max_days: 6, rate_per_day: 250 }],
    });

    // Verify proposed_data snapshot includes availability_status
    expect(item.proposed_data).toEqual({
      ...crawledBikes[0],
      year_to: null,
      availability_status: 'available',
    });

    expect(diff.summaryCounts).toEqual({
      add: 0,
      update: 0,
      delist: 0,
      unchanged: 1,
    });
  });

  it('detects specification update when existing record had null attributes', () => {
    const bikeWithNullYear: ExistingBikeRecord = {
      id: 'bike-null-year',
      brand_name: 'Honda',
      model_name: 'Wave 110i',
      year: null,
      engine_capacity_cc: null,
      availability_status: 'available',
      rates: [{ min_days: 1, max_days: 6, rate_per_day: 180 }],
    };

    const crawledWave: CrawledBikeSnapshot = {
      brand: 'Honda',
      modelName: 'Wave 110i',
      year: 2024,
      engineCapacityCc: 110,
      rates: [{ minDays: 1, maxDays: 6, ratePerDay: 180 }],
    };

    const diff = computeShopInventoryDiff([bikeWithNullYear], [crawledWave]);

    expect(diff.items).toHaveLength(1);
    expect(diff.items[0].action).toBe('update');
    expect(diff.items[0].diff_summary).toEqual({
      year: { old: null, new: 2024 },
      engine_capacity_cc: { old: null, new: 110 },
    });
    expect(diff.summaryCounts).toEqual({
      add: 0,
      update: 1,
      delist: 0,
      unchanged: 0,
    });
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
    expect(diff.summaryCounts).toEqual({ add: 0, update: 0, delist: 0, unchanged: 0 });
  });

  it('detects shop profile modifications (description, phone, website)', () => {
    const existingShop = {
      id: 'shop-uuid-1',
      business_description: 'Old Description',
      phone: '+66 81 111 2222',
      website: 'https://old.example.com',
    };

    const crawledShop = {
      business_description: 'New Description',
      phone: '+66 81 999 8888',
      website: 'https://new.example.com',
    };

    const diff = computeShopInventoryDiff(
      existingActiveBikes,
      existingActiveBikes.map((b) => ({
        brand: b.brand_name,
        modelName: b.model_name,
        rates: [{ minDays: 1, maxDays: 6, ratePerDay: b.rates[0].rate_per_day }],
      })),
      existingShop,
      crawledShop
    );

    const shopItem = diff.items.find((i) => i.entity_type === 'rental_shop');
    expect(shopItem).toBeDefined();
    expect(shopItem?.action).toBe('update');
    expect(shopItem?.diff_summary?.business_description).toEqual({
      old: 'Old Description',
      new: 'New Description',
    });
    expect(shopItem?.diff_summary?.phone).toEqual({
      old: '+66 81 111 2222',
      new: '+66 81 999 8888',
    });
    expect(shopItem?.diff_summary?.website).toEqual({
      old: 'https://old.example.com',
      new: 'https://new.example.com',
    });
  });

  describe('normalizeCrawledBikeSnapshot & Crawler Aliases (Postel\'s Law)', () => {
    it('normalizes dailyRate to ratePerDay, engineCapacity to engineCapacityCc, and modelYear to year', () => {
      const rawBike = {
        brand: 'Honda',
        modelName: 'ADV 160',
        engineCapacity: 157,
        modelYear: 2024,
        rates: [
          {
            minDays: 1,
            dailyRate: 600,
            currency: 'THB',
          },
        ],
      };

      const normalized = normalizeCrawledBikeSnapshot(rawBike);
      expect(normalized.brand).toBe('Honda');
      expect(normalized.modelName).toBe('ADV 160');
      expect(normalized.engineCapacityCc).toBe(157);
      expect(normalized.year).toBe(2024);
      expect(normalized.rates).toEqual([
        {
          minDays: 1,
          maxDays: null,
          ratePerDay: 600,
          currency: 'THB',
        },
      ]);
    });

    it('correctly compares existing inventory against crawler payload containing dailyRate without producing NaN', () => {
      const existingBikes: ExistingBikeRecord[] = [
        {
          id: 'bike-adv-160',
          brand_name: 'Honda',
          model_name: 'ADV 160',
          engine_capacity_cc: 157,
          availability_status: 'available',
          rates: [
            {
              min_days: 1,
              max_days: null,
              rate_per_day: 600,
            },
          ],
        },
      ];

      // Hermes crawl payload with dailyRate and engineCapacity
      const crawledPayload: any[] = [
        {
          brand: 'Honda',
          modelName: 'ADV 160',
          engineCapacity: 157,
          rates: [
            {
              minDays: 1,
              dailyRate: 600,
              currency: 'THB',
            },
          ],
        },
        {
          brand: 'Honda',
          modelName: 'Click 125',
          engineCapacity: 124,
          rates: [
            {
              minDays: 1,
              dailyRate: 350,
              currency: 'THB',
            },
          ],
        },
      ];

      const diff = computeShopInventoryDiff(existingBikes, crawledPayload);

      // Honda ADV 160 should be recognized as UNCHANGED (rates and engine match)
      const adv160 = diff.items.find((i) => i.model_name === 'ADV 160');
      expect(adv160).toBeDefined();
      expect(adv160?.action).toBe('unchanged');
      expect(adv160?.proposed_data.rates[0].ratePerDay).toBe(600);
      expect(adv160?.proposed_data.engineCapacityCc).toBe(157);

      // Honda Click 125 is a new addition
      const click125 = diff.items.find((i) => i.model_name === 'Click 125');
      expect(click125).toBeDefined();
      expect(click125?.action).toBe('add');
      expect(click125?.proposed_data.rates[0].ratePerDay).toBe(350);
      expect(click125?.proposed_data.engineCapacityCc).toBe(124);

      expect(diff.summaryCounts).toEqual({
        add: 1,
        update: 0,
        delist: 0,
        unchanged: 1,
      });
    });
  });

  describe('computeRateTiersDiff & Detailed Rate Diffs', () => {
    it('computes modified rate tiers with delta amounts and percentages', () => {
      const oldRates = [{ min_days: 1, max_days: 6, rate_per_day: 500 }];
      const newRates = [{ minDays: 1, maxDays: 6, ratePerDay: 600, currency: 'THB' }];

      const diffs = computeRateTiersDiff(oldRates, newRates);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        status: 'modified',
        minDays: 1,
        maxDays: 6,
        oldMaxDays: 6,
        oldRate: 500,
        newRate: 600,
        delta: 100,
        percentage: 20,
        currency: 'THB',
      });
    });

    it('identifies added and removed rate tiers when discount tiers change', () => {
      const oldRates = [
        { min_days: 1, max_days: 6, rate_per_day: 500 },
        { min_days: 14, max_days: null, rate_per_day: 350 },
      ];
      const newRates = [
        { minDays: 1, maxDays: 6, ratePerDay: 500, currency: 'THB' }, // Unchanged
        { minDays: 7, maxDays: 13, ratePerDay: 400, currency: 'THB' }, // Added
      ];

      const diffs = computeRateTiersDiff(oldRates, newRates);
      expect(diffs).toHaveLength(3);

      const unchanged = diffs.find((d) => d.status === 'unchanged');
      expect(unchanged).toMatchObject({ minDays: 1, maxDays: 6, newRate: 500 });

      const added = diffs.find((d) => d.status === 'added');
      expect(added).toMatchObject({ minDays: 7, maxDays: 13, newRate: 400 });

      const removed = diffs.find((d) => d.status === 'removed');
      expect(removed).toMatchObject({ minDays: 14, maxDays: null, oldRate: 350 });
    });

    it('flags duration_modified when rate is unchanged but maxDays changes', () => {
      const oldRates = [{ min_days: 1, max_days: 6, rate_per_day: 500 }];
      const newRates = [{ minDays: 1, maxDays: 13, ratePerDay: 500, currency: 'THB' }];

      const diffs = computeRateTiersDiff(oldRates, newRates);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        status: 'duration_modified',
        minDays: 1,
        maxDays: 13,
        oldMaxDays: 6,
        oldRate: 500,
        newRate: 500,
        currency: 'THB',
      });
      // Ensure delta/percentage are undefined so no misleading zero delta is reported
      expect(diffs[0].delta).toBeUndefined();
      expect(diffs[0].percentage).toBeUndefined();
    });
  });

  describe('Shop Inclusions & Conditions Diffing', () => {
    it('detects added and removed shop inclusions and conditions', () => {
      const existingShop = {
        id: 'shop-uuid',
        business_description: 'Moto rentals',
        inclusions: ['Helmets provided', 'Free map'],
        conditions: ['Driver license required', 'Deposit required'],
      };

      const crawledShop = {
        inclusions: ['Helmets provided', 'Basic insurance coverage'], // 'Free map' removed, 'Basic insurance coverage' added
        conditions: ['Driver license required', 'Minimum age 21'], // 'Deposit required' removed, 'Minimum age 21' added
      };

      const diff = computeShopInventoryDiff([], [], existingShop, crawledShop);
      const shopItem = diff.items.find((i) => i.entity_type === 'rental_shop');

      expect(shopItem).toBeDefined();
      expect(shopItem?.diff_summary?.inclusions).toEqual({
        old: ['Helmets provided', 'Free map'],
        new: ['Helmets provided', 'Basic insurance coverage'],
        added: ['Basic insurance coverage'],
        removed: ['Free map'],
      });

      expect(shopItem?.diff_summary?.conditions).toEqual({
        old: ['Driver license required', 'Deposit required'],
        new: ['Driver license required', 'Minimum age 21'],
        added: ['Minimum age 21'],
        removed: ['Deposit required'],
      });
    });

    it('matches bare family names with engine_capacity_cc and punctuation normalization while preserving distinct variants and camelCase businessDescription', () => {
      const existingBikes: ExistingBikeRecord[] = [
        {
          id: 'bike-zoomer',
          brand_name: 'Honda',
          model_name: 'Zoomer-X',
          year: null,
          engine_capacity_cc: 110,
          availability_status: null,
          rates: [{ min_days: 1, max_days: null, rate_per_day: 10 }],
        },
        {
          id: 'bike-pcx',
          brand_name: 'Honda',
          model_name: 'PCX',
          year: null,
          engine_capacity_cc: 150,
          availability_status: null,
          rates: [{ min_days: 1, max_days: null, rate_per_day: 15 }],
        },
        {
          id: 'bike-dream',
          brand_name: 'Honda',
          model_name: 'Dream',
          year: null,
          engine_capacity_cc: 125,
          availability_status: null,
          rates: [{ min_days: 1, max_days: null, rate_per_day: 10 }],
        },
        {
          id: 'bike-scoopy',
          brand_name: 'Honda',
          model_name: 'Scoopy',
          year: null,
          engine_capacity_cc: 110,
          availability_status: null,
          rates: [{ min_days: 1, max_days: null, rate_per_day: 15 }],
        },
        {
          id: 'bike-click',
          brand_name: 'Honda',
          model_name: 'Click',
          year: null,
          engine_capacity_cc: 125,
          availability_status: null,
          rates: [{ min_days: 1, max_days: null, rate_per_day: 10 }],
        },
      ];

      const crawledBikes: any[] = [
        {
          brand: 'Honda',
          modelName: 'Click 125',
          engineCapacity: 125,
          rates: [{ minDays: 1, dailyRate: 11, currency: 'USD' }],
        },
        {
          brand: 'Honda',
          modelName: 'Dream 125',
          engineCapacity: 125,
          rates: [{ minDays: 1, dailyRate: 10, currency: 'USD' }],
        },
        {
          brand: 'Honda',
          modelName: 'ADV 160',
          modelYear: 2026,
          engineCapacity: 160,
          rates: [{ minDays: 1, dailyRate: 45, currency: 'USD' }],
        },
        {
          brand: 'Honda',
          modelName: 'Click 125 Gen 5th',
          engineCapacity: 125,
          rates: [{ minDays: 1, dailyRate: 13, currency: 'USD' }],
        },
        {
          brand: 'Honda',
          modelName: 'PCX',
          rates: [{ minDays: 1, dailyRate: 15, currency: 'USD' }],
        },
        {
          brand: 'Honda',
          modelName: 'Scoopy 110',
          modelYear: 2026,
          engineCapacity: 110,
          rates: [{ minDays: 1, dailyRate: 15, currency: 'USD' }],
        },
        {
          brand: 'Yamaha',
          modelName: 'PG1',
          modelYear: 2026,
          engineCapacity: 115,
          rates: [{ minDays: 1, dailyRate: 18, currency: 'USD' }],
        },
        {
          brand: 'Honda',
          modelName: 'Zoomer X 110',
          engineCapacity: 110,
          rates: [{ minDays: 1, dailyRate: 10, currency: 'USD' }],
        },
      ];

      const existingShop = {
        id: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
        business_description: null,
        inclusions: ['Perfectly maintained scooters', 'Free delivery to accommodation'],
        conditions: [],
      };

      const crawledShop: any = {
        businessDescription:
          'Family-run scooter and motorbike rental business in Siem Reap offering daily, weekly and monthly rentals, free delivery to accommodation and 24-hour service support.',
        inclusions: [
          'Helmets provided',
          'Phone holder provided',
          'Free delivery to accommodation',
          '24-hour service support',
        ],
        conditions: [
          'Rental day is 24 hours',
          '10% off or more advertised for 3-day rentals; contact the shop for the applicable quotation',
        ],
      };

      const diff = computeShopInventoryDiff(existingBikes, crawledBikes, existingShop, crawledShop);

      // Click (125cc) matched Click 125 with 10 -> 11 USD update
      const clickItem = diff.items.find((i) => i.entity_id === 'bike-click');
      expect(clickItem).toBeDefined();
      expect(clickItem?.action).toBe('update');
      expect(clickItem?.diff_summary?.rates?.tiersDiff).toEqual([
        {
          status: 'modified',
          minDays: 1,
          maxDays: null,
          oldMaxDays: null,
          oldRate: 10,
          newRate: 11,
          delta: 1,
          percentage: 10,
          currency: 'USD',
        },
      ]);

      // Scoopy (110cc) matched Scoopy 110 with year null -> 2026 update
      const scoopyItem = diff.items.find((i) => i.entity_id === 'bike-scoopy');
      expect(scoopyItem).toBeDefined();
      expect(scoopyItem?.action).toBe('update');
      expect(scoopyItem?.diff_summary?.year).toEqual({ old: null, new: 2026 });

      // Dream, Zoomer-X, PCX matched as unchanged
      expect(diff.items.find((i) => i.entity_id === 'bike-dream')?.action).toBe('unchanged');
      expect(diff.items.find((i) => i.entity_id === 'bike-zoomer')?.action).toBe('unchanged');
      expect(diff.items.find((i) => i.entity_id === 'bike-pcx')?.action).toBe('unchanged');

      // Click 125 Gen 5th, ADV 160, PG1 are separate additions
      const addedModels = diff.items
        .filter((i) => i.entity_type === 'motorcycle' && i.action === 'add')
        .map((i) => i.model_name);
      expect(addedModels).toEqual(['ADV 160', 'Click 125 Gen 5th', 'PG1']);

      // Zero false delists
      expect(diff.items.filter((i) => i.action === 'delist')).toHaveLength(0);

      // Shop profile update includes normalized business_description
      const shopUpdate = diff.items.find((i) => i.entity_type === 'rental_shop');
      expect(shopUpdate).toBeDefined();
      expect(shopUpdate?.diff_summary?.business_description).toEqual({
        old: null,
        new: crawledShop.businessDescription,
      });

      // Summary counts: 3 add (ADV 160, Click 125 Gen 5th, PG1), 3 update (Click, Scoopy, Shop Profile), 0 delist, 3 unchanged (Dream, Zoomer-X, PCX)
      expect(diff.summaryCounts).toEqual({
        add: 3,
        update: 3,
        delist: 0,
        unchanged: 3,
      });
    });

    it('symmetrically matches a bare crawled model name with explicit engineCapacity against a displacement-suffixed existing listing', () => {
      const existingBikes: ExistingBikeRecord[] = [
        {
          id: 'bike-pcx-150',
          brand_name: 'Honda',
          model_name: 'PCX 150',
          year: null,
          engine_capacity_cc: 150,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: null, rate_per_day: 15 }],
        },
      ];

      const crawledBikes: any[] = [
        {
          brand: 'Honda',
          modelName: 'PCX',
          engineCapacity: 150,
          rates: [{ minDays: 1, dailyRate: 15, currency: 'USD' }],
        },
      ];

      const diff = computeShopInventoryDiff(existingBikes, crawledBikes);
      expect(diff.items).toHaveLength(1);
      expect(diff.items[0].entity_id).toBe('bike-pcx-150');
      expect(diff.items[0].action).toBe('unchanged');
      expect(diff.summaryCounts).toEqual({
        add: 0,
        update: 0,
        delist: 0,
        unchanged: 1,
      });
    });
  });

  describe('Model Year Range Normalization & Two-Pass Generation Matching (#138)', () => {
    it('normalizes explicit year/year_to, yearFrom/yearTo, and "YYYY-YYYY" / "YYYY–YYYY" range strings in normalizeCrawledBikeSnapshot', () => {
      expect(
        normalizeCrawledBikeSnapshot({
          brand: 'Honda',
          modelName: 'Click 125',
          year: '2015-2020',
          rates: [{ minDays: 1, ratePerDay: 200 }],
        })
      ).toMatchObject({
        brand: 'Honda',
        modelName: 'Click 125',
        year: 2015,
        year_to: 2020,
      });

      expect(
        normalizeCrawledBikeSnapshot({
          brand: 'Honda',
          modelName: 'Click 125',
          year: '2021–2024',
          rates: [{ minDays: 1, ratePerDay: 250 }],
        })
      ).toMatchObject({
        brand: 'Honda',
        modelName: 'Click 125',
        year: 2021,
        year_to: 2024,
      });

      expect(
        normalizeCrawledBikeSnapshot({
          brand: 'Honda',
          modelName: 'CB500X',
          yearFrom: 2019,
          yearTo: 2022,
          rates: [{ minDays: 1, ratePerDay: 800 }],
        })
      ).toMatchObject({
        brand: 'Honda',
        modelName: 'CB500X',
        year: 2019,
        year_to: 2022,
      });

      expect(
        normalizeCrawledBikeSnapshot({
          brand: 'Yamaha',
          modelName: 'NMAX 155',
          year_from: 2023,
          year_to: 2023,
          rates: [{ minDays: 1, ratePerDay: 400 }],
        })
      ).toMatchObject({
        brand: 'Yamaha',
        modelName: 'NMAX 155',
        year: 2023,
        year_to: null,
      });
    });

    it('matches multi-generation tiers of the same canonical model in Pass 1 without cross-overwriting or false delisting', () => {
      const existingGenerations: ExistingBikeRecord[] = [
        {
          id: 'click-gen-1',
          brand_name: 'Honda',
          model_name: 'Click 125',
          year: 2015,
          year_to: 2020,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: null, rate_per_day: 200 }],
        },
        {
          id: 'click-gen-2',
          brand_name: 'Honda',
          model_name: 'Click 125',
          year: 2021,
          year_to: 2024,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: null, rate_per_day: 250 }],
        },
      ];

      // Crawl returns generations in reverse order with a rate update on gen 2
      const crawledGenerations: any[] = [
        {
          brand: 'Honda',
          modelName: 'Click 125',
          year: '2021-2024',
          engineCapacityCc: 125,
          rates: [{ minDays: 1, ratePerDay: 270, currency: 'THB' }],
        },
        {
          brand: 'Honda',
          modelName: 'Click 125',
          year: 2015,
          year_to: 2020,
          engineCapacityCc: 125,
          rates: [{ minDays: 1, ratePerDay: 200, currency: 'THB' }],
        },
      ];

      const diff = computeShopInventoryDiff(existingGenerations, crawledGenerations);

      expect(diff.items).toHaveLength(2);
      const gen2Item = diff.items.find((i) => i.entity_id === 'click-gen-2');
      const gen1Item = diff.items.find((i) => i.entity_id === 'click-gen-1');

      expect(gen2Item).toBeDefined();
      expect(gen2Item?.action).toBe('update');
      expect(gen2Item?.diff_summary?.year).toBeUndefined();
      expect(gen2Item?.diff_summary?.rates?.tiersDiff?.[0]).toMatchObject({
        status: 'modified',
        oldRate: 250,
        newRate: 270,
      });

      expect(gen1Item).toBeDefined();
      expect(gen1Item?.action).toBe('unchanged');
      expect(gen1Item?.original_data).toMatchObject({
        year: 2015,
        year_to: 2020,
      });

      expect(diff.summaryCounts).toEqual({
        add: 0,
        update: 1,
        delist: 0,
        unchanged: 1,
      });
    });

    it('falls back to unambiguous model-only matching in Pass 2 and emits formatted diff_summary.year when a single listing updates to a range', () => {
      const existingSingle: ExistingBikeRecord[] = [
        {
          id: 'cb500x-1',
          brand_name: 'Honda',
          model_name: 'CB500X',
          year: 2020,
          year_to: null,
          engine_capacity_cc: 471,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: null, rate_per_day: 800 }],
        },
      ];

      const crawledRange: any[] = [
        {
          brand: 'Honda',
          modelName: 'CB500X',
          year: '2015-2020',
          engineCapacityCc: 471,
          rates: [{ minDays: 1, ratePerDay: 800, currency: 'THB' }],
        },
      ];

      const diff = computeShopInventoryDiff(existingSingle, crawledRange);

      expect(diff.items).toHaveLength(1);
      expect(diff.items[0].entity_id).toBe('cb500x-1');
      expect(diff.items[0].action).toBe('update');
      expect(diff.items[0].diff_summary?.year).toEqual({
        old: '2020',
        new: '2015-2020',
      });
      expect(diff.summaryCounts).toEqual({
        add: 0,
        update: 1,
        delist: 0,
        unchanged: 0,
      });
    });

    it('matches existing generation tier in Pass 1 and stages newly introduced second generation tier as add', () => {
      const existingOneTier: ExistingBikeRecord[] = [
        {
          id: 'click-gen-1',
          brand_name: 'Honda',
          model_name: 'Click 125',
          year: 2015,
          year_to: 2020,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: null, rate_per_day: 200 }],
        },
      ];

      // Crawl lists new 2021-2024 tier first, followed by existing 2015-2020 tier
      const crawledTwoTiers: any[] = [
        {
          brand: 'Honda',
          modelName: 'Click 125',
          year: '2021-2024',
          engineCapacityCc: 125,
          rates: [{ minDays: 1, ratePerDay: 250, currency: 'THB' }],
        },
        {
          brand: 'Honda',
          modelName: 'Click 125',
          year: '2015-2020',
          engineCapacityCc: 125,
          rates: [{ minDays: 1, ratePerDay: 200, currency: 'THB' }],
        },
      ];

      const diff = computeShopInventoryDiff(existingOneTier, crawledTwoTiers);

      expect(diff.items).toHaveLength(2);
      const addedTier = diff.items.find((i) => i.action === 'add');
      const matchedTier = diff.items.find((i) => i.action === 'unchanged');

      expect(addedTier).toBeDefined();
      expect(addedTier?.proposed_data).toMatchObject({
        year: 2021,
        year_to: 2024,
      });

      expect(matchedTier).toBeDefined();
      expect(matchedTier?.entity_id).toBe('click-gen-1');
      expect(diff.summaryCounts).toEqual({
        add: 1,
        update: 0,
        delist: 0,
        unchanged: 1,
      });
    });

    it('does not arbitrarily pair in Pass 2 when multiple unmatched crawled generations compete for a single year=null existing bike', () => {
      const existingNullYear: ExistingBikeRecord[] = [
        {
          id: 'click-null',
          brand_name: 'Honda',
          model_name: 'Click 125',
          year: null,
          year_to: null,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: null, rate_per_day: 200 }],
        },
      ];

      const crawledTwoTiers: any[] = [
        {
          brand: 'Honda',
          modelName: 'Click 125',
          year: '2015-2020',
          engineCapacityCc: 125,
          rates: [{ minDays: 1, ratePerDay: 200, currency: 'THB' }],
        },
        {
          brand: 'Honda',
          modelName: 'Click 125',
          year: '2021-2024',
          engineCapacityCc: 125,
          rates: [{ minDays: 1, ratePerDay: 250, currency: 'THB' }],
        },
      ];

      const diff = computeShopInventoryDiff(existingNullYear, crawledTwoTiers);

      expect(diff.summaryCounts).toEqual({
        add: 2,
        update: 0,
        delist: 1,
        unchanged: 0,
      });
    });
  });
});


