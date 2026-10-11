/**
 * @jest-environment node
 */

import { TaskSchedulerService } from '@/services/task-scheduler';
import {
  updateShopLearnedConfig,
  extractLearnedAgentConfig,
} from '@/services/shop-agent-configs';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

describe('TaskSchedulerService Adaptive Learning', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('updateTaskStatus with learned config', () => {
    it('updates extraction_hints and source_url when learnedConfig is provided', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'task-1', consecutive_errors: 0 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'task-1',
            last_run_at: '2026-10-11T00:00:00.000Z',
            extraction_hints: 'Prices in THB',
            source_url: 'https://shop.com/rates',
          },
          error: null,
        });

      const result = await TaskSchedulerService.updateTaskStatus(
        'task-1',
        'success',
        undefined,
        {
          extractionHints: 'Prices in THB',
          discoveredSourceUrl: 'https://shop.com/rates',
        }
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_error: null,
          consecutive_errors: 0,
          extraction_hints: 'Prices in THB',
          source_url: 'https://shop.com/rates',
        })
      );
      expect(result?.extraction_hints).toBe('Prices in THB');
      expect(result?.source_url).toBe('https://shop.com/rates');
    });
  });

  describe('extractLearnedAgentConfig', () => {
    it('extracts learned hints and discovered URL when valid strings are provided', () => {
      const config = extractLearnedAgentConfig({
        learnedExtractionHints: '  Rates in THB  ',
        discoveredSourceUrl: '  https://shop.com/rates  ',
      });
      expect(config).toEqual({
        extractionHints: 'Rates in THB',
        discoveredSourceUrl: 'https://shop.com/rates',
      });
    });

    it('falls back to extractionHints and ignores empty strings or non-strings', () => {
      const config = extractLearnedAgentConfig({
        extractionHints: 'Deposit 2000',
        discoveredSourceUrl: 12345,
      });
      expect(config).toEqual({
        extractionHints: 'Deposit 2000',
        discoveredSourceUrl: undefined,
      });
    });

    it('returns undefined when no hints or discovered URL are present', () => {
      expect(extractLearnedAgentConfig({})).toBeUndefined();
      expect(extractLearnedAgentConfig({ learnedExtractionHints: '   ' })).toBeUndefined();
    });
  });

  describe('updateShopLearnedConfig', () => {
    it('updates extraction_hints and source_url by shopId', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          shop_id: 'shop-abc',
          extraction_hints: 'Deposit 2000 THB cash',
          source_url: 'https://shop.com/fleet',
        },
        error: null,
      });

      const result = await updateShopLearnedConfig(
        'shop-abc',
        {
          extractionHints: 'Deposit 2000 THB cash',
          discoveredSourceUrl: 'https://shop.com/fleet',
        }
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('shop_agent_configs');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        extraction_hints: 'Deposit 2000 THB cash',
        source_url: 'https://shop.com/fleet',
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('shop_id', 'shop-abc');
      expect(result?.extraction_hints).toBe('Deposit 2000 THB cash');
    });

    it('returns null when no updates are provided', async () => {
      const result = await updateShopLearnedConfig(
        'shop-abc',
        { extractionHints: '', discoveredSourceUrl: null }
      );

      expect(result).toBeNull();
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('safely handles non-string inputs without throwing TypeError', async () => {
      const result = await updateShopLearnedConfig(
        'shop-abc',
        { extractionHints: 12345 as any, discoveredSourceUrl: { url: 'bad' } as any }
      );

      expect(result).toBeNull();
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('upserts a new Tier 2 config when no existing config row exists for the shop', async () => {
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // update query
        .mockResolvedValueOnce({ data: { website: 'https://shop.com' }, error: null }) // rental_shops query
        .mockResolvedValueOnce({
          data: {
            shop_id: 'shop-new',
            tier: 2,
            source_url: 'https://shop.com/rates',
            extraction_hints: 'Learned hints',
            is_active: true,
          },
          error: null,
        }); // upsert query

      mockSupabase.upsert = jest.fn().mockReturnThis();

      const result = await updateShopLearnedConfig(
        'shop-new',
        {
          extractionHints: 'Learned hints',
          discoveredSourceUrl: 'https://shop.com/rates',
        }
      );

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        {
          shop_id: 'shop-new',
          tier: 2,
          source_url: 'https://shop.com/rates',
          extraction_hints: 'Learned hints',
          is_active: true,
        },
        { onConflict: 'shop_id' }
      );
      expect(result?.tier).toBe(2);
    });
  });
});
