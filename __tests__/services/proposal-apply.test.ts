/**
 * @jest-environment node
 */

import {
  validateGeodataImmutability,
  GeodataImmutabilityError,
  ChangeProposalService,
} from '@/services/change-proposals';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

jest.mock('@/services/task-scheduler', () => ({
  TaskSchedulerService: {
    recordCrawlSuccess: jest.fn().mockResolvedValue({}),
  },
}));

describe('Change Proposal Application & Geodata Protection', () => {
  describe('validateGeodataImmutability', () => {
    it('passes for allowed mutable shop fields', () => {
      expect(() => {
        validateGeodataImmutability({
          business_description: 'Updated shop bio',
          phone: '+66 81 234 5678',
          website: 'https://new-url.com',
        });
      }).not.toThrow();
    });

    it('throws GeodataImmutabilityError when attempting to alter place_id', () => {
      expect(() => {
        validateGeodataImmutability({
          place_id: 'ChIJnewplaceid12345',
        });
      }).toThrow(GeodataImmutabilityError);
    });

    it('throws GeodataImmutabilityError when attempting to alter address or coordinates', () => {
      expect(() => {
        validateGeodataImmutability({
          full_address: '123 New Beach Road',
        });
      }).toThrow(GeodataImmutabilityError);

      expect(() => {
        validateGeodataImmutability({
          latitude: 7.8932,
          longitude: 98.2983,
        });
      }).toThrow(GeodataImmutabilityError);

      expect(() => {
        validateGeodataImmutability({
          provider_name: 'Renamed Shop Provider',
        });
      }).toThrow(GeodataImmutabilityError);
    });
  });

  describe('ChangeProposalService.apply with unchanged items', () => {
    let mockSupabase: any;
    let fromCalls: Record<string, any>;

    beforeEach(() => {
      jest.clearAllMocks();
      fromCalls = {};
    });

    it('ignores unchanged items from database mutations and preserves applied status', async () => {
      const proposalData = {
        id: 'prop-1',
        shop_id: 'shop-1',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-unchanged-1',
          proposal_id: 'prop-1',
          entity_type: 'motorcycle',
          action: 'unchanged',
          entity_id: 'bike-unchanged-uuid',
          brand_name: 'Honda',
          model_name: 'Click 125i',
          proposed_data: { year: 2023, rates: [{ minDays: 1, ratePerDay: 250 }] },
          status: 'applied',
        },
        {
          id: 'item-update-1',
          proposal_id: 'prop-1',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-update-uuid',
          brand_name: 'Yamaha',
          model_name: 'NMAX 155',
          proposed_data: { year: 2024, rates: [{ minDays: 1, ratePerDay: 500 }] },
          status: 'pending',
        },
      ];

      const updateRentalMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const deleteRatesMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const insertRatesMock = jest.fn().mockResolvedValue({ error: null });
      const updateProposalItemsMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
        in: jest.fn().mockResolvedValue({ error: null }),
      });
      const updateProposalsMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: updateProposalsMock,
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: updateProposalItemsMock,
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              update: updateRentalMock,
            };
          }
          if (table === 'rental_rate_tiers') {
            return {
              delete: deleteRatesMock,
              insert: insertRatesMock,
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // Approve both update and unchanged item IDs
      const result = await ChangeProposalService.apply('prop-1', ['item-update-1', 'item-unchanged-1']);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1); // Only the update item triggers a mutation

      // Verify motorcycle_rentals update was called ONLY for bike-update-uuid, NEVER for unchanged bike
      expect(updateRentalMock).toHaveBeenCalledTimes(1);
      expect(updateRentalMock().eq).toHaveBeenCalledWith('id', 'bike-update-uuid');

      // Verify proposal was marked as 'applied' (full approval of mutable items)
      expect(updateProposalsMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'applied' })
      );
    });

    it('does not reject unchanged items when only some mutable items are rejected', async () => {
      const proposalData = {
        id: 'prop-2',
        shop_id: 'shop-1',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-unchanged-1',
          proposal_id: 'prop-2',
          entity_type: 'motorcycle',
          action: 'unchanged',
          entity_id: 'bike-unchanged-uuid',
          brand_name: 'Honda',
          model_name: 'Click 125i',
          proposed_data: { year: 2023 },
          status: 'applied',
        },
        {
          id: 'item-add-1',
          proposal_id: 'prop-2',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Honda',
          model_name: 'Forza 350',
          proposed_data: { year: 2024 },
          status: 'pending',
        },
      ];

      const rejectedInMock = jest.fn().mockResolvedValue({ error: null });
      const updateProposalItemsMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
        in: rejectedInMock,
      });
      const updateProposalsMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: updateProposalsMock,
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: updateProposalItemsMock,
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // Caller rejects all mutable items by passing empty approvedItemIds
      const result = await ChangeProposalService.apply('prop-2', []);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(0);

      // Rejection should only apply to item-add-1, NOT item-unchanged-1
      expect(updateProposalItemsMock).toHaveBeenCalledWith({ status: 'rejected' });
      expect(rejectedInMock).toHaveBeenCalledWith('id', ['item-add-1']);

      // Proposal status should resolve to 'rejected' when zero mutable items are approved
      expect(updateProposalsMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected' })
      );
    });

    it('sets proposal status to partially_applied when some but not all mutable items are approved', async () => {
      const proposalData = {
        id: 'prop-3',
        shop_id: 'shop-1',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-unchanged-1',
          proposal_id: 'prop-3',
          entity_type: 'motorcycle',
          action: 'unchanged',
          entity_id: 'bike-unchanged-uuid',
          brand_name: 'Honda',
          model_name: 'Click 125i',
          proposed_data: { year: 2023 },
          status: 'applied',
        },
        {
          id: 'item-update-1',
          proposal_id: 'prop-3',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-update-uuid',
          brand_name: 'Honda',
          model_name: 'Click 125i',
          proposed_data: { year: 2024 },
          status: 'pending',
        },
        {
          id: 'item-delist-1',
          proposal_id: 'prop-3',
          entity_type: 'motorcycle',
          action: 'delist',
          entity_id: 'bike-delist-uuid',
          brand_name: 'Yamaha',
          model_name: 'NMAX 155',
          proposed_data: { availability_status: 'unavailable' },
          status: 'pending',
        },
      ];

      const updateRentalMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const updateProposalItemsMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
        in: jest.fn().mockResolvedValue({ error: null }),
      });
      const updateProposalsMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: updateProposalsMock,
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: updateProposalItemsMock,
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              update: updateRentalMock,
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // Caller approves 1 of 2 mutable items
      const result = await ChangeProposalService.apply('prop-3', ['item-update-1']);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(updateProposalsMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'partially_applied' })
      );
    });
  });

  describe('ChangeProposalService.createProposalFromCrawl with unchanged items', () => {
    it('stages unchanged items with status: "applied" and mutable items with status: "pending"', async () => {
      const existingInventory = [
        {
          id: 'bike-existing-1',
          brand_name: 'Honda',
          model_name: 'Click 125i',
          year: 2023,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: 6, rate_per_day: 250 }],
        },
      ];

      const getExistingInventorySpy = jest
        .spyOn(ChangeProposalService, 'getExistingShopInventory')
        .mockResolvedValue(existingInventory as any);

      let stagedProposal: any = null;
      let stagedItems: any[] = [];

      const insertProposalMock = jest.fn((payload) => {
        stagedProposal = payload;
        return {
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'prop-staged-1', ...payload },
              error: null,
            }),
          }),
        };
      });

      const insertItemsMock = jest.fn((items) => {
        stagedItems = items;
        return Promise.resolve({ error: null });
      });

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'rental_shops') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          if (table === 'change_proposals') {
            return {
              insert: insertProposalMock,
            };
          }
          if (table === 'change_proposal_items') {
            return {
              insert: insertItemsMock,
            };
          }
          if (table === 'rental_shop_inclusions' || table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const crawlSnapshot = {
        shopId: 'shop-uuid-1',
        sourceUrl: 'https://example.com/rates',
        bikes: [
          {
            brand: 'Honda',
            modelName: 'Click 125i',
            year: 2023,
            rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250 }],
          },
          {
            brand: 'Honda',
            modelName: 'Forza 350',
            year: 2024,
            rates: [{ minDays: 1, maxDays: 6, ratePerDay: 700 }],
          },
        ],
      };

      const result = await ChangeProposalService.createProposalFromCrawl(crawlSnapshot);

      expect(result.proposal).toBeDefined();
      expect(result.diff.summaryCounts).toEqual({
        add: 1,
        update: 0,
        delist: 0,
        unchanged: 1,
      });

      // Verify proposal summary_counts includes unchanged counter
      expect(stagedProposal.summary_counts).toEqual({
        add: 1,
        update: 0,
        delist: 0,
        unchanged: 1,
      });

      // Verify staged items statuses
      expect(stagedItems).toHaveLength(2);
      const unchangedItem = stagedItems.find((i) => i.action === 'unchanged');
      const addedItem = stagedItems.find((i) => i.action === 'add');

      expect(unchangedItem).toBeDefined();
      expect(unchangedItem.status).toBe('applied');
      expect(unchangedItem.model_name).toBe('Click 125i');

      expect(addedItem).toBeDefined();
      expect(addedItem.status).toBe('pending');
      expect(addedItem.model_name).toBe('Forza 350');

      getExistingInventorySpy.mockRestore();
    });

    it('stages proposal with status: "applied" when all observed inventory is unchanged', async () => {
      const existingInventory = [
        {
          id: 'bike-existing-1',
          brand_name: 'Honda',
          model_name: 'Click 125i',
          year: 2023,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rates: [{ min_days: 1, max_days: 6, rate_per_day: 250 }],
        },
      ];

      const getExistingInventorySpy = jest
        .spyOn(ChangeProposalService, 'getExistingShopInventory')
        .mockResolvedValue(existingInventory as any);

      let stagedProposal: any = null;

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'rental_shops') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          if (table === 'change_proposals') {
            return {
              insert: jest.fn((payload) => {
                stagedProposal = payload;
                return {
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'prop-unchanged-all', ...payload },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'rental_shop_inclusions' || table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const crawlSnapshot = {
        shopId: 'shop-uuid-1',
        sourceUrl: 'https://example.com/rates',
        bikes: [
          {
            brand: 'Honda',
            modelName: 'Click 125i',
            year: 2023,
            rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250 }],
          },
        ],
      };

      const result = await ChangeProposalService.createProposalFromCrawl(crawlSnapshot);

      expect(result.proposal.status).toBe('applied');
      expect(stagedProposal.status).toBe('applied');

      getExistingInventorySpy.mockRestore();
    });
  });

  describe('ChangeProposalService.getProposalById with unchanged items', () => {
    it('retrieves proposal with full fleet items including unchanged inventory', async () => {
      const proposalData = {
        id: 'prop-retrieval-1',
        shop_id: 'shop-retrieval-1',
        status: 'pending',
        summary_counts: { add: 0, update: 0, delist: 0, unchanged: 2 },
        rental_shops: {
          id: 'shop-retrieval-1',
          provider_name: 'Phuket Bike Rentals',
          slug: 'phuket-bike-rentals',
        },
      };

      const itemsData = [
        {
          id: 'item-1',
          proposal_id: 'prop-retrieval-1',
          entity_type: 'motorcycle',
          action: 'unchanged',
          brand_name: 'Honda',
          model_name: 'Click 125i',
          original_data: {
            year: 2023,
            engine_capacity_cc: 125,
            rates: [{ min_days: 1, max_days: 6, rate_per_day: 250 }],
            availability_status: 'available',
          },
          proposed_data: {
            brand: 'Honda',
            modelName: 'Click 125i',
            year: 2023,
            rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250 }],
            availability_status: 'available',
          },
          diff_summary: null,
          status: 'applied',
        },
        {
          id: 'item-2',
          proposal_id: 'prop-retrieval-1',
          entity_type: 'motorcycle',
          action: 'unchanged',
          brand_name: 'Yamaha',
          model_name: 'NMAX 155',
          original_data: {
            year: 2024,
            engine_capacity_cc: 155,
            rates: [{ min_days: 1, max_days: 6, rate_per_day: 450 }],
            availability_status: 'available',
          },
          proposed_data: {
            brand: 'Yamaha',
            modelName: 'NMAX 155',
            year: 2024,
            rates: [{ minDays: 1, maxDays: 6, ratePerDay: 450 }],
            availability_status: 'available',
          },
          diff_summary: null,
          status: 'applied',
        },
      ];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await ChangeProposalService.getProposalById('prop-retrieval-1');

      expect(result.proposal).toEqual({
        ...proposalData,
        shop_url: '/shop/phuket-bike-rentals',
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].action).toBe('unchanged');
      expect((result.items[0].original_data as any).availability_status).toBe('available');
      expect((result.items[0].proposed_data as any).availability_status).toBe('available');
      expect(result.items[1].action).toBe('unchanged');
    });

    it('correctly applies proposed add and update items containing dailyRate, engineCapacity, and modelYear aliases', async () => {
      const proposalData = {
        id: 'prop-alias-1',
        shop_id: 'shop-alias-1',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-alias-add-1',
          proposal_id: 'prop-alias-1',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Honda',
          model_name: 'ADV 160',
          original_data: null,
          proposed_data: {
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
          },
          status: 'pending',
        },
      ];

      const insertedMotorcycles: any[] = [];
      const insertedRateTiers: any[] = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
                in: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'brands') {
            return {
              select: jest.fn().mockReturnValue({
                ilike: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'brand-honda' }, error: null }),
                }),
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              insert: jest.fn((payload) => {
                insertedMotorcycles.push(payload);
                return {
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: { id: 'bike-new-uuid' }, error: null }),
                  }),
                };
              }),
            };
          }
          if (table === 'rental_rate_tiers') {
            return {
              insert: jest.fn((tiers) => {
                insertedRateTiers.push(...tiers);
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await ChangeProposalService.apply('prop-alias-1', ['item-alias-add-1']);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);

      // Verify motorcycle insertion mapped aliases
      expect(insertedMotorcycles).toHaveLength(1);
      expect(insertedMotorcycles[0]).toEqual(
        expect.objectContaining({
          shop_id: 'shop-alias-1',
          brand_id: 'brand-honda',
          model: 'ADV 160',
          year: 2024,
          engine_capacity_cc: 157,
          rental_rate_per_day: 600,
          rental_rate_currency: 'THB',
        })
      );

      // Verify rate tier insertion mapped dailyRate to rate_per_day
      expect(insertedRateTiers).toHaveLength(1);
      expect(insertedRateTiers[0]).toEqual({
        motorcycle_id: 'bike-new-uuid',
        min_days: 1,
        max_days: null,
        rate_per_day: 600,
        currency: 'THB',
      });
    });

    it('correctly applies approved shop updates with inclusions and conditions diffs', async () => {
      const proposalData = {
        id: 'prop-shop-1',
        shop_id: 'shop-uuid-1',
        status: 'pending',
      };

      const shopItem = {
        id: 'item-shop-update-1',
        proposal_id: 'prop-shop-1',
        entity_type: 'rental_shop',
        action: 'update',
        entity_id: 'shop-uuid-1',
        brand_name: 'Shop Profile',
        model_name: 'General Information & Policies',
        proposed_data: {
          phone: '+66 81 999 9999',
          website: 'https://bkkbike.com',
          business_description: 'Updated bio',
        },
        diff_summary: {
          phone: { old: '+66 81 000 0000', new: '+66 81 999 9999' },
          inclusions: {
            added: ['Helmets provided', 'Basic insurance coverage'],
            removed: ['Old inclusion'],
          },
          conditions: {
            added: ['Valid driving license required'],
            removed: ['Old condition'],
          },
        },
        status: 'pending',
      };

      const insertedInclusions: any[] = [];
      const deletedInclusions: any[] = [];
      const insertedConditions: any[] = [];
      const deletedConditions: any[] = [];
      let updatedShop: any = null;

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [shopItem], error: null }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
                in: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'rental_shops') {
            return {
              update: jest.fn().mockImplementation((payload) => {
                updatedShop = payload;
                return {
                  eq: jest.fn().mockResolvedValue({ error: null }),
                };
              }),
            };
          }
          if (table === 'rental_shop_inclusions') {
            return {
              insert: jest.fn().mockImplementation((rows) => {
                insertedInclusions.push(...rows);
                return Promise.resolve({ error: null });
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn().mockImplementation((_col, vals) => {
                    deletedInclusions.push(...vals);
                    return Promise.resolve({ error: null });
                  }),
                }),
              }),
            };
          }
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    { id: 'type-license-uuid', name: 'Driver License' },
                    { id: 'type-deposit-uuid', name: 'Security Deposit' },
                    { id: 'type-general-uuid', name: 'General Policy' },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
              insert: jest.fn().mockImplementation((rows) => {
                insertedConditions.push(...rows);
                return Promise.resolve({ error: null });
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn().mockImplementation((_col, vals) => {
                    deletedConditions.push(...vals);
                    return Promise.resolve({ error: null });
                  }),
                }),
              }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockResolvedValue({ error: null }),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
          };
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await ChangeProposalService.apply('prop-shop-1', ['item-shop-update-1']);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(updatedShop).toEqual({
        phone: '+66 81 999 9999',
        website: 'https://bkkbike.com',
        business_description: 'Updated bio',
      });

      expect(insertedInclusions).toHaveLength(2);
      expect(insertedInclusions[0]).toEqual({
        shop_id: 'shop-uuid-1',
        inclusion_text: 'Helmets provided',
      });
      expect(deletedInclusions).toContain('Old inclusion');

      expect(insertedConditions).toHaveLength(1);
      expect(insertedConditions[0]).toEqual({
        shop_id: 'shop-uuid-1',
        condition_type_id: 'type-license-uuid',
        condition_value: 'Valid driving license required',
      });
      expect(deletedConditions).toContain('Old condition');
    });

    it('assigns distinct condition_type_ids when multiple conditions are applied to prevent unique constraint collisions', async () => {
      const proposalData = {
        id: 'prop-shop-multi',
        shop_id: 'shop-uuid-1',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-shop-multi-1',
          proposal_id: 'prop-shop-multi',
          entity_type: 'rental_shop',
          action: 'update',
          entity_id: 'shop-uuid-1',
          brand_name: 'Shop Profile',
          model_name: 'Policies',
          proposed_data: {
            business_description: 'Shop with multiple conditions',
          },
          diff_summary: {
            conditions: {
              old: [],
              new: [
                'Valid motorcycle driving licence required',
                'International driving permit may be required',
                'Security deposit 3000 THB required',
              ],
              added: [
                'Valid motorcycle driving licence required',
                'International driving permit may be required',
                'Security deposit 3000 THB required',
              ],
              removed: [],
            },
          },
          status: 'pending',
        },
      ];

      const insertedConditions: any[] = [];
      const assignedIdsInDb = new Set<string>();

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                  maybeSingle: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'rental_shops') {
            return {
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    { id: 'type-license-uuid', name: 'Driver License' },
                    { id: 'type-permit-uuid', name: 'Driving Permit' },
                    { id: 'type-deposit-uuid', name: 'Security Deposit' },
                    { id: 'type-general-uuid', name: 'General Policy' },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockImplementation((_col, _val) =>
                  Promise.resolve({
                    data: Array.from(assignedIdsInDb).map((id) => ({ condition_type_id: id })),
                    error: null,
                  })
                ),
              }),
              insert: jest.fn().mockImplementation((rows) => {
                for (const row of rows) {
                  if (assignedIdsInDb.has(row.condition_type_id)) {
                    throw new Error(`Unique constraint violation: duplicate (shop_id, condition_type_id)`);
                  }
                  assignedIdsInDb.add(row.condition_type_id);
                  insertedConditions.push(row);
                }
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockResolvedValue({ error: null }),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
          };
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await ChangeProposalService.apply('prop-shop-multi', ['item-shop-multi-1']);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(insertedConditions).toHaveLength(3);

      // Verify that all 3 conditions have DISTINCT condition_type_ids
      const typeIds = insertedConditions.map((c) => c.condition_type_id);
      const uniqueTypeIds = new Set(typeIds);
      expect(uniqueTypeIds.size).toBe(3);
    });

    it('rolls back (deletes) the newly inserted parent change_proposals row when inserting change_proposal_items fails', async () => {
      const getExistingInventorySpy = jest
        .spyOn(ChangeProposalService, 'getExistingShopInventory')
        .mockResolvedValue([
          {
            id: 'bike-pcx-1',
            brand_name: 'Honda',
            model_name: 'PCX',
            year: null,
            engine_capacity_cc: 150,
            availability_status: 'available',
            rates: [{ min_days: 1, max_days: null, rate_per_day: 15 }],
          },
        ] as any);

      const deletedProposalIds: string[] = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'rental_shops') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          if (table === 'rental_shop_inclusions' || table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          if (table === 'change_proposals') {
            return {
              insert: jest.fn((payload) => ({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-orphan-candidate', ...payload },
                    error: null,
                  }),
                }),
              })),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn((col: string, val: string) => {
                  if (col === 'id') {
                    deletedProposalIds.push(val);
                  }
                  return {
                    eq: jest.fn().mockReturnThis(),
                    neq: jest.fn().mockResolvedValue({ error: null }),
                    then: (resolve: any) => resolve({ error: null }),
                  };
                }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              insert: jest.fn().mockResolvedValue({
                error: { message: 'invalid input value for enum proposal_action: "unchanged"' },
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      await expect(
        ChangeProposalService.createProposalFromCrawl({
          shopId: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
          sourceUrl: 'https://wescooterrentalsiemreap.com/',
          agentRunId: 'hermes-we-scooter-20261014T180742Z-be3924d7',
          bikes: [
            {
              brand: 'Honda',
              modelName: 'PCX',
              rates: [{ minDays: 1, ratePerDay: 15, currency: 'USD' }],
            },
          ],
        })
      ).rejects.toThrow('Failed to stage change proposal items: invalid input value for enum proposal_action: "unchanged"');

      // Parent row must be rolled back so no orphaned 0-item proposal remains
      expect(deletedProposalIds).toContain('prop-orphan-candidate');

      getExistingInventorySpy.mockRestore();
    });

    it('replaces existing pending Change Proposals for the same (shopId, agentRunId) when staging succeeds', async () => {
      const getExistingInventorySpy = jest
        .spyOn(ChangeProposalService, 'getExistingShopInventory')
        .mockResolvedValue([
          {
            id: 'bike-click-1',
            brand_name: 'Honda',
            model_name: 'Click',
            year: null,
            engine_capacity_cc: 125,
            availability_status: 'available',
            rates: [{ min_days: 1, max_days: null, rate_per_day: 10 }],
          },
        ] as any);

      const deleteFilters: Array<Record<string, any>> = [];

      const createDeleteChain = () => {
        const filters: Record<string, any> = {};
        const chain: any = {
          eq: jest.fn((col: string, val: any) => {
            filters[col] = val;
            return chain;
          }),
          neq: jest.fn((col: string, val: any) => {
            filters[`neq_${col}`] = val;
            return chain;
          }),
          then: (resolve: any) => {
            deleteFilters.push(filters);
            return resolve({ error: null });
          },
        };
        return chain;
      };

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'rental_shops') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          if (table === 'rental_shop_inclusions' || table === 'rental_shop_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          if (table === 'change_proposals') {
            return {
              insert: jest.fn((payload) => ({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-new-11usd', ...payload },
                    error: null,
                  }),
                }),
              })),
              delete: jest.fn(() => createDeleteChain()),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await ChangeProposalService.createProposalFromCrawl({
        shopId: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
        sourceUrl: 'https://wescooterrentalsiemreap.com/',
        agentRunId: 'hermes-we-scooter-20261014T180742Z-be3924d7',
        bikes: [
          {
            brand: 'Honda',
            modelName: 'Click 125',
            engineCapacityCc: 125,
            rates: [{ minDays: 1, ratePerDay: 11, currency: 'USD' }],
          },
        ],
      });

      expect(result.proposal.id).toBe('prop-new-11usd');
      expect(result.diff.summaryCounts).toEqual({
        add: 0,
        update: 1,
        delist: 0,
        unchanged: 0,
      });

      // Verify any prior pending proposal with the same (shop_id, agent_run_id) was superseded/deleted
      expect(deleteFilters).toContainEqual({
        shop_id: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
        agent_run_id: 'hermes-we-scooter-20261014T180742Z-be3924d7',
        status: 'pending',
        neq_id: 'prop-new-11usd',
      });

      getExistingInventorySpy.mockRestore();
    });

    it('persists camelCase businessDescription in proposed_data to rental_shops.business_description when applying a shop update', async () => {
      const proposalData = {
        id: 'prop-shop-camel',
        shop_id: 'shop-uuid-camel',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-shop-camel-1',
          proposal_id: 'prop-shop-camel',
          entity_type: 'rental_shop',
          action: 'update',
          entity_id: 'shop-uuid-camel',
          brand_name: 'Shop Profile',
          model_name: 'General Information',
          proposed_data: {
            businessDescription: 'Family-run scooter rental in Siem Reap.',
          },
          diff_summary: {
            business_description: {
              old: null,
              new: 'Family-run scooter rental in Siem Reap.',
            },
          },
          status: 'pending',
        },
      ];

      let updatedShopPayload: Record<string, any> | null = null;

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'rental_shops') {
            return {
              update: jest.fn((payload: Record<string, any>) => {
                updatedShopPayload = payload;
                return {
                  eq: jest.fn().mockResolvedValue({ error: null }),
                };
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await ChangeProposalService.apply('prop-shop-camel', ['item-shop-camel-1']);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(updatedShopPayload).toEqual({
        business_description: 'Family-run scooter rental in Siem Reap.',
      });
    });

    it('getProposals returns canonical GMR shopUrl constructed from shop slug, city, and country', async () => {
      const mockRows = [
        {
          id: 'prop-1',
          shop_id: 'shop-1',
          agent_run_id: 'run-1',
          source_url: 'https://wescooterrentalsiemreap.com/',
          status: 'pending',
          summary_counts: { add: 1, update: 0, delist: 0, unchanged: 7 },
          created_at: '2026-10-15T00:00:00Z',
          reviewed_at: null,
          rental_shops: {
            id: 'shop-1',
            provider_name: 'We Scooter Rental Siem Reap',
            slug: 'we-scooter-rental-siem-reap',
            cities: {
              name: 'Siem Reap',
              provinces: {
                countries: {
                  name: 'Cambodia',
                },
              },
            },
          },
        },
      ];

      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockRows,
                count: 1,
                error: null,
              }),
            }),
          }),
        })),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.getProposals({});
      expect(res.proposals[0].shopUrl).toBe('/shop/cambodia/siem-reap/we-scooter-rental-siem-reap');
    });

    it('getProposalById returns canonical GMR shop_url on the proposal record', async () => {
      const mockProposal = {
        id: 'prop-1',
        shop_id: 'shop-1',
        source_url: 'https://wescooterrentalsiemreap.com/',
        status: 'pending',
        created_at: '2026-10-15T00:00:00Z',
        rental_shops: {
          id: 'shop-1',
          provider_name: 'We Scooter Rental Siem Reap',
          slug: 'we-scooter-rental-siem-reap',
          cities: {
            name: 'Siem Reap',
            provinces: {
              countries: {
                name: 'Cambodia',
              },
            },
          },
        },
      };

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockProposal, error: null }),
                }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.getProposalById('prop-1');
      expect((res.proposal as any).shop_url).toBe('/shop/cambodia/siem-reap/we-scooter-rental-siem-reap');
    });

    it('rejects ChangeProposalService.apply when proposal status is already partially_applied', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'prop-partial', shop_id: 'shop-1', status: 'partially_applied' },
                error: null,
              }),
            }),
          }),
        })),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      await expect(ChangeProposalService.apply('prop-partial', [])).rejects.toThrow(
        "Cannot apply proposal with status 'partially_applied'"
      );
    });
  });

  describe('Motorcycle Identity Reconciliation, Resolution & SEO Preservation (#135)', () => {
    it('updates brand_id, model, year, source_url, and rates in-place while preserving motorcycle ID when applying a brand/model correction update', async () => {
      const proposalData = {
        id: 'prop-qbix',
        shop_id: 'abc85b6d-9b86-40fa-98a5-f3bc91b9a48c',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-qbix-update',
          proposal_id: 'prop-qbix',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
          brand_name: 'Yamaha',
          model_name: 'QBIX',
          original_data: {
            year: 2022,
            source_url: 'https://siemreapscooterrental.com/index.php/bike-rental/honda-qbix-2022/',
            rates: [{ min_days: 1, max_days: null, rate_per_day: 17 }],
          },
          proposed_data: {
            existingMotorcycleId: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
            brand: 'Yamaha',
            modelName: 'QBIX',
            year: 2022,
            sourceUrl: 'https://siemreapscooterrental.com/index.php/bike-rental/yamaha-qbix-2022/',
            rates: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }],
          },
          diff_summary: {
            brand: { old: 'Honda', new: 'Yamaha' },
            rates: {
              old: [{ min_days: 1, max_days: null, rate_per_day: 17 }],
              new: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }],
            },
          },
          status: 'pending',
        },
      ];

      let updatedRentalPayload: any = null;
      let updatedRentalId: string | null = null;

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
                in: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'brands') {
            return {
              select: jest.fn().mockReturnValue({
                ilike: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'da4e4ea0-311e-4b3b-bbe4-a3692a74f5fd' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
                      source_url:
                        'https://siemreapscooterrental.com/index.php/bike-rental/honda-qbix-2022/',
                      specifications_details: null,
                    },
                    error: null,
                  }),
                }),
              }),
              update: jest.fn((payload: any) => {
                updatedRentalPayload = payload;
                return {
                  eq: jest.fn((col: string, val: string) => {
                    updatedRentalId = val;
                    return Promise.resolve({ error: null });
                  }),
                };
              }),
            };
          }
          if (table === 'rental_rate_tiers') {
            return {
              delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.apply('prop-qbix', ['item-qbix-update']);

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(1);
      expect(updatedRentalId).toBe('7d316bb8-4f40-459c-a7ad-bfc445d8c851');
      expect(updatedRentalPayload).toMatchObject({
        brand_id: 'da4e4ea0-311e-4b3b-bbe4-a3692a74f5fd',
        year: 2022,
        rental_rate_per_day: 12,
        rental_rate_currency: 'USD',
        source_url: 'https://siemreapscooterrental.com/index.php/bike-rental/yamaha-qbix-2022/',
        specifications_details: {
          source_url_aliases: [
            'https://siemreapscooterrental.com/index.php/bike-rental/honda-qbix-2022/',
          ],
        },
      });
    });

    it('blocks applying an item that still has unresolved identity_review.needsReview === true', async () => {
      const proposalData = {
        id: 'prop-unresolved',
        shop_id: 'shop-1',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-ambiguous',
          proposal_id: 'prop-unresolved',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Yamaha',
          model_name: 'PG-1',
          proposed_data: { brand: 'Yamaha', modelName: 'PG-1', rates: [] },
          diff_summary: {
            identity_review: {
              needsReview: true,
              reason: 'ambiguous_candidates',
              candidates: [{ id: '9500f956-4eb1-403f-bd52-de60fe6818f7' }],
            },
          },
          status: 'pending',
        },
      ];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      await expect(
        ChangeProposalService.apply('prop-unresolved', ['item-ambiguous'])
      ).rejects.toThrow(/identity review/i);
    });

    it('resolves an identity_review item to update an existing motorcycle, recomputes the diff, and deletes the superseded delist item', async () => {
      const proposalData = {
        id: 'prop-resolve',
        shop_id: 'abc85b6d-9b86-40fa-98a5-f3bc91b9a48c',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-add-qbix',
          proposal_id: 'prop-resolve',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Yamaha',
          model_name: 'QBIX',
          original_data: null,
          proposed_data: {
            brand: 'Yamaha',
            modelName: 'QBIX',
            year: 2022,
            rates: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }],
          },
          diff_summary: {
            status: { old: null, new: 'new_listing' },
            rates: { old: null, new: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }] },
            identity_review: {
              needsReview: true,
              reason: 'likely_replacement',
              candidates: [
                {
                  id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
                  brand_name: 'Honda',
                  model_name: 'QBIX',
                  year: 2022,
                  engine_capacity_cc: null,
                  source_url:
                    'https://siemreapscooterrental.com/index.php/bike-rental/honda-qbix-2022/',
                  rates: [{ min_days: 1, max_days: null, rate_per_day: 17 }],
                },
              ],
            },
          },
          status: 'pending',
        },
        {
          id: 'item-delist-qbix',
          proposal_id: 'prop-resolve',
          entity_type: 'motorcycle',
          action: 'delist',
          entity_id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
          brand_name: 'Honda',
          model_name: 'QBIX',
          original_data: {
            year: 2022,
            rates: [{ min_days: 1, max_days: null, rate_per_day: 17 }],
          },
          proposed_data: { availability_status: 'unavailable' },
          diff_summary: { availability_status: { old: 'available', new: 'unavailable' } },
          status: 'pending',
        },
      ];

      let updatedItemPayload: any = null;
      let deletedItemIds: string[] = [];
      let updatedSummaryCounts: any = null;

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: jest.fn((payload: any) => {
                updatedSummaryCounts = payload.summary_counts;
                return {
                  eq: jest.fn().mockResolvedValue({ error: null }),
                };
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: jest.fn((payload: any) => {
                updatedItemPayload = payload;
                return {
                  eq: jest.fn().mockResolvedValue({ error: null }),
                };
              }),
              delete: jest.fn(() => ({
                in: jest.fn((_col: string, ids: string[]) => {
                  deletedItemIds = ids;
                  return Promise.resolve({ error: null });
                }),
              })),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const resolved = await ChangeProposalService.resolveIdentityReview('prop-resolve', {
        itemId: 'item-add-qbix',
        resolution: 'update_existing',
        targetMotorcycleId: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
      });

      expect(resolved.success).toBe(true);
      expect(updatedItemPayload).toMatchObject({
        action: 'update',
        entity_id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
        brand_name: 'Yamaha',
        model_name: 'QBIX',
      });
      expect(updatedItemPayload.diff_summary.brand).toEqual({ old: 'Honda', new: 'Yamaha' });
      expect(updatedItemPayload.diff_summary.identity_review.needsReview).toBe(false);
      expect(deletedItemIds).toEqual(['item-delist-qbix']);
      expect(updatedSummaryCounts).toEqual({
        add: 0,
        update: 1,
        delist: 0,
        unchanged: 0,
      });
    });

    it('retires merged duplicate records with merged_into_id and appends retired source_url to surviving source_url_aliases when applying a merge_duplicates update', async () => {
      const proposalData = {
        id: 'prop-merge',
        shop_id: 'abc85b6d-9b86-40fa-98a5-f3bc91b9a48c',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-merge-pg1',
          proposal_id: 'prop-merge',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: '9500f956-4eb1-403f-bd52-de60fe6818f7',
          brand_name: 'Yamaha',
          model_name: 'PG-1',
          original_data: {
            year: 2024,
            source_url:
              'https://siemreapscooterrental.com/index.php/bike-rental/yamaha-pg-1-125-cc-semi-automatic-brand-new-2024-14-21-days/',
            rates: [{ min_days: 1, max_days: null, rate_per_day: 21 }],
          },
          proposed_data: {
            existingMotorcycleId: '9500f956-4eb1-403f-bd52-de60fe6818f7',
            mergeDuplicateIds: ['74a83430-2e1c-47af-ae9b-fb788a01367a'],
            brand: 'Yamaha',
            modelName: 'PG-1',
            year: 2026,
            rates: [{ minDays: 1, ratePerDay: 21, currency: 'USD' }],
          },
          diff_summary: {
            year: { old: 2024, new: 2026 },
            identity_review: {
              needsReview: false,
              resolution: 'merge_duplicates',
              targetMotorcycleId: '9500f956-4eb1-403f-bd52-de60fe6818f7',
              duplicateMotorcycleIds: ['74a83430-2e1c-47af-ae9b-fb788a01367a'],
            },
          },
          status: 'pending',
        },
      ];

      const rentalUpdatesById: Record<string, any> = {};

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: proposalData, error: null }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: itemsData, error: null }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
                in: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, id: string) => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data:
                      id === '9500f956-4eb1-403f-bd52-de60fe6818f7'
                        ? {
                            id,
                            source_url:
                              'https://siemreapscooterrental.com/index.php/bike-rental/yamaha-pg-1-125-cc-semi-automatic-brand-new-2024-14-21-days/',
                            specifications_details: { raw_shop_model: 'PG 1' },
                          }
                        : {
                            id,
                            source_url:
                              'https://siemreapscooterrental.com/index.php/bike-rental/yamaha-pg1-2024-125-cc-semi-automatic/',
                            specifications_details: { raw_shop_model: 'PG1' },
                          },
                    error: null,
                  }),
                })),
              }),
              update: jest.fn((payload: any) => ({
                eq: jest.fn((_col: string, id: string) => {
                  rentalUpdatesById[id] = { ...(rentalUpdatesById[id] || {}), ...payload };
                  return Promise.resolve({ error: null });
                }),
              })),
            };
          }
          if (table === 'rental_rate_tiers') {
            return {
              delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.apply('prop-merge', ['item-merge-pg1']);

      expect(res.success).toBe(true);
      // Duplicate record soft-retired with merged_into_id
      expect(rentalUpdatesById['74a83430-2e1c-47af-ae9b-fb788a01367a']).toEqual({
        availability_status: 'unavailable',
        specifications_details: {
          raw_shop_model: 'PG1',
          merged_into_id: '9500f956-4eb1-403f-bd52-de60fe6818f7',
        },
      });
      // Surviving record updated with retired source_url in source_url_aliases
      expect(rentalUpdatesById['9500f956-4eb1-403f-bd52-de60fe6818f7']).toMatchObject({
        year: 2026,
        specifications_details: {
          raw_shop_model: 'PG 1',
          source_url_aliases: [
            'https://siemreapscooterrental.com/index.php/bike-rental/yamaha-pg1-2024-125-cc-semi-automatic/',
          ],
        },
      });
    });
  });
});




