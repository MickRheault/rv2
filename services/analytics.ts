import { supabase } from '@/lib/supabase/client';
import { FlaggedContentService } from './flagged-content';
import { DataFreshnessService } from './data-freshness';
import { PremiumAnalyticsService, PremiumListingsService } from './premium-listings';
import { Database } from '@/lib/supabase/database.types';
import { DataFreshnessStats } from './data-freshness';
import { FlaggedContentWithChanges } from '@/types/flagged-content';
import { PremiumDashboardStats } from '@/types/premium-listings';

export type AnalyticsSnapshot = {
  id: number;
  snapshot_date: string;
  data: AnalyticsData;
  created_at: string;
};

type OverviewStat = {
  label: string;
  value: number;
  change?: number;
};

type GeographicDistribution = {
  country: string;
  city: string;
  shop_count: number;
}[];

type CategoryDistribution = {
  category: string;
  count: number;
  avg_price: number;
  avg_engine_size: number;
}[];

type BrandDistribution = {
  brand: string;
  count: number;
  avg_price: number;
  avg_engine_size: number;
}[];

export type AnalyticsData = {
  overviewStats: OverviewStat[];
  dataFreshness: DataFreshnessStats;
  flaggedContent: {
    total: number;
    motorcycles: FlaggedContentWithChanges[];
    shops: FlaggedContentWithChanges[];
  };
  geographicDistribution: GeographicDistribution;
  categoryDistribution: CategoryDistribution;
  brandDistribution: BrandDistribution;
  premiumListings: PremiumDashboardStats;
};

export const getAnalyticsData = async (): Promise<AnalyticsData> => {
  const [
    totalShops,
    totalMotorcycles,
    totalBrands,
    totalCategories,
    dataFreshness,
    flaggedContentStats,
    flaggedMotorcycles,
    flaggedShops,
    geographicDistribution,
    categoryDistribution,
    brandDistribution,
    premiumListings,
  ] = await Promise.all([
    supabase.from('rental_shops').select('id', { count: 'exact' }),
    supabase.from('motorcycle_rentals').select('id', { count: 'exact' }),
    supabase.from('brands').select('id', { count: 'exact' }),
    supabase.from('categories').select('id', { count: 'exact' }),
    DataFreshnessService.getDataFreshnessStats(),
    FlaggedContentService.getFlaggedContentStats(),
    FlaggedContentService.getFlaggedContent('pending', 'motorcycle', 5, 0),
    FlaggedContentService.getFlaggedContent('pending', 'rental_shop', 5, 0),
    supabase.rpc('get_geographic_distribution'),
    supabase.rpc('get_category_distribution'),
    supabase.rpc('get_brand_distribution'),
    PremiumListingsService.getDashboardStats(),
  ]);

  if (
    geographicDistribution.error ||
    categoryDistribution.error ||
    brandDistribution.error
  ) {
    console.error(
      'Error fetching RPC data:',
      geographicDistribution.error ||
        categoryDistribution.error ||
        brandDistribution.error
    );
    throw new Error('Failed to fetch analytics data from RPCs.');
  }

  const overviewStats: OverviewStat[] = [
    { label: 'Total Rental Shops', value: totalShops.count ?? 0 },
    { label: 'Total Motorcycles', value: totalMotorcycles.count ?? 0 },
    { label: 'Total Brands', value: totalBrands.count ?? 0 },
    { label: 'Total Categories', value: totalCategories.count ?? 0 },
  ];

  const flaggedContent = {
    total:
      (flaggedContentStats.total_pending ?? 0) +
      (flaggedContentStats.total_under_review ?? 0) +
      (flaggedContentStats.total_approved ?? 0) +
      (flaggedContentStats.total_applied ?? 0) +
      (flaggedContentStats.total_rejected ?? 0),
    motorcycles: flaggedMotorcycles,
    shops: flaggedShops,
  };

  return {
    overviewStats,
    dataFreshness,
    flaggedContent,
    geographicDistribution:
      (geographicDistribution.data as unknown as GeographicDistribution) ?? [],
    categoryDistribution:
      (categoryDistribution.data as unknown as CategoryDistribution) ?? [],
    brandDistribution:
      (brandDistribution.data as unknown as BrandDistribution) ?? [],
    premiumListings,
  };
};

export const getHistoricalAnalytics = async (
  days = 30
): Promise<AnalyticsSnapshot[]> => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const fromDate = date.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .gte('snapshot_date', fromDate)
    .order('snapshot_date', { ascending: true });

  if (error) {
    console.error('Error fetching historical analytics:', error);
    throw new Error('Failed to fetch historical analytics data.');
  }

  return data as unknown as AnalyticsSnapshot[];
};

export const triggerSnapshot = async (): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('insert_daily_snapshot');

  if (error) {
    console.error('Error triggering snapshot:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}; 