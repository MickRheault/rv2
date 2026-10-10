'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { Card, Spinner, Alert } from '@/components/ui';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  ChangeProposalDiffViewer,
  type DiffViewerProposal,
  type DiffViewerItem,
} from '@/components/admin/ChangeProposalDiffViewer';

export default function ProposalReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const proposalId = resolvedParams.id;

  const [proposal, setProposal] = useState<DiffViewerProposal | null>(null);
  const [items, setItems] = useState<DiffViewerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!proposalId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/change-proposals/${proposalId}`);
      if (!res.ok) {
        throw new Error(`Failed to load proposal details (status: ${res.status})`);
      }
      const data = await res.json();
      setProposal(data.proposal);
      setItems(data.items || []);
    } catch (err: any) {
      console.error('Error loading proposal:', err);
      setError(err.message || 'Error loading proposal data');
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          onApplySuccess={loadData}
        />
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-500">Proposal not found.</div>
        </Card>
      )}
    </div>
  );
}
