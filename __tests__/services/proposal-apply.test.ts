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

      expect(result.proposal).toEqual(proposalData);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].action).toBe('unchanged');
      expect((result.items[0].original_data as any).availability_status).toBe('available');
      expect((result.items[0].proposed_data as any).availability_status).toBe('available');
      expect(result.items[1].action).toBe('unchanged');
    });
  });
});
