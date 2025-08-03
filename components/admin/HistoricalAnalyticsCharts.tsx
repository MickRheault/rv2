'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getHistoricalAnalytics, AnalyticsSnapshot } from '@/services/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';

type ChartData = {
  date: string;
  totalShops: number;
  totalMotorcycles: number;
  revenue: number;
};

const HistoricalAnalyticsCharts = () => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshots: AnalyticsSnapshot[] = await getHistoricalAnalytics(30);
        
        const formattedData = snapshots.map((snapshot) => {
            const overviewShops = snapshot.data.overviewStats.find(s => s.label === 'Total Rental Shops')?.value ?? 0;
            const overviewMotorcycles = snapshot.data.overviewStats.find(s => s.label === 'Total Motorcycles')?.value ?? 0;
            const revenue = snapshot.data.premiumListings.revenue_this_month ?? 0;

            return {
                date: new Date(snapshot.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                totalShops: overviewShops,
                totalMotorcycles: overviewMotorcycles,
                revenue: revenue,
            };
        });
        
        setData(formattedData);
      } catch (e) {
        setError('Failed to load historical data.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Historical Trends (Last 30 Days)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Shops Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalShops" name="Total Shops" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Motorcycles Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalMotorcycles" name="Total Motorcycles" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Premium Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Monthly Revenue" stroke="#ffc658" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default HistoricalAnalyticsCharts; 