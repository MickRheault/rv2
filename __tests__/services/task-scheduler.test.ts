/**
 * @jest-environment node
 */

import {
  calculateUrgencyScore,
  CADENCE_DAYS,
  TaskSchedulerService,
} from '@/services/task-scheduler';

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
});
