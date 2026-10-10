'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, Button, Badge, Spinner, Alert, Select, Modal } from '@/components/ui';
import { shopService } from '@/services/shops';
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

interface CrawlRunItem {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug?: string | null;
  proposalId?: string | null;
  proposalSummaryCounts?: {
    add: number;
    update: number;
    delist: number;
  } | null;
  agentRunId?: string | null;
  status: 'success' | 'failed';
  errorMessage?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

const PROPOSAL_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'applied', label: 'Applied' },
  { value: 'partially_applied', label: 'Partially Applied' },
  { value: 'rejected', label: 'Rejected' },
];

const CRAWLER_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Runs' },
  { value: 'failed', label: 'Failures Only' },
  { value: 'success', label: 'Success Only' },
];

export default function ChangeProposalsPage() {
  const [activeTab, setActiveTab] = useState<'proposals' | 'crawler-logs'>('proposals');

  // Proposals state
  const [proposals, setProposals] = useState<ProposalSummaryItem[]>([]);
  const [proposalTotalCount, setProposalTotalCount] = useState<number>(0);
  const [proposalStatusFilter, setProposalStatusFilter] = useState<string>('pending');
  const [loadingProposals, setLoadingProposals] = useState<boolean>(true);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Crawler logs state
  const [crawlerRuns, setCrawlerRuns] = useState<CrawlRunItem[]>([]);
  const [crawlerTotalCount, setCrawlerTotalCount] = useState<number>(0);
  const [crawlerStatusFilter, setCrawlerStatusFilter] = useState<string>('all');
  const [crawlerShopFilter, setCrawlerShopFilter] = useState<string>('all');
  const [shops, setShops] = useState<{ id: string; provider_name: string }[]>([]);
  const [loadingCrawler, setLoadingCrawler] = useState<boolean>(false);
  const [crawlerError, setCrawlerError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<CrawlRunItem | null>(null);

  useEffect(() => {
    async function loadShops() {
      try {
        const data = await shopService.getAllShopsForDropdown();
        setShops(data || []);
      } catch (err) {
        console.error('Failed to load shops for filter:', err);
      }
    }
    loadShops();
  }, []);

  const shopFilterOptions = [
    { value: 'all', label: 'All Shops' },
    ...shops.map((s) => ({ value: s.id, label: s.provider_name })),
  ];

  const fetchProposals = useCallback(async () => {
    setLoadingProposals(true);
    setProposalError(null);

    try {
      const res = await fetch(`/api/admin/change-proposals?status=${proposalStatusFilter}&limit=50`);
      if (!res.ok) {
        throw new Error(`Failed to load proposals (status: ${res.status})`);
      }
      const json = await res.json();
      setProposals(json.proposals || []);
      setProposalTotalCount(json.totalCount || 0);
    } catch (err: any) {
      console.error('Error fetching proposals:', err);
      setProposalError(err.message || 'Error loading proposals');
    } finally {
      setLoadingProposals(false);
    }
  }, [proposalStatusFilter]);

  const fetchCrawlerRuns = useCallback(async () => {
    setLoadingCrawler(true);
    setCrawlerError(null);

    try {
      const params = new URLSearchParams({
        status: crawlerStatusFilter,
        limit: '50',
      });
      if (crawlerShopFilter && crawlerShopFilter !== 'all') {
        params.set('shopId', crawlerShopFilter);
      }
      const res = await fetch(`/api/admin/crawler-logs?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load crawler logs (status: ${res.status})`);
      }
      const json = await res.json();
      setCrawlerRuns(json.runs || []);
      setCrawlerTotalCount(json.totalCount || 0);
    } catch (err: any) {
      console.error('Error fetching crawler logs:', err);
      setCrawlerError(err.message || 'Error loading crawler logs');
    } finally {
      setLoadingCrawler(false);
    }
  }, [crawlerStatusFilter, crawlerShopFilter]);

  useEffect(() => {
    if (activeTab === 'proposals') {
      fetchProposals();
    } else {
      fetchCrawlerRuns();
    }
  }, [activeTab, fetchProposals, fetchCrawlerRuns]);

  const getProposalStatusBadge = (status: ProposalSummaryItem['status']) => {
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

  const getCrawlerStatusBadge = (status: CrawlRunItem['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="success">Success</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
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
            Shop Change Proposals & Crawler Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review scraped inventory changes and monitor background crawler execution.
          </p>
        </div>

        {/* Tab-specific toolbar */}
        {activeTab === 'proposals' ? (
          <div className="flex items-center gap-3">
            <Select
              options={PROPOSAL_STATUS_FILTER_OPTIONS}
              value={proposalStatusFilter}
              onChange={(e) => setProposalStatusFilter(e.target.value)}
              className="w-48"
            />
            <Button
              variant="outline"
              onClick={fetchProposals}
              disabled={loadingProposals}
              title="Refresh List"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loadingProposals ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Select
              options={CRAWLER_STATUS_FILTER_OPTIONS}
              value={crawlerStatusFilter}
              onChange={(e) => setCrawlerStatusFilter(e.target.value)}
              className="w-40"
              aria-label="Filter by Status"
            />
            <Select
              options={shopFilterOptions}
              value={crawlerShopFilter}
              onChange={(e) => setCrawlerShopFilter(e.target.value)}
              className="w-52"
              aria-label="Filter by Shop"
            />
            <Button
              variant="outline"
              onClick={fetchCrawlerRuns}
              disabled={loadingCrawler}
              title="Refresh List"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loadingCrawler ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'proposals'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Review Queue (Proposals)
            {proposalTotalCount > 0 && activeTab === 'proposals' && (
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-indigo-100 text-indigo-600">
                {proposalTotalCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('crawler-logs')}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'crawler-logs'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Crawler Activity Log
            {crawlerTotalCount > 0 && activeTab === 'crawler-logs' && (
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 text-gray-600">
                {crawlerTotalCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Proposals Tab Content */}
      {activeTab === 'proposals' && (
        <>
          {proposalError && <Alert variant="error">{proposalError}</Alert>}

          <Card>
            {loadingProposals ? (
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
                          {getProposalStatusBadge(prop.status)}
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
        </>
      )}

      {/* Crawler Activity Log Tab Content */}
      {activeTab === 'crawler-logs' && (
        <>
          {crawlerError && <Alert variant="error">{crawlerError}</Alert>}

          <Card>
            {loadingCrawler ? (
              <div className="flex justify-center items-center py-16">
                <Spinner size="lg" />
              </div>
            ) : crawlerRuns.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <p className="text-gray-500 text-base">No crawler audit logs found matching current filter.</p>
                <p className="text-gray-400 text-sm">
                  When crawler agents run, audit logs will be tracked here.
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
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Outcome Details
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {crawlerRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{run.shopName}</div>
                          {run.agentRunId && (
                            <div className="text-xs text-gray-400 font-mono mt-0.5">
                              Run: {run.agentRunId}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {getCrawlerStatusBadge(run.status)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(run.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {run.proposalId ? (
                            <Link
                              href={`/admin/change-proposals/${run.proposalId}`}
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Badge variant="info">Proposal Generated</Badge>
                              {run.proposalSummaryCounts && (
                                <span className="text-gray-500 text-xs">
                                  (+{run.proposalSummaryCounts.add || 0} ~{run.proposalSummaryCounts.update || 0} -{run.proposalSummaryCounts.delist || 0})
                                </span>
                              )}
                              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            </Link>
                          ) : run.status === 'success' ? (
                            <span className="text-xs text-gray-500 font-medium">Clean Crawl (No changes detected)</span>
                          ) : (
                            <span
                              className="text-xs text-red-600 font-mono truncate max-w-xs block"
                              title={run.errorMessage || 'Crawl failed'}
                            >
                              {run.errorMessage || 'Crawl failed'}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRun(run)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Crawl Run Details Modal */}
      {selectedRun && (
        <Modal
          isOpen={!!selectedRun}
          onClose={() => setSelectedRun(null)}
          title="Crawl Attempt Details"
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 text-base">{selectedRun.shopName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(selectedRun.createdAt).toLocaleString(undefined, {
                    dateStyle: 'full',
                    timeStyle: 'medium',
                  })}
                </p>
              </div>
              <div>{getCrawlerStatusBadge(selectedRun.status)}</div>
            </div>

            {selectedRun.agentRunId && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Agent Run ID
                </label>
                <code className="text-xs bg-gray-100 px-2.5 py-1 rounded text-gray-800 font-mono block w-fit">
                  {selectedRun.agentRunId}
                </code>
              </div>
            )}

            {selectedRun.proposalId && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Linked Change Proposal
                </label>
                <Link
                  href={`/admin/change-proposals/${selectedRun.proposalId}`}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1 font-medium"
                >
                  Inspect Proposal ({selectedRun.proposalId})
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {selectedRun.errorMessage && (
              <div>
                <label className="text-xs font-semibold text-red-600 uppercase tracking-wider block mb-1">
                  Error Message
                </label>
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-mono p-3 rounded overflow-x-auto whitespace-pre-wrap">
                  {selectedRun.errorMessage}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Metadata
              </label>
              <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-3 rounded overflow-x-auto max-h-64">
                {JSON.stringify(selectedRun.metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setSelectedRun(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
