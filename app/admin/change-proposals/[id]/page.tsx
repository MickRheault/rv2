'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Spinner, Alert } from '@/components/ui';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  ChangeProposalDiffViewer,
  type DiffViewerProposal,
  type DiffViewerItem,
  type DiffViewerReport,
  type DiffViewerReportEntry,
  type DiffViewerEntriesPagination,
  type DiffViewerCandidate,
} from '@/components/admin/ChangeProposalDiffViewer';

export default function ProposalReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const proposalId = resolvedParams.id;

  const [proposal, setProposal] = useState<DiffViewerProposal | null>(null);
  const [items, setItems] = useState<DiffViewerItem[]>([]);
  const [report, setReport] = useState<DiffViewerReport | null>(null);
  const [entries, setEntries] = useState<DiffViewerReportEntry[]>([]);
  const [entriesPagination, setEntriesPagination] =
    useState<DiffViewerEntriesPagination | null>(null);
  const [candidates, setCandidates] = useState<DiffViewerCandidate[]>([]);
  const [decisionEvents, setDecisionEvents] = useState<any[]>([]);
  const [candidateEvents, setCandidateEvents] = useState<any[]>([]);
  const [entriesOffset, setEntriesOffset] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (customOffset?: number) => {
      if (!proposalId) return;
      setLoading(true);
      setError(null);

      const targetOffset = customOffset ?? entriesOffset;
      const url =
        targetOffset > 0
          ? `/api/admin/change-proposals/${proposalId}?entriesLimit=200&entriesOffset=${targetOffset}`
          : `/api/admin/change-proposals/${proposalId}`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to load proposal details (status: ${res.status})`);
        }
        const data = await res.json();
        setProposal(data.proposal);
        setItems(data.items || []);
        setReport(data.report || null);
        setEntries(data.entries || []);
        setEntriesPagination(data.entriesPagination || null);
        setCandidates(data.candidates || []);
        setDecisionEvents(data.decisionEvents || []);
        setCandidateEvents(data.candidateEvents || []);
      } catch (err: any) {
        console.error('Error loading proposal:', err);
        setError(err.message || 'Error loading proposal data');
      } finally {
        setLoading(false);
      }
    },
    [proposalId, entriesOffset]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEntriesPageChange = (nextOffset: number) => {
    setEntriesOffset(nextOffset);
    loadData(nextOffset);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Navigation */}
      <div>
        <Link
          href="/admin/change-proposals"
          className="text-gray-500 hover:text-gray-700 flex items-center text-sm mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back to Change Proposals
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Spinner size="lg" />
        </div>
      ) : proposal ? (
        <ChangeProposalDiffViewer
          proposal={proposal}
          items={items}
          report={report}
          entries={entries}
          entriesPagination={entriesPagination}
          candidates={candidates}
          decisionEvents={decisionEvents}
          candidateEvents={candidateEvents}
          onEntriesPageChange={handleEntriesPageChange}
          onApplySuccess={() => loadData()}
          onRejectSuccess={() => router.push('/admin/change-proposals')}
        />
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-500">Proposal not found.</div>
        </Card>
      )}
    </div>
  );
}

