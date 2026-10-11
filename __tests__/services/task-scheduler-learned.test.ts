/**
 * @jest-environment node
 */

import { TaskSchedulerService } from '@/services/task-scheduler';
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
      expect(result.extraction_hints).toBe('Prices in THB');
      expect(result.source_url).toBe('https://shop.com/rates');
    });
  });

  describe('updateLearnedConfig', () => {
    it('updates extraction_hints and source_url by shopId', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          shop_id: 'shop-abc',
          extraction_hints: 'Deposit 2000 THB cash',
          source_url: 'https://shop.com/fleet',
        },
        error: null,
      });

      const result = await TaskSchedulerService.updateLearnedConfig(
        { shopId: 'shop-abc' },
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
      expect(result.extraction_hints).toBe('Deposit 2000 THB cash');
    });

    it('returns null when no updates are provided', async () => {
      const result = await TaskSchedulerService.updateLearnedConfig(
        { shopId: 'shop-abc' },
        { extractionHints: '', discoveredSourceUrl: null }
      );

      expect(result).toBeNull();
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });
});
