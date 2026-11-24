'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, Button, Badge, Spinner, Alert, Select, Modal } from '@/components/ui';
import { shopService } from '@/services/shops';
import {
  submitProposalDecision,
  acknowledgeReportProposal,
  approveAllProposalChanges,
  toSafeHttpUrl,
} from '@/components/admin/ChangeProposalDiffViewer';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ProposalSummaryItem {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug?: string;
  shopUrl?: string;
  agentRunId?: string | null;
  sourceUrl: string;
  status:
    | 'pending'
    | 'reviewing'
    | 'applied'
    | 'partially_applied'
    | 'rejected'
    | 'acknowledged'
    | 'superseded';
  coverageStatus?: 'complete' | 'partial' | 'failed' | 'unknown';
  reconciliationStatus?: 'complete' | 'unresolved' | 'unknown';
  applicationStatus?:
    | 'pending'
    | 'not_applicable'
    | 'applied'
    | 'partially_applied'
    | 'failed'
    | 'rejected';
  version?: number;
  hasReconciliationReport?: boolean;
  summaryCounts: {
    add: number;
    update: number;
    delist: number;
    unchanged?: number;
    unresolved?: number;
    excluded?: number;
    duplicate?: number;
  };
  serverCounts?: Record<string, number> | null;
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
    unchanged?: number;
    unresolved?: number;
    excluded?: number;
    duplicate?: number;
  } | null;
  agentRunId?: string | null;
  status: 'success' | 'partial' | 'failed';
  coverageStatus?: 'complete' | 'partial' | 'failed' | 'unknown';
  reconciliationStatus?: 'complete' | 'unresolved' | 'unknown';
  errorMessage?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

const PROPOSAL_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'applied', label: 'Applied' },
  { value: 'partially_applied', label: 'Partially Applied' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'superseded', label: 'Superseded' },
];

const CRAWLER_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Runs' },
  { value: 'partial', label: 'Partial / Incomplete' },
  { value: 'failed', label: 'Failures Only' },
  { value: 'success', label: 'Success Only' },
];

