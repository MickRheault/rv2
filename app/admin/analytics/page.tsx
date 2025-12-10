export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { getAnalyticsData, AnalyticsData } from '@/services/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';
import HistoricalAnalyticsCharts from '@/components/admin/HistoricalAnalyticsCharts';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-bold">{value}</p>
    </CardContent>
  </Card>
);

const AnalyticsDashboardPage = async () => {
  const analyticsData: AnalyticsData = await getAnalyticsData();

  const {
    overviewStats,
    dataFreshness,
    flaggedContent,
    geographicDistribution,
    categoryDistribution,
    brandDistribution,
    premiumListings,
  } = analyticsData;

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="mr-4">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        </div>

        {/* Business Overview */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Business Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {overviewStats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Data Quality */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Data Quality</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Data Freshness</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-600">{dataFreshness.fresh_percentage}%</p>
                      <p className="text-sm text-gray-500">Fresh</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-yellow-600">{dataFreshness.stale_percentage}%</p>
                      <p className="text-sm text-gray-500">Stale</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-600">{dataFreshness.very_stale_percentage}%</p>
                      <p className="text-sm text-gray-500">Very Stale</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Flagged Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Total Flags: <span className="font-bold">{flaggedContent.total}</span></p>
                  <Link href="/admin/flagged-content" className="text-blue-500 hover:underline">
                    Manage Flags
                  </Link>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Premium Listings */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Premium Listings</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Premium Listings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{premiumListings.total_active_listings}</p>
                  <p>Revenue This Month: <span className="font-bold">${premiumListings.revenue_this_month.toFixed(2)}</span></p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
        
        {/* Geographic Distribution */}
        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Top 10 Rental Shop Locations</h2>
          <Card>
            <CardContent className="pt-6">
              <ul className="divide-y divide-gray-200">
                {geographicDistribution.map((loc, index) => (
                  <li key={index} className="py-2 flex justify-between">
                    <span>{loc.city}, {loc.country}</span>
                    <Badge variant="secondary">{loc.shop_count} shops</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Category & Brand Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Distribution by Category</h2>
            <Card>
              <CardContent className="pt-6">
                <ul className="divide-y divide-gray-200">
                  {categoryDistribution.map((cat, index) => (
                    <li key={index} className="py-2">
                      <div className="flex justify-between">
                        <span>{cat.category}</span>
                        <Badge variant="secondary">{cat.count} bikes</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Distribution by Brand</h2>
            <Card>
              <CardContent className="pt-6">
                <ul className="divide-y divide-gray-200">
                  {brandDistribution.map((brand, index) => (
                    <li key={index} className="py-2">
                      <div className="flex justify-between">
                        <span>{brand.brand}</span>
                        <Badge variant="secondary">{brand.count} bikes</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>

        <HistoricalAnalyticsCharts />

      </div>
  );
};

export default AnalyticsDashboardPage; 