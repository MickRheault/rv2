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

  describe('ChangeProposalService.createProposalFromItems with explicit agent items', () => {
    it('stages unchanged items with status: "applied" and mutable items with status: "pending"', async () => {
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

      const result = await ChangeProposalService.createProposalFromItems({
        shopId: 'shop-uuid-1',
        sourceUrl: 'https://example.com/rates',
        items: [
          {
            entityType: 'motorcycle',
            action: 'unchanged',
            entityId: 'bike-existing-1',
            brandName: 'Honda',
            modelName: 'Click 125i',
            originalData: { year: 2023, rates: [{ min_days: 1, max_days: 6, rate_per_day: 250 }] },
            proposedData: { year: 2023, rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250 }] },
          },
          {
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'Forza 350',
            proposedData: { year: 2024, rates: [{ minDays: 1, maxDays: 6, ratePerDay: 700 }] },
          },
        ],
      });

      expect(result.proposal).toBeDefined();
      expect(result.summaryCounts).toEqual({
        add: 1,
        update: 0,
        delist: 0,
        unchanged: 1,
      });

      expect(stagedProposal.summary_counts).toEqual({
        add: 1,
        update: 0,
        delist: 0,
        unchanged: 1,
      });

      expect(stagedItems).toHaveLength(2);
      const unchangedItem = stagedItems.find((i) => i.action === 'unchanged');
      const addedItem = stagedItems.find((i) => i.action === 'add');

      expect(unchangedItem).toBeDefined();
      expect(unchangedItem.status).toBe('applied');
      expect(unchangedItem.entity_id).toBe('bike-existing-1');
      expect(unchangedItem.model_name).toBe('Click 125i');

      expect(addedItem).toBeDefined();
      expect(addedItem.status).toBe('pending');
      expect(addedItem.model_name).toBe('Forza 350');
    });

    it('stages proposal with status: "applied" when all submitted items are unchanged', async () => {
      let stagedProposal: any = null;

      const mockSupabase = {
        from: jest.fn((table: string) => {
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

      const result = await ChangeProposalService.createProposalFromItems({
        shopId: 'shop-uuid-1',
        sourceUrl: 'https://example.com/rates',
        items: [
          {
            entityType: 'motorcycle',
            action: 'unchanged',
            entityId: 'bike-existing-1',
            brandName: 'Honda',
            modelName: 'Click 125i',
            proposedData: { year: 2023, rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250 }] },
          },
        ],
      });

      expect(result.proposal.status).toBe('applied');
      expect(stagedProposal.status).toBe('applied');
    });

    it('throws ProposalItemValidationError when an update/delist/unchanged item is missing entityId', async () => {
      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-uuid-1',
          sourceUrl: 'https://example.com/rates',
          items: [
            {
              entityType: 'motorcycle',
              action: 'update',
              brandName: 'Yamaha',
              modelName: 'PG-1',
              proposedData: { year: 2025 },
            },
          ],
        })
      ).rejects.toThrow(/entityId/i);
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
      const deletedProposalIds: string[] = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
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
        ChangeProposalService.createProposalFromItems({
          shopId: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
          sourceUrl: 'https://wescooterrentalsiemreap.com/',
          agentRunId: 'hermes-we-scooter-20261014T180742Z-be3924d7',
          items: [
            {
              entityType: 'motorcycle',
              action: 'add',
              brandName: 'Honda',
              modelName: 'PCX',
              proposedData: { rates: [{ minDays: 1, ratePerDay: 15, currency: 'USD' }] },
            },
          ],
        })
      ).rejects.toThrow('Failed to stage change proposal items: invalid input value for enum proposal_action: "unchanged"');

      // Parent row must be rolled back so no orphaned 0-item proposal remains
      expect(deletedProposalIds).toContain('prop-orphan-candidate');
    });

    it('replaces existing pending Change Proposals for the same (shopId, agentRunId) when staging succeeds', async () => {
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

      const result = await ChangeProposalService.createProposalFromItems({
        shopId: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
        sourceUrl: 'https://wescooterrentalsiemreap.com/',
        agentRunId: 'hermes-we-scooter-20261014T180742Z-be3924d7',
        items: [
          {
            entityType: 'motorcycle',
            action: 'update',
            entityId: 'bike-click-1',
            brandName: 'Honda',
            modelName: 'Click 125',
            proposedData: {
              engineCapacityCc: 125,
              rates: [{ minDays: 1, ratePerDay: 11, currency: 'USD' }],
            },
          },
        ],
      });

      expect(result.proposal.id).toBe('prop-new-11usd');
      expect(result.summaryCounts).toEqual({
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

    it('persists year and year_to on add and update in apply (#138)', async () => {
      const proposalData = {
        id: 'prop-year-range',
        shop_id: 'shop-1',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-add-range',
          proposal_id: 'prop-year-range',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Honda',
          model_name: 'Click 125',
          proposed_data: {
            brand: 'Honda',
            modelName: 'Click 125',
            year: 2015,
            year_to: 2020,
            engineCapacityCc: 125,
            rates: [{ minDays: 1, ratePerDay: 200, currency: 'THB' }],
          },
          status: 'pending',
        },
        {
          id: 'item-update-single-year',
          proposal_id: 'prop-year-range',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-existing-range',
          brand_name: 'Honda',
          model_name: 'CB500X',
          proposed_data: {
            brand: 'Honda',
            modelName: 'CB500X',
            year: 2023,
            year_to: null,
            rates: [{ minDays: 1, ratePerDay: 800, currency: 'THB' }],
          },
          status: 'pending',
        },
      ];

      const insertedMotorcycles: any[] = [];
      const updatedMotorcycles: Array<{ id: string; payload: any }> = [];

      const mockApplySupabase = {
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
                    single: jest.fn().mockResolvedValue({ data: { id: 'bike-new-gen' }, error: null }),
                  }),
                };
              }),
              update: jest.fn((payload) => ({
                eq: jest.fn((_col: string, id: string) => {
                  updatedMotorcycles.push({ id, payload });
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

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockApplySupabase);

      const applyRes = await ChangeProposalService.apply('prop-year-range', [
        'item-add-range',
        'item-update-single-year',
      ]);

      expect(applyRes.success).toBe(true);
      expect(insertedMotorcycles).toHaveLength(1);
      expect(insertedMotorcycles[0]).toMatchObject({
        model: 'Click 125',
        year: 2015,
        year_to: 2020,
      });

      expect(updatedMotorcycles).toHaveLength(1);
      expect(updatedMotorcycles[0]).toEqual({
        id: 'bike-existing-range',
        payload: expect.objectContaining({
          year: 2023,
          year_to: null,
        }),
      });
    });
  });

  describe('Direct In-Place Updates on Approved Motorcycle Items', () => {
    it('updates brand_id, model, year, source_url, and rates directly from proposed_data even when diff_summary is omitted', async () => {
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
          model_name: 'QBIX 125',
          original_data: {
            brand: 'Honda',
            model: 'QBIX',
            year: 2022,
            source_url: 'https://siemreapscooterrental.com/index.php/bike-rental/honda-qbix-2022/',
            rates: [{ min_days: 1, max_days: null, rate_per_day: 17 }],
          },
          proposed_data: {
            brand: 'Yamaha',
            modelName: 'QBIX 125',
            year: 2022,
            sourceUrl: 'https://siemreapscooterrental.com/index.php/bike-rental/yamaha-qbix-2022/',
            rates: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }],
          },
          diff_summary: null,
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
                  eq: jest.fn((_col: string, val: string) => {
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
        model: 'QBIX 125',
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

    it('rejects add items missing brandName/modelName, duplicate entityIds, and entityIds belonging to another shop', async () => {
      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-1',
          sourceUrl: 'https://example.com',
          items: [
            {
              entityType: 'motorcycle',
              action: 'add',
              proposedData: { rates: [] },
            },
          ],
        })
      ).rejects.toThrow(/requires non-empty brandName and modelName/i);

      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-1',
          sourceUrl: 'https://example.com',
          items: [
            {
              entityType: 'motorcycle',
              action: 'update',
              entityId: 'bike-1',
              proposedData: { year: 2024 },
            },
            {
              entityType: 'motorcycle',
              action: 'delist',
              entityId: 'bike-1',
            },
          ],
        })
      ).rejects.toThrow(/Duplicate entityId 'bike-1'/i);

      (getSupabaseAdmin as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'bike-other-shop', shop_id: 'shop-other' }],
              error: null,
            }),
          }),
        })),
      });

      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-1',
          sourceUrl: 'https://example.com',
          items: [
            {
              entityType: 'motorcycle',
              action: 'update',
              entityId: 'bike-other-shop',
              proposedData: { year: 2024 },
            },
          ],
        })
      ).rejects.toThrow(/does not belong to shop 'shop-1'/i);
    });

    it('applies rental_shop inclusions and conditions from proposed_data vs original_data when diff_summary is omitted', async () => {
      const insertedInclusions: any[] = [];
      const deletedInclusions: string[] = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-shop-fallback', shop_id: 'shop-1', status: 'pending' },
                    error: null,
                  }),
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
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'item-shop-fallback',
                      proposal_id: 'prop-shop-fallback',
                      entity_type: 'rental_shop',
                      action: 'update',
                      entity_id: 'shop-1',
                      brand_name: 'Shop Profile',
                      model_name: 'General Information & Policies',
                      original_data: {
                        inclusions: ['2 Helmets', 'Old Paper Map'],
                      },
                      proposed_data: {
                        inclusions: ['2 Helmets', 'Phone Holder'],
                      },
                      diff_summary: null,
                      status: 'pending',
                    },
                  ],
                  error: null,
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'rental_shop_inclusions') {
            return {
              insert: jest.fn((rows: any[]) => {
                insertedInclusions.push(...rows);
                return Promise.resolve({ error: null });
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn((_col: string, vals: string[]) => {
                    deletedInclusions.push(...vals);
                    return Promise.resolve({ error: null });
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.apply('prop-shop-fallback', ['item-shop-fallback']);
      expect(res.success).toBe(true);
      expect(insertedInclusions).toEqual([{ shop_id: 'shop-1', inclusion_text: 'Phone Holder' }]);
      expect(deletedInclusions).toEqual(['Old Paper Map']);
    });

    function createBatchApplyMockSupabase(
      proposalData: any,
      itemsData: any[],
      onBrandLookup?: (name: string) => void
    ) {
      const insertedMotorcycles: any[] = [];
      const updatedMotorcycles: any[] = [];
      const rejectedItemIds: string[] = [];
      let finalProposalUpdate: any = null;

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
                finalProposalUpdate = payload;
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
              update: jest.fn((payload: any) => ({
                eq: jest.fn().mockResolvedValue({ error: null }),
                in: jest.fn((_col: string, ids: string[]) => {
                  if (payload.status === 'rejected') {
                    rejectedItemIds.push(...ids);
                  }
                  return Promise.resolve({ error: null });
                }),
              })),
            };
          }
          if (table === 'brands') {
            return {
              select: jest.fn().mockReturnValue({
                ilike: jest.fn((_col: string, name: string) => ({
                  maybeSingle: jest.fn().mockImplementation(async () => {
                    onBrandLookup?.(name);
                    return { data: { id: `brand-${name.toLowerCase()}` }, error: null };
                  }),
                })),
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              insert: jest.fn((payload: any) => {
                insertedMotorcycles.push(payload);
                return {
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: { id: 'bike-click-new' }, error: null }),
                  }),
                };
              }),
              update: jest.fn((payload: any) => ({
                eq: jest.fn((_col: string, id: string) => {
                  updatedMotorcycles.push({ id, payload });
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

      return {
        mockSupabase,
        insertedMotorcycles,
        updatedMotorcycles,
        rejectedItemIds,
        getFinalProposalUpdate: () => finalProposalUpdate,
      };
    }

    it('preserves already-applied and already-rejected items on partial retry without re-inserting duplicates or overwriting statuses (#153)', async () => {
      const proposalData = {
        id: 'prop-partial-retry',
        shop_id: 'shop-ekkamai',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-already-applied-add',
          proposal_id: 'prop-partial-retry',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Honda',
          model_name: 'Moove 110',
          proposed_data: {
            brand: 'Honda',
            modelName: 'Moove 110',
            year: 2023,
            rates: [{ minDays: 1, ratePerDay: 200, currency: 'THB' }],
          },
          status: 'applied',
        },
        {
          id: 'item-already-applied-update',
          proposal_id: 'prop-partial-retry',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-existing-1',
          brand_name: 'Yamaha',
          model_name: 'Qbix 125',
          proposed_data: {
            brand: 'Yamaha',
            modelName: 'Qbix 125',
            year: 2022,
            rates: [{ minDays: 1, ratePerDay: 250, currency: 'THB' }],
          },
          status: 'applied',
        },
        {
          id: 'item-already-rejected-delist',
          proposal_id: 'prop-partial-retry',
          entity_type: 'motorcycle',
          action: 'delist',
          entity_id: 'bike-existing-rejected',
          brand_name: 'Honda',
          model_name: 'Scoopy 110',
          proposed_data: { availability_status: 'unavailable' },
          status: 'rejected',
        },
        {
          id: 'item-remaining-pending-add',
          proposal_id: 'prop-partial-retry',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Honda',
          model_name: 'Click 160',
          proposed_data: {
            brand: 'Honda',
            modelName: 'Click 160',
            year: 2024,
            rates: [{ minDays: 1, ratePerDay: 350, currency: 'THB' }],
          },
          status: 'pending',
        },
        {
          id: 'item-remaining-pending-reject',
          proposal_id: 'prop-partial-retry',
          entity_type: 'motorcycle',
          action: 'delist',
          entity_id: 'bike-existing-2',
          brand_name: 'Honda',
          model_name: 'Zoomer-X 110',
          proposed_data: { availability_status: 'unavailable' },
          status: 'pending',
        },
      ];

      const {
        mockSupabase,
        insertedMotorcycles,
        updatedMotorcycles,
        rejectedItemIds,
        getFinalProposalUpdate,
      } = createBatchApplyMockSupabase(proposalData, itemsData);

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.apply('prop-partial-retry', [
        'item-already-applied-add',
        'item-already-rejected-delist',
        'item-remaining-pending-add',
      ]);

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(1);

      // Must ONLY insert the pending add item ("Click 160"), NEVER re-insert "Moove 110" or mutate already-rejected item
      expect(insertedMotorcycles).toHaveLength(1);
      expect(insertedMotorcycles[0].model).toBe('Click 160');
      expect(updatedMotorcycles).toHaveLength(0);

      // Must ONLY mark the unapproved PENDING item as rejected
      expect(rejectedItemIds).toEqual(['item-remaining-pending-reject']);
      expect(getFinalProposalUpdate().status).toBe('partially_applied');
    });

    it('marks proposal status as applied when all remaining pending items are approved after a partial timeout (#153)', async () => {
      const proposalData = {
        id: 'prop-finish-retry',
        shop_id: 'shop-ekkamai',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-applied-1',
          proposal_id: 'prop-finish-retry',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-1',
          brand_name: 'Honda',
          model_name: 'Click 125',
          proposed_data: { year: 2023 },
          status: 'applied',
        },
        {
          id: 'item-pending-2',
          proposal_id: 'prop-finish-retry',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-2',
          brand_name: 'Yamaha',
          model_name: 'Aerox 155',
          proposed_data: { year: 2024 },
          status: 'pending',
        },
      ];

      const { mockSupabase, rejectedItemIds, getFinalProposalUpdate } =
        createBatchApplyMockSupabase(proposalData, itemsData);

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // UI only sends the remaining pending item ID ('item-pending-2')
      const res = await ChangeProposalService.apply('prop-finish-retry', ['item-pending-2']);

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(1);
      expect(res.status).toBe('applied');
      expect(rejectedItemIds).toEqual([]);
      expect(getFinalProposalUpdate().status).toBe('applied');
    });

    it('deduplicates brand lookups across large batches of items sharing the same brand (#153)', async () => {
      const proposalData = {
        id: 'prop-50-items',
        shop_id: 'shop-large',
        status: 'pending',
      };

      const itemsData = Array.from({ length: 20 }, (_, i) => ({
        id: `item-batch-${i}`,
        proposal_id: 'prop-50-items',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: `bike-${i}`,
        brand_name: i % 2 === 0 ? 'Honda' : 'Yamaha',
        model_name: `Model ${i}`,
        proposed_data: {
          brand: i % 2 === 0 ? 'Honda' : 'Yamaha',
          modelName: `Model ${i}`,
          year: 2024,
          rates: [{ minDays: 1, ratePerDay: 300, currency: 'THB' }],
        },
        status: 'pending',
      }));

      let brandQueryCount = 0;
      const { mockSupabase } = createBatchApplyMockSupabase(proposalData, itemsData, () => {
        brandQueryCount++;
      });

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.apply(
        'prop-50-items',
        itemsData.map((i) => i.id)
      );

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(20);
      // Should only query brands twice (once for Honda, once for Yamaha), not 20 times
      expect(brandQueryCount).toBe(2);
    });
  });

  describe('Motorcycle-Level Conditions in Change Proposals (#156)', () => {
    const SECURITY_DEPOSIT_ID = '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b';
    const PASSPORT_CONDITION_ID = 'b79c1111-2222-4333-8444-555555555555';

    it('accepts valid proposedData.conditions and rejects invalid or duplicate condition_type_id in createProposalFromItems', async () => {
      const stagedItems: any[] = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [
                  { id: SECURITY_DEPOSIT_ID, name: 'Security Deposit' },
                  { id: PASSPORT_CONDITION_ID, name: 'Passport Required' },
                ],
                error: null,
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: [{ id: 'bike-click-125', shop_id: 'shop-madbike' }],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'change_proposals') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-cond-1', shop_id: 'shop-madbike', status: 'pending' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              insert: jest.fn((rows: any[]) => {
                stagedItems.push(...rows);
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === 'shop_agent_configs') {
            return {
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'cfg-1' }, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // 1. Rejects unknown condition_type_id
      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-madbike',
          sourceUrl: 'https://madbikerentalbangkok.com/',
          items: [
            {
              entityType: 'motorcycle',
              action: 'update',
              entityId: 'bike-click-125',
              brandName: 'Honda',
              modelName: 'Click 125',
              proposedData: {
                conditions: [
                  { condition_type_id: 'non-existent-type-id', notes: 'THB 3,000' },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/Invalid condition_type_id/i);

      // 2. Rejects duplicate condition_type_id on the same motorcycle
      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-madbike',
          sourceUrl: 'https://madbikerentalbangkok.com/',
          items: [
            {
              entityType: 'motorcycle',
              action: 'update',
              entityId: 'bike-click-125',
              brandName: 'Honda',
              modelName: 'Click 125',
              proposedData: {
                conditions: [
                  { condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' },
                  { condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 5,000' },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/Duplicate condition_type_id/i);

      // 3. Accepts valid conditions and enriches canonical name
      const res = await ChangeProposalService.createProposalFromItems({
        shopId: 'shop-madbike',
        sourceUrl: 'https://madbikerentalbangkok.com/',
        items: [
          {
            entityType: 'motorcycle',
            action: 'update',
            entityId: 'bike-click-125',
            brandName: 'Honda',
            modelName: 'Click 125',
            originalData: {
              conditions: [],
            },
            proposedData: {
              conditions: [
                { condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' },
              ],
            },
          },
        ],
      });

      expect(res.proposal.id).toBe('prop-cond-1');
      expect(stagedItems).toHaveLength(1);
      expect(stagedItems[0].proposed_data.conditions).toEqual([
        {
          condition_type_id: SECURITY_DEPOSIT_ID,
          name: 'Security Deposit',
          notes: 'THB 3,000',
        },
      ]);
    });

    it('persists motorcycle_conditions on add and update, preserves omitted conditions, and clears on explicit empty array', async () => {
      const liveConditions = new Map<string, Array<{ motorcycle_id: string; condition_type_id: string; notes: string | null }>>([
        [
          'bike-preserve-omitted',
          [{ motorcycle_id: 'bike-preserve-omitted', condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 4,000' }],
        ],
        [
          'bike-clear-empty',
          [{ motorcycle_id: 'bike-clear-empty', condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' }],
        ],
        ['bike-update-deposit', []],
      ]);

      const proposalData = {
        id: 'prop-cond-apply',
        shop_id: 'shop-madbike',
        status: 'pending',
      };

      const itemsData = [
        {
          id: 'item-add-with-cond',
          proposal_id: 'prop-cond-apply',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Honda',
          model_name: 'Lead 125',
          proposed_data: {
            brand: 'Honda',
            modelName: 'Lead 125',
            year: 2024,
            rates: [{ minDays: 1, ratePerDay: 300, currency: 'THB' }],
            conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' }],
          },
          status: 'pending',
        },
        {
          id: 'item-update-deposit',
          proposal_id: 'prop-cond-apply',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-update-deposit',
          brand_name: 'Honda',
          model_name: 'Click 125',
          original_data: {
            conditions: [],
          },
          proposed_data: {
            conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' }],
          },
          status: 'pending',
        },
        {
          id: 'item-preserve-omitted',
          proposal_id: 'prop-cond-apply',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-preserve-omitted',
          brand_name: 'Yamaha',
          model_name: 'Fazzio 125',
          original_data: { year: 2023 },
          proposed_data: { year: 2024 },
          status: 'pending',
        },
        {
          id: 'item-clear-empty',
          proposal_id: 'prop-cond-apply',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-clear-empty',
          brand_name: 'Honda',
          model_name: 'Wave 110',
          original_data: {
            conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' }],
          },
          proposed_data: {
            conditions: [],
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
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [{ id: SECURITY_DEPOSIT_ID, name: 'Security Deposit' }],
                error: null,
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
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: 'bike-new-lead' }, error: null }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
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
          if (table === 'motorcycle_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) =>
                  Promise.resolve({
                    data: [...(liveConditions.get(bikeId) || [])],
                    error: null,
                  })
                ),
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) => {
                  liveConditions.set(bikeId, []);
                  return Promise.resolve({ error: null });
                }),
              }),
              insert: jest.fn((rows: any[]) => {
                for (const row of rows) {
                  const list = liveConditions.get(row.motorcycle_id) || [];
                  list.push({
                    motorcycle_id: row.motorcycle_id,
                    condition_type_id: row.condition_type_id,
                    notes: row.notes ?? null,
                  });
                  liveConditions.set(row.motorcycle_id, list);
                }
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.apply(
        'prop-cond-apply',
        itemsData.map((i) => i.id)
      );

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(4);

      // 1. Added bike received its Security Deposit condition
      expect(liveConditions.get('bike-new-lead')).toEqual([
        {
          motorcycle_id: 'bike-new-lead',
          condition_type_id: SECURITY_DEPOSIT_ID,
          notes: 'THB 3,000',
        },
      ]);

      // 2. Updated bike received its Security Deposit condition
      expect(liveConditions.get('bike-update-deposit')).toEqual([
        {
          motorcycle_id: 'bike-update-deposit',
          condition_type_id: SECURITY_DEPOSIT_ID,
          notes: 'THB 3,000',
        },
      ]);

      // 3. Omitted proposedData.conditions preserved existing THB 4,000 deposit
      expect(liveConditions.get('bike-preserve-omitted')).toEqual([
        {
          motorcycle_id: 'bike-preserve-omitted',
          condition_type_id: SECURITY_DEPOSIT_ID,
          notes: 'THB 4,000',
        },
      ]);

      // 4. Explicit empty array cleared existing conditions
      expect(liveConditions.get('bike-clear-empty')).toEqual([]);
    });

    it('detects stale before-states and makes condition replacement atomic so a failed insert never erases existing conditions', async () => {
      const liveConditions = new Map<string, Array<{ motorcycle_id: string; condition_type_id: string; notes: string | null }>>([
        [
          'bike-stale',
          [{ motorcycle_id: 'bike-stale', condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 5,000' }],
        ],
        [
          'bike-atomic-fail',
          [{ motorcycle_id: 'bike-atomic-fail', condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 2,000' }],
        ],
      ]);

      let failNextNewInsert = false;

      const createStatefulMock = (items: any[]) => ({
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-safe', shop_id: 'shop-madbike', status: 'pending' },
                    error: null,
                  }),
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
                eq: jest.fn().mockResolvedValue({ data: items, error: null }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
                in: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [{ id: SECURITY_DEPOSIT_ID, name: 'Security Deposit' }],
                error: null,
              }),
            };
          }
          if (table === 'motorcycle_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) =>
                  Promise.resolve({
                    data: [...(liveConditions.get(bikeId) || [])],
                    error: null,
                  })
                ),
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) => {
                  liveConditions.set(bikeId, []);
                  return Promise.resolve({ error: null });
                }),
              }),
              insert: jest.fn((rows: any[]) => {
                if (failNextNewInsert) {
                  failNextNewInsert = false;
                  return Promise.resolve({
                    data: null,
                    error: { message: 'Simulated database write error during condition insert' },
                  });
                }
                for (const row of rows) {
                  const list = liveConditions.get(row.motorcycle_id) || [];
                  list.push({
                    motorcycle_id: row.motorcycle_id,
                    condition_type_id: row.condition_type_id,
                    notes: row.notes ?? null,
                  });
                  liveConditions.set(row.motorcycle_id, list);
                }
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      });

      // Case 1: Stale before-state (original_data claims conditions: [], but DB has THB 5,000)
      (getSupabaseAdmin as jest.Mock).mockReturnValue(
        createStatefulMock([
          {
            id: 'item-stale',
            proposal_id: 'prop-safe',
            entity_type: 'motorcycle',
            action: 'update',
            entity_id: 'bike-stale',
            brand_name: 'Honda',
            model_name: 'Click 125',
            original_data: {
              conditions: [],
            },
            proposed_data: {
              conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' }],
            },
            status: 'pending',
          },
        ])
      );

      await expect(
        ChangeProposalService.apply('prop-safe', ['item-stale'])
      ).rejects.toThrow(/Stale motorcycle conditions/i);

      // Existing THB 5,000 condition must remain untouched
      expect(liveConditions.get('bike-stale')).toEqual([
        {
          motorcycle_id: 'bike-stale',
          condition_type_id: SECURITY_DEPOSIT_ID,
          notes: 'THB 5,000',
        },
      ]);

      // Case 2: Failed insertion during condition replacement rolls back / preserves previous THB 2,000 condition
      failNextNewInsert = true;
      (getSupabaseAdmin as jest.Mock).mockReturnValue(
        createStatefulMock([
          {
            id: 'item-atomic',
            proposal_id: 'prop-safe',
            entity_type: 'motorcycle',
            action: 'update',
            entity_id: 'bike-atomic-fail',
            brand_name: 'Honda',
            model_name: 'Scoopy i',
            original_data: {
              conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 2,000' }],
            },
            proposed_data: {
              conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' }],
            },
            status: 'pending',
          },
        ])
      );

      await expect(
        ChangeProposalService.apply('prop-safe', ['item-atomic'])
      ).rejects.toThrow(/Simulated database write error/i);

      // Existing THB 2,000 condition must NOT be erased!
      expect(liveConditions.get('bike-atomic-fail')).toEqual([
        {
          motorcycle_id: 'bike-atomic-fail',
          condition_type_id: SECURITY_DEPOSIT_ID,
          notes: 'THB 2,000',
        },
      ]);

      // Case 3: Failed condition insertion during action === 'add' cleans up the newly created motorcycle_rentals row
      const deletedMotorcycleIds: string[] = [];
      (getSupabaseAdmin as jest.Mock).mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-add-fail', shop_id: 'shop-madbike', status: 'pending' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'item-add-fail',
                      proposal_id: 'prop-add-fail',
                      entity_type: 'motorcycle',
                      action: 'add',
                      entity_id: null,
                      brand_name: 'Honda',
                      model_name: 'Lead 125',
                      proposed_data: {
                        brand: 'Honda',
                        modelName: 'Lead 125',
                        year: 2024,
                        rates: [{ minDays: 1, ratePerDay: 300, currency: 'THB' }],
                        conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: 'THB 3,000' }],
                      },
                      status: 'pending',
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [{ id: SECURITY_DEPOSIT_ID, name: 'Security Deposit' }],
                error: null,
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
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: 'bike-orphan-add' }, error: null }),
                }),
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, id: string) => {
                  deletedMotorcycleIds.push(id);
                  return Promise.resolve({ error: null });
                }),
              }),
            };
          }
          if (table === 'rental_rate_tiers') {
            return {
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'motorcycle_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
              insert: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Condition insert failed on add' },
              }),
            };
          }
          return {};
        }),
      });

      await expect(
        ChangeProposalService.apply('prop-add-fail', ['item-add-fail'])
      ).rejects.toThrow(/Condition insert failed on add/i);

      expect(deletedMotorcycleIds).toEqual(['bike-orphan-add']);
    });

    it('applies the 7-bike MadBike Sathon deposit corrective batch while preserving all 19 rental-price rows', async () => {
      const madBikeFleet = [
        {
          id: '4f35ffbd-6a21-4090-a7d0-94bf6f95f97e',
          brand: 'Yamaha',
          model: 'Filano 110',
          deposit: 'THB 3,000',
          tiers: [
            { min_days: 1, max_days: 6, rate_per_day: 200, currency: 'THB' },
            { min_days: 7, max_days: 29, rate_per_day: 129, currency: 'THB' },
            { min_days: 30, max_days: null, rate_per_day: 83, currency: 'THB' },
          ],
        },
        {
          id: '04be528a-fa1b-4cf1-ba31-e7535ef94e6f',
          brand: 'Honda',
          model: 'Scoopy i',
          deposit: 'THB 3,000',
          tiers: [
            { min_days: 1, max_days: 6, rate_per_day: 200, currency: 'THB' },
            { min_days: 7, max_days: 29, rate_per_day: 143, currency: 'THB' },
            { min_days: 30, max_days: null, rate_per_day: 100, currency: 'THB' },
          ],
        },
        {
          id: 'f9734329-0b8d-494f-bfba-a3c74986d60e',
          brand: 'Honda',
          model: 'Click 125',
          deposit: 'THB 3,000',
          tiers: [
            { min_days: 1, max_days: 6, rate_per_day: 250, currency: 'THB' },
            { min_days: 7, max_days: 29, rate_per_day: 157, currency: 'THB' },
            { min_days: 30, max_days: null, rate_per_day: 110, currency: 'THB' },
          ],
        },
        {
          id: '37dc0cf0-8fa6-4c36-bd61-065845d2a7ad',
          brand: 'Yamaha',
          model: 'Grand Filano',
          deposit: 'THB 3,000',
          tiers: [
            { min_days: 1, max_days: 6, rate_per_day: 300, currency: 'THB' },
            { min_days: 7, max_days: 29, rate_per_day: 214, currency: 'THB' },
            { min_days: 30, max_days: null, rate_per_day: 150, currency: 'THB' },
          ],
        },
        {
          id: '92e8db1a-e526-4475-8ac5-a54015c0c988',
          brand: 'Yamaha',
          model: 'Aerox 155 ABS',
          deposit: 'THB 5,000',
          tiers: [
            { min_days: 1, max_days: 6, rate_per_day: 400, currency: 'THB' },
            { min_days: 7, max_days: 29, rate_per_day: 286, currency: 'THB' },
            { min_days: 30, max_days: null, rate_per_day: 167, currency: 'THB' },
          ],
        },
        {
          id: '041d2e84-bf4f-4483-b044-16998a3eb63c',
          brand: 'Yamaha',
          model: 'NMAX 155 ABS',
          deposit: 'THB 5,000',
          tiers: [
            { min_days: 1, max_days: 6, rate_per_day: 400, currency: 'THB' },
            { min_days: 7, max_days: 29, rate_per_day: 286, currency: 'THB' },
            { min_days: 30, max_days: null, rate_per_day: 167, currency: 'THB' },
          ],
        },
        {
          id: '33d9d4ab-00c5-42de-87bb-b310fc9b1d70',
          brand: 'Vespa',
          model: 'Vespa LX125',
          deposit: 'THB 10,000',
          tiers: [
            { min_days: 30, max_days: null, rate_per_day: 183, currency: 'THB' },
          ],
        },
      ];

      // Seed 19 live rental_rate_tiers rows across the 7 bikes
      const liveRateTiers = new Map<string, any[]>(
        madBikeFleet.map((b) => [
          b.id,
          b.tiers.map((t) => ({ motorcycle_id: b.id, ...t })),
        ])
      );
      const liveConditions = new Map<string, any[]>(madBikeFleet.map((b) => [b.id, []]));

      const itemsData = madBikeFleet.map((b, idx) => ({
        id: `item-madbike-${idx}`,
        proposal_id: 'prop-madbike-deposits',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: b.id,
        brand_name: b.brand,
        model_name: b.model,
        original_data: {
          brand: b.brand,
          model: b.model,
          conditions: [],
        },
        proposed_data: {
          brand: b.brand,
          model: b.model,
          conditions: [{ condition_type_id: SECURITY_DEPOSIT_ID, notes: b.deposit }],
        },
        diff_summary: null,
        status: 'pending',
      }));

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'change_proposals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'prop-madbike-deposits',
                      shop_id: '1a0e00c2-d41c-430f-b6ac-cf17c2879fee',
                      status: 'pending',
                    },
                    error: null,
                  }),
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
          if (table === 'condition_types') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [{ id: SECURITY_DEPOSIT_ID, name: 'Security Deposit' }],
                error: null,
              }),
            };
          }
          if (table === 'brands') {
            return {
              select: jest.fn().mockReturnValue({
                ilike: jest.fn((_col: string, name: string) => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: `brand-${name.toLowerCase()}` },
                    error: null,
                  }),
                })),
              }),
            };
          }
          if (table === 'motorcycle_rentals') {
            return {
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'rental_rate_tiers') {
            return {
              delete: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) => {
                  liveRateTiers.set(bikeId, []);
                  return Promise.resolve({ error: null });
                }),
              }),
              insert: jest.fn((rows: any[]) => {
                for (const r of rows) {
                  const list = liveRateTiers.get(r.motorcycle_id) || [];
                  list.push(r);
                  liveRateTiers.set(r.motorcycle_id, list);
                }
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === 'motorcycle_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) =>
                  Promise.resolve({
                    data: [...(liveConditions.get(bikeId) || [])],
                    error: null,
                  })
                ),
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) => {
                  liveConditions.set(bikeId, []);
                  return Promise.resolve({ error: null });
                }),
              }),
              insert: jest.fn((rows: any[]) => {
                for (const r of rows) {
                  const list = liveConditions.get(r.motorcycle_id) || [];
                  list.push(r);
                  liveConditions.set(r.motorcycle_id, list);
                }
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await ChangeProposalService.apply(
        'prop-madbike-deposits',
        itemsData.map((i) => i.id)
      );

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(7);

      // Verify all 7 bikes have their exact Security Deposit in motorcycle_conditions
      for (const bike of madBikeFleet) {
        expect(liveConditions.get(bike.id)).toEqual([
          {
            motorcycle_id: bike.id,
            condition_type_id: SECURITY_DEPOSIT_ID,
            notes: bike.deposit,
          },
        ]);
      }

      // Verify all 19 rental-price rows across the 7 bikes are preserved
      const totalRateRows = Array.from(liveRateTiers.values()).reduce(
        (sum, tiers) => sum + tiers.length,
        0
      );
      expect(totalRateRows).toBe(19);
    });

    it('accepts valid condition_type_id outside the first 100 condition_types rows (508-row catalog) in both staging and approval, while rejecting nonexistent IDs and name-spoofing (#160)', async () => {
      // Build a 508-row catalog matching production where Security Deposit sits at index 431 (> 100)
      const catalog508 = Array.from({ length: 508 }, (_, idx) => {
        if (idx === 431) {
          return {
            id: SECURITY_DEPOSIT_ID,
            name: 'Security Deposit',
          };
        }
        return {
          id: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
          name: `Condition Type #${idx + 1}`,
        };
      });

      const stagedItems: any[] = [];
      const inCalls: string[][] = [];
      const liveConditions = new Map<string, any[]>([['bike-fatboys-1', []]]);

      const createCatalogQueryMock = (includeIn = true) => ({
        select: jest.fn(() => {
          const builder: any = {
            limit: jest.fn((n: number) =>
              Promise.resolve({
                data: catalog508.slice(0, n),
                error: null,
              })
            ),
            range: jest.fn((from: number, to: number) =>
              Promise.resolve({
                data: catalog508.slice(from, to + 1),
                error: null,
              })
            ),
          };
          if (includeIn) {
            builder.in = jest.fn((_col: string, ids: string[]) => {
              inCalls.push(ids);
              const idSet = new Set(ids);
              return Promise.resolve({
                data: catalog508.filter((row) => idSet.has(row.id)),
                error: null,
              });
            });
          }
          return builder;
        }),
      });

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'condition_types') {
            return createCatalogQueryMock(true);
          }
          if (table === 'motorcycle_rentals') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: [{ id: 'bike-fatboys-1', shop_id: 'shop-fatboys' }],
                  error: null,
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposals') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-fatboys-160', shop_id: 'shop-fatboys', status: 'pending' },
                    error: null,
                  }),
                }),
              }),
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'prop-fatboys-160', shop_id: 'shop-fatboys', status: 'pending' },
                    error: null,
                  }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'change_proposal_items') {
            return {
              insert: jest.fn((rows: any[]) => {
                stagedItems.push(
                  ...rows.map((r, i) => ({
                    id: `staged-item-${i + 1}`,
                    ...r,
                  }))
                );
                return Promise.resolve({ error: null });
              }),
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockImplementation(() =>
                  Promise.resolve({ data: [...stagedItems], error: null })
                ),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
                in: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'motorcycle_conditions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) =>
                  Promise.resolve({
                    data: [...(liveConditions.get(bikeId) || [])],
                    error: null,
                  })
                ),
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn((_col: string, bikeId: string) => {
                  liveConditions.set(bikeId, []);
                  return Promise.resolve({ error: null });
                }),
              }),
              insert: jest.fn((rows: any[]) => {
                for (const r of rows) {
                  const list = liveConditions.get(r.motorcycle_id) || [];
                  list.push({
                    motorcycle_id: r.motorcycle_id,
                    condition_type_id: r.condition_type_id,
                    notes: r.notes ?? null,
                  });
                  liveConditions.set(r.motorcycle_id, list);
                }
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // 1. Valid ID at index 431 (> 100) is accepted in staging and preserved with canonical name + notes
      const stagedRes = await ChangeProposalService.createProposalFromItems({
        shopId: 'shop-fatboys',
        sourceUrl: 'https://fatboysmotorbikes.com/',
        items: [
          {
            entityType: 'motorcycle',
            action: 'update',
            entityId: 'bike-fatboys-1',
            brandName: 'Honda',
            modelName: 'Click 125i',
            originalData: {
              conditions: [],
            },
            proposedData: {
              conditions: [
                {
                  condition_type_id: SECURITY_DEPOSIT_ID,
                  name: 'Untrusted Client Label',
                  notes: 'THB 3,000 or Passport',
                },
              ],
            },
          },
        ],
      });

      expect(stagedRes.proposal.id).toBe('prop-fatboys-160');
      expect(inCalls.length).toBeGreaterThanOrEqual(1);
      expect(inCalls[0]).toEqual([SECURITY_DEPOSIT_ID]);
      expect(stagedItems).toHaveLength(1);
      expect(stagedItems[0].proposed_data.conditions).toEqual([
        {
          condition_type_id: SECURITY_DEPOSIT_ID,
          name: 'Security Deposit',
          notes: 'THB 3,000 or Passport',
        },
      ]);

      // 2. Nonexistent ID is rejected even when client provides a valid condition name
      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-fatboys',
          sourceUrl: 'https://fatboysmotorbikes.com/',
          items: [
            {
              entityType: 'motorcycle',
              action: 'update',
              entityId: 'bike-fatboys-1',
              brandName: 'Honda',
              modelName: 'Click 125i',
              proposedData: {
                conditions: [
                  {
                    condition_type_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                    name: 'Security Deposit',
                    notes: 'THB 3,000',
                  },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/Invalid condition_type_id 'ffffffff-ffff-4fff-8fff-ffffffffffff'/i);

      // 3. Omitting condition_type_id and supplying only a client name is rejected in proposedData.conditions
      await expect(
        ChangeProposalService.createProposalFromItems({
          shopId: 'shop-fatboys',
          sourceUrl: 'https://fatboysmotorbikes.com/',
          items: [
            {
              entityType: 'motorcycle',
              action: 'update',
              entityId: 'bike-fatboys-1',
              brandName: 'Honda',
              modelName: 'Click 125i',
              proposedData: {
                conditions: [
                  {
                    name: 'Security Deposit',
                    notes: 'THB 3,000',
                  },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/condition_type_id is required/i);

      // 4. Approval validation (ChangeProposalService.apply) uses the same complete lookup and persists the condition
      const applyRes = await ChangeProposalService.apply('prop-fatboys-160', ['staged-item-1']);
      expect(applyRes.success).toBe(true);
      expect(applyRes.appliedCount).toBe(1);
      expect(liveConditions.get('bike-fatboys-1')).toEqual([
        {
          motorcycle_id: 'bike-fatboys-1',
          condition_type_id: SECURITY_DEPOSIT_ID,
          notes: 'THB 3,000 or Passport',
        },
      ]);

      // 5. Fallback catalog pagination via .range() also resolves condition_type_id beyond row 100
      const paginatedSupabase = {
        ...mockSupabase,
        from: jest.fn((table: string) => {
          if (table === 'condition_types') {
            return createCatalogQueryMock(false);
          }
          return mockSupabase.from(table);
        }),
      };
      (getSupabaseAdmin as jest.Mock).mockReturnValue(paginatedSupabase);

      const paginatedStageRes = await ChangeProposalService.createProposalFromItems({
        shopId: 'shop-fatboys',
        sourceUrl: 'https://fatboysmotorbikes.com/',
        items: [
          {
            entityType: 'motorcycle',
            action: 'update',
            entityId: 'bike-fatboys-1',
            brandName: 'Honda',
            modelName: 'Click 125i',
            proposedData: {
              conditions: [
                {
                  condition_type_id: SECURITY_DEPOSIT_ID,
                  notes: 'THB 4,000',
                },
              ],
            },
          },
        ],
      });
      expect(paginatedStageRes.proposal.id).toBe('prop-fatboys-160');
    });
  });
});