export default function ChangeProposalsPage() {
  const [activeTab, setActiveTab] = useState<'proposals' | 'crawler-logs'>('proposals');

  // Proposals state
  const [proposals, setProposals] = useState<ProposalSummaryItem[]>([]);
  const [proposalTotalCount, setProposalTotalCount] = useState<number>(0);
  const [proposalStatusFilter, setProposalStatusFilter] = useState<string>('pending');
  const proposalStatusFilterRef = useRef<string>(proposalStatusFilter);
  proposalStatusFilterRef.current = proposalStatusFilter;
  const [loadingProposals, setLoadingProposals] = useState<boolean>(true);
  const [activeProposalAction, setActiveProposalAction] = useState<{
    id: string;
    type: 'approve' | 'reject' | 'acknowledge';
  } | null>(null);
  const actionInFlightRef = useRef<boolean>(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposalSuccess, setProposalSuccess] = useState<string | null>(null);

  const isAnyProposalActionInFlight = activeProposalAction !== null;

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

  const fetchProposals = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent === true;
    if (!isSilent) {
      setLoadingProposals(true);
    }
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
      if (!isSilent) {
        setLoadingProposals(false);
      }
    }
  }, [proposalStatusFilter]);

  const runProposalRowAction = async (
    proposalId: string,
    type: 'approve' | 'reject' | 'acknowledge',
    action: () => Promise<void>,
    logLabel: string,
    fallbackError: string
  ) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActiveProposalAction({ id: proposalId, type });
    setProposalError(null);
    setProposalSuccess(null);

    try {
      await action();
    } catch (err: any) {
      console.error(logLabel, err);
      setProposalError(err.message || fallbackError);
    } finally {
      actionInFlightRef.current = false;
      setActiveProposalAction(null);
    }
  };

  const handleQuickApproveAll = async (prop: ProposalSummaryItem) => {
    await runProposalRowAction(
      prop.id,
      'approve',
      async () => {
        const result = await approveAllProposalChanges(prop.id, prop.version);
        const nextStatus = (result.status || 'applied') as ProposalSummaryItem['status'];
        const currentFilter = proposalStatusFilterRef.current;
        const matchesFilter = currentFilter === 'all' || currentFilter === nextStatus;

        setProposals((prev) => {
          if (!matchesFilter) {
            return prev.filter((item) => item.id !== prop.id);
          }
          return prev.map((item) =>
            item.id === prop.id
              ? {
                  ...item,
                  status: nextStatus,
                  applicationStatus:
                    (result.applicationStatus as ProposalSummaryItem['applicationStatus']) ??
                    item.applicationStatus,
                  reconciliationStatus:
                    (result.reconciliationStatus as ProposalSummaryItem['reconciliationStatus']) ??
                    item.reconciliationStatus,
                  version: result.version ?? (item.version ?? 1) + 1,
                  reviewedAt: new Date().toISOString(),
                }
              : item
          );
        });
        if (!matchesFilter) {
          setProposalTotalCount((prev) => Math.max(0, prev - 1));
        }

        setProposalSuccess(
          `Approved & applied ${result.appliedCount} change${result.appliedCount === 1 ? '' : 's'} for ${prop.shopName}.`
        );
      },
      'Error approving all proposal changes:',
      'Error approving and applying changes'
    );
  };

  const handleQuickReject = async (proposalId: string, expectedVersion?: number) => {
    await runProposalRowAction(
      proposalId,
      'reject',
      async () => {
        await submitProposalDecision(proposalId, [], expectedVersion);
        await fetchProposals({ silent: true });
      },
      'Error rejecting proposal:',
      'Error rejecting proposal'
    );
  };

  const handleQuickAcknowledge = async (proposalId: string, expectedVersion?: number) => {
    await runProposalRowAction(
      proposalId,
      'acknowledge',
      async () => {
        await acknowledgeReportProposal(proposalId, expectedVersion);
        await fetchProposals({ silent: true });
      },
      'Error acknowledging report:',
      'Error acknowledging reconciliation report'
    );
  };


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
      case 'acknowledged':
        return <Badge variant="default">Acknowledged</Badge>;
      case 'applied':
        return <Badge variant="success">Applied</Badge>;
      case 'partially_applied':
        return <Badge variant="info">Partially Applied</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'superseded':
        return <Badge variant="default">Superseded</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const renderQualityBadges = (
    dims: {
      coverageStatus?: 'complete' | 'partial' | 'failed' | 'unknown';
      reconciliationStatus?: 'complete' | 'unresolved' | 'unknown';
      applicationStatus?: string;
    },
    options: { showUnknownCoverage?: boolean; keyPrefix?: string } = {}
  ) => {
    const prefix = options.keyPrefix || 'q';
    const badges: React.ReactNode[] = [];
    if (dims.coverageStatus === 'partial') {
      badges.push(
        <span
          key={`${prefix}-cov-partial`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300"
        >
          <ExclamationTriangleIcon className="w-3 h-3" />
          Partial Coverage
        </span>
      );
    } else if (dims.coverageStatus === 'failed') {
      badges.push(
        <span
          key={`${prefix}-cov-failed`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300"
        >
          <ExclamationTriangleIcon className="w-3 h-3" />
          Failed Coverage
        </span>
      );
    } else if (dims.coverageStatus === 'complete') {
      badges.push(
        <span
          key={`${prefix}-cov-complete`}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
        >
          Complete Coverage
        </span>
      );
    } else if (options.showUnknownCoverage && dims.coverageStatus === 'unknown') {
      badges.push(
        <span
          key={`${prefix}-cov-unknown`}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
        >
          Unknown Coverage
        </span>
      );
    }

    if (dims.reconciliationStatus === 'unresolved') {
      badges.push(
        <span
          key={`${prefix}-rec-unresolved`}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300"
        >
          Unresolved
        </span>
      );
    } else if (dims.reconciliationStatus === 'complete') {
      badges.push(
        <span
          key={`${prefix}-rec-complete`}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
        >
          Reconciled
        </span>
      );
    }

    if (dims.applicationStatus === 'not_applicable') {
      badges.push(
        <span
          key={`${prefix}-app-na`}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-300"
        >
          Report Only
        </span>
      );
    }
    return badges.length > 0 ? <div className="flex flex-wrap gap-1 mt-1">{badges}</div> : null;
  };

  const renderQueueQualityBadges = (prop: ProposalSummaryItem) =>
    renderQualityBadges(prop, { showUnknownCoverage: true, keyPrefix: 'prop' });

  const getCrawlerStatusBadge = (status: CrawlRunItem['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="success">Success</Badge>;
      case 'partial':
        return <Badge variant="warning">Partial</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const renderCrawlerQualityBadges = (run: CrawlRunItem) =>
    renderQualityBadges(run, { showUnknownCoverage: false, keyPrefix: 'run' });

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
              disabled={isAnyProposalActionInFlight}
              className="w-48"
            />
            <Button
              variant="outline"
              onClick={() => fetchProposals()}
              disabled={loadingProposals || isAnyProposalActionInFlight}
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
          {proposalError && (
            <Alert variant="error" dismissible onDismiss={() => setProposalError(null)}>
              {proposalError}
            </Alert>
          )}
          {proposalSuccess && (
            <Alert variant="success" dismissible onDismiss={() => setProposalSuccess(null)}>
              {proposalSuccess}
            </Alert>
          )}

          <Card padding="none" className="overflow-hidden">
            {loadingProposals ? (
              <div className="flex justify-center items-center px-6 py-16">
                <Spinner size="lg" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center px-6 py-16 space-y-2">
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rental Shop
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Crawl Date
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Proposed Mutations
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {proposals.map((prop) => {
                      const gmrUrl = prop.shopUrl || (prop.shopSlug ? `/shop/${prop.shopSlug}` : undefined);
                      const safeSourceUrl = toSafeHttpUrl(prop.sourceUrl);
                      const createdDate = new Date(prop.createdAt);
                      const addCount = prop.summaryCounts?.add ?? 0;
                      const updateCount = prop.summaryCounts?.update ?? 0;
                      const delistCount = prop.summaryCounts?.delist ?? 0;
                      const actionableCount = addCount + updateCount + delistCount;
                      const unchangedCount =
                        prop.serverCounts?.unchangedModels ?? prop.summaryCounts?.unchanged ?? 0;
                      const unresolvedCount =
                        prop.serverCounts?.unresolvedModels ?? prop.summaryCounts?.unresolved ?? 0;
                      const excludedCount =
                        prop.serverCounts?.excludedModels ?? prop.summaryCounts?.excluded ?? 0;
                      const duplicateCount =
                        prop.serverCounts?.duplicateModels ?? prop.summaryCounts?.duplicate ?? 0;
                      const isReportOnlyRow =
                        prop.applicationStatus === 'not_applicable' ||
                        (Boolean(prop.hasReconciliationReport) && actionableCount === 0);
                      const rowActionType =
                        activeProposalAction?.id === prop.id ? activeProposalAction.type : null;

                      return (
                        <tr key={prop.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900 text-sm leading-snug">
                              {prop.shopName}
                            </div>
                            <div className="flex flex-col gap-0.5 mt-1">
                              {safeSourceUrl ? (
                                <a
                                  href={safeSourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={prop.sourceUrl}
                                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 max-w-[200px]"
                                >
                                  <span className="truncate">{prop.sourceUrl}</span>
                                  <ArrowTopRightOnSquareIcon className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ) : (
                                <span
                                  title={prop.sourceUrl}
                                  className="text-xs font-mono text-gray-500 truncate max-w-[200px] block"
                                >
                                  {prop.sourceUrl}
                                </span>
                              )}
                              {gmrUrl && (
                                <a
                                  href={gmrUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium w-fit"
                                >
                                  View on GMR
                                  <ArrowTopRightOnSquareIcon className="w-3 h-3 flex-shrink-0" />
                                </a>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                            <div className="font-medium text-gray-700">
                              {createdDate.toLocaleDateString(undefined, {
                                dateStyle: 'medium',
                              })}
                            </div>
                            <div className="text-gray-500">
                              {createdDate.toLocaleTimeString(undefined, {
                                timeStyle: 'short',
                              })}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div>{getProposalStatusBadge(prop.status)}</div>
                            {renderQueueQualityBadges(prop)}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 flex-wrap max-w-[210px]">
                              {addCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                  +{addCount} new
                                </span>
                              )}
                              {updateCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  ~{updateCount} updated
                                </span>
                              )}
                              {delistCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  -{delistCount} delisted
                                </span>
                              )}
                              {actionableCount === 0 &&
                                (Boolean(prop.hasReconciliationReport) ||
                                  isReportOnlyRow ||
                                  unresolvedCount > 0) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    0 ready mutations
                                  </span>
                                )}
                              {unresolvedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                  {unresolvedCount} unresolved
                                </span>
                              )}
                              {unchangedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ={unchangedCount} unchanged
                                </span>
                              )}
                              {excludedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  {excludedCount} excluded
                                </span>
                              )}
                              {duplicateCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  {duplicateCount} duplicate
                                </span>
                              )}
                              {actionableCount === 0 &&
                                unchangedCount === 0 &&
                                unresolvedCount === 0 &&
                                excludedCount === 0 &&
                                duplicateCount === 0 &&
                                !prop.hasReconciliationReport && (
                                  <span className="text-xs text-gray-400">No changes detected</span>
                                )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right text-sm">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {prop.status === 'pending' && !isReportOnlyRow && actionableCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickApproveAll(prop)}
                                  disabled={isAnyProposalActionInFlight}
                                  title="Approve & apply all pending changes"
                                  className="inline-flex items-center whitespace-nowrap px-2 py-1.5 border border-emerald-600 text-xs font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {rowActionType === 'approve' ? (
                                    <ArrowPathIcon className="w-3.5 h-3.5 mr-1 animate-spin" />
                                  ) : (
                                    <CheckIcon className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  {rowActionType === 'approve' ? 'Applying...' : 'Approve All'}
                                </button>
                              )}
                              {prop.status === 'pending' && isReportOnlyRow && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickAcknowledge(prop.id, prop.version)}
                                  disabled={isAnyProposalActionInFlight}
                                  className="inline-flex items-center whitespace-nowrap px-2 py-1.5 border border-emerald-300 text-xs font-medium rounded-md text-emerald-800 bg-white hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  <CheckIcon className="w-3.5 h-3.5 mr-1" />
                                  {rowActionType === 'acknowledge' ? 'Acknowledging...' : 'Acknowledge'}
                                </button>
                              )}
                              {prop.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickReject(prop.id, prop.version)}
                                  disabled={isAnyProposalActionInFlight}
                                  className="inline-flex items-center whitespace-nowrap px-2 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                                >
                                  <XMarkIcon className="w-3.5 h-3.5 mr-1" />
                                  {rowActionType === 'reject' ? 'Rejecting...' : 'Reject'}
                                </button>
                              )}
                              <Link
                                href={`/admin/change-proposals/${prop.id}`}
                                title="Inspect Diff"
                                className="inline-flex items-center whitespace-nowrap px-2.5 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                              >
                                Inspect
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

          <Card padding="none" className="overflow-hidden">
            {loadingCrawler ? (
              <div className="flex justify-center items-center px-6 py-16">
                <Spinner size="lg" />
              </div>
            ) : crawlerRuns.length === 0 ? (
              <div className="text-center px-6 py-16 space-y-2">
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rental Shop
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Outcome Details
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {crawlerRuns.map((run) => {
                      const runDate = new Date(run.createdAt);
                      return (
                      <tr
                        key={run.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 text-sm leading-snug">
                            {run.shopName}
                          </div>
                          {run.agentRunId && (
                            <div className="text-xs text-gray-400 font-mono mt-0.5">
                              Run: {run.agentRunId}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <div>{getCrawlerStatusBadge(run.status)}</div>
                          {renderCrawlerQualityBadges(run)}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                          <div className="font-medium text-gray-700">
                            {runDate.toLocaleDateString(undefined, {
                              dateStyle: 'medium',
                            })}
                          </div>
                          <div className="text-gray-500">
                            {runDate.toLocaleTimeString(undefined, {
                              timeStyle: 'short',
                            })}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          {run.proposalId ? (
                            <Link
                              href={`/admin/change-proposals/${run.proposalId}`}
                              className="inline-flex items-center gap-1.5 flex-wrap text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Badge variant="info">Proposal Generated</Badge>
                              {run.proposalSummaryCounts && (
                                <span className="text-gray-500 text-xs">
                                  (+{run.proposalSummaryCounts.add || 0} ~{run.proposalSummaryCounts.update || 0} -{run.proposalSummaryCounts.delist || 0})
                                </span>
                              )}
                              {(run.proposalSummaryCounts?.unresolved ?? 0) > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                  {run.proposalSummaryCounts?.unresolved} unresolved
                                </span>
                              )}
                              {(run.proposalSummaryCounts?.unchanged ?? 0) > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  ={run.proposalSummaryCounts?.unchanged} unchanged
                                </span>
                              )}
                              {(run.proposalSummaryCounts?.excluded ?? 0) > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  {run.proposalSummaryCounts?.excluded} excluded
                                </span>
                              )}
                              {(run.proposalSummaryCounts?.duplicate ?? 0) > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  {run.proposalSummaryCounts?.duplicate} duplicate
                                </span>
                              )}
                              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            </Link>
                          ) : run.coverageStatus === 'failed' && run.status !== 'failed' ? (
                            <span className="text-xs text-red-700 font-medium">
                              {run.errorMessage || 'Failed Coverage Crawl'}
                            </span>
                          ) : run.status === 'partial' ||
                            run.coverageStatus === 'partial' ||
                            run.reconciliationStatus === 'unresolved' ? (
                            <span className="text-xs text-amber-800 font-medium">
                              {run.errorMessage || 'Partial / Incomplete Crawl'}
                            </span>
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

                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRun(run)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                      );
                    })}
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
              <div className="text-right">
                <div>{getCrawlerStatusBadge(selectedRun.status)}</div>
                {renderCrawlerQualityBadges(selectedRun)}
              </div>
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
