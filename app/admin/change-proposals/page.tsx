'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, Button, Badge, Spinner, Alert, Select } from '@/components/ui';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface ProposalSummaryItem {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug?: string;
  agentRunId?: string | null;
  sourceUrl: string;
  status: 'pending' | 'reviewing' | 'applied' | 'partially_applied' | 'rejected';
  summaryCounts: {
    add: number;
    update: number;
    delist: number;
  };
  createdAt: string;
  reviewedAt?: string | null;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'applied', label: 'Applied' },
  { value: 'partially_applied', label: 'Partially Applied' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ChangeProposalsPage() {
  const [proposals, setProposals] = useState<ProposalSummaryItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/change-proposals?status=${statusFilter}&limit=50`);
      if (!res.ok) {
        throw new Error(`Failed to load proposals (status: ${res.status})`);
      }
      const json = await res.json();
      setProposals(json.proposals || []);
      setTotalCount(json.totalCount || 0);
    } catch (err: any) {
      console.error('Error fetching proposals:', err);
      setError(err.message || 'Error loading proposals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const getStatusBadge = (status: ProposalSummaryItem['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'applied':
        return <Badge variant="success">Applied</Badge>;
      case 'partially_applied':
        return <Badge variant="info">Partially Applied</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/admin"
              className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="w-7 h-7 text-indigo-600" />
            Shop Change Proposals
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review scraped inventory additions, updates, and delistings submitted by external agents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
          />
          <Button
            variant="outline"
            onClick={fetchProposals}
            disabled={loading}
            title="Refresh List"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Main List */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner size="lg" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-gray-500 text-base">No change proposals found matching current filter.</p>
            <p className="text-gray-400 text-sm">
              When external crawler agents run, incoming diffs will appear here for review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rental Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Crawl Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proposed Mutations
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proposals.map((prop) => (
                  <tr key={prop.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{prop.shopName}</div>
                      <a
                        href={prop.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-0.5 truncate max-w-xs"
                      >
                        {prop.sourceUrl}
                        <ArrowTopRightOnSquareIcon className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(prop.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(prop.status)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {prop.summaryCounts.add > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                            +{prop.summaryCounts.add} new
                          </span>
                        )}
                        {prop.summaryCounts.update > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            ~{prop.summaryCounts.update} updated
                          </span>
                        )}
                        {prop.summaryCounts.delist > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            -{prop.summaryCounts.delist} delisted
                          </span>
                        )}
                        {prop.summaryCounts.add === 0 &&
                          prop.summaryCounts.update === 0 &&
                          prop.summaryCounts.delist === 0 && (
                            <span className="text-xs text-gray-400">No changes detected</span>
                          )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link
                        href={`/admin/change-proposals/${prop.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Inspect Diff
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
