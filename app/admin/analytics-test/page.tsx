'use client';

import { useEffect, useState } from 'react';
import { getHistoricalAnalytics, AnalyticsSnapshot, triggerSnapshot } from '@/services/analytics';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui';
import Spinner from '@/components/ui/Spinner';

const HistoricalAnalyticsTestPage = () => {
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const data = await getHistoricalAnalytics(90);
      setSnapshots(data);
    } catch (e) {
      setError('Failed to load snapshots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const handleTriggerSnapshot = async () => {
    setIsTriggering(true);
    setTriggerStatus(null);
    const result = await triggerSnapshot();
    if (result.success) {
      setTriggerStatus('Successfully created a new snapshot!');
      await fetchSnapshots(); // Refresh the data
    } else {
      setTriggerStatus(`Error: ${result.error}`);
    }
    setIsTriggering(false);
  };

  return (
    <AdminRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Historical Analytics Test</h1>
        <p className="mb-4">
          This page displays the raw daily snapshots captured by the cron job.
        </p>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Manual Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Click the button below to manually generate a new analytics snapshot for today.</p>
            <Button onClick={handleTriggerSnapshot} disabled={isTriggering}>
              {isTriggering ? <Spinner /> : 'Generate Snapshot'}
            </Button>
            {triggerStatus && (
              <p className={`mt-4 text-sm ${triggerStatus.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {triggerStatus}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Analytics Snapshots ({snapshots.length} found in last 90 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Spinner />
              </div>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Snapshot Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Shops
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Motorcycles
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending Flags
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Active Premium
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {snapshots.map((snapshot) => (
                      <tr key={snapshot.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(snapshot.snapshot_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {snapshot.data.overviewStats.find(s => s.label === 'Total Rental Shops')?.value ?? 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {snapshot.data.overviewStats.find(s => s.label === 'Total Motorcycles')?.value ?? 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {snapshot.data.flaggedContent.total ?? 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {snapshot.data.premiumListings.total_active_listings ?? 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default HistoricalAnalyticsTestPage; 