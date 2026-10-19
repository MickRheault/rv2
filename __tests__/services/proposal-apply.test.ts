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

    it('preserves already-applied items on partial retry without re-inserting duplicates or overwriting them to rejected (#153)', async () => {
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
                ilike: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'brand-honda' }, error: null }),
                }),
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

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // Caller passes an already-applied item ID AND one of the remaining pending item IDs,
      // while omitting the other already-applied item ID (since it was unchecked in the UI)
      // and omitting item-remaining-pending-reject.
      const res = await ChangeProposalService.apply('prop-partial-retry', [
        'item-already-applied-add',
        'item-remaining-pending-add',
      ]);

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(1);

      // Must ONLY insert the pending add item ("Click 160"), NEVER re-insert "Moove 110"
      expect(insertedMotorcycles).toHaveLength(1);
      expect(insertedMotorcycles[0].model).toBe('Click 160');
      expect(updatedMotorcycles).toHaveLength(0);

      // Must ONLY mark the unapproved PENDING item as rejected, NEVER overwrite item-already-applied-update
      expect(rejectedItemIds).toEqual(['item-remaining-pending-reject']);
      expect(finalProposalUpdate.status).toBe('partially_applied');
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
                ilike: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'brand-yamaha' }, error: null }),
                }),
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
          return {};
        }),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      // UI only sends the remaining pending item ID ('item-pending-2')
      const res = await ChangeProposalService.apply('prop-finish-retry', ['item-pending-2']);

      expect(res.success).toBe(true);
      expect(res.appliedCount).toBe(1);
      expect(res.status).toBe('applied');
      expect(rejectedItemIds).toEqual([]);
      expect(finalProposalUpdate.status).toBe('applied');
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
                ilike: jest.fn((_col: string, name: string) => ({
                  maybeSingle: jest.fn().mockImplementation(async () => {
                    brandQueryCount++;
                    return { data: { id: `brand-${name.toLowerCase()}` }, error: null };
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
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };

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
});


