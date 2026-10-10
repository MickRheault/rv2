import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ChangeProposalDiffViewer,
  type DiffViewerProposal,
  type DiffViewerItem,
} from './ChangeProposalDiffViewer';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ChangeProposalDiffViewer', () => {
  const mockProposal: DiffViewerProposal = {
    id: 'prop-1',
    shop_id: 'shop-1',
    source_url: 'https://example.com/rates',
    status: 'pending',
    created_at: '2026-10-10T12:00:00Z',
    rental_shops: {
      provider_name: 'Chiang Mai Moto Hire',
    },
  };

  const mockItems: DiffViewerItem[] = [
    {
      id: 'item-1',
      proposal_id: 'prop-1',
      entity_type: 'motorcycle',
      action: 'add',
      entity_id: null,
      brand_name: 'Honda',
      model_name: 'ADV 160',
      original_data: null,
      proposed_data: { year: 2024, engineCapacityCc: 160, rates: [{ minDays: 1, ratePerDay: 450 }] },
      diff_summary: null,
      status: 'pending',
    },
    {
      id: 'item-2',
      proposal_id: 'prop-1',
      entity_type: 'motorcycle',
      action: 'delist',
      entity_id: 'bike-2',
      brand_name: 'Yamaha',
      model_name: 'Aerox 155',
      original_data: { availability_status: 'available' },
      proposed_data: { availability_status: 'unavailable' },
      diff_summary: null,
      status: 'pending',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders shop header, grouped items, and selection counter', () => {
    render(<ChangeProposalDiffViewer proposal={mockProposal} items={mockItems} />);

    expect(screen.getByText('Chiang Mai Moto Hire')).toBeInTheDocument();
    expect(screen.getByText(/New Motorcycles to Add \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing Fleet — Soft Delist \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Honda ADV 160')).toBeInTheDocument();
    expect(screen.getByText('Yamaha Aerox 155')).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 items selected/i)).toBeInTheDocument();
  });

  it('allows deselecting and selecting items', () => {
    render(<ChangeProposalDiffViewer proposal={mockProposal} items={mockItems} />);

    const deselectBtn = screen.getByRole('button', { name: /^Deselect All$/i });
    fireEvent.click(deselectBtn);
    expect(screen.getByText(/0 of 2 items selected/i)).toBeInTheDocument();

    const selectAllBtn = screen.getByRole('button', { name: /^Select All$/i });
    fireEvent.click(selectAllBtn);
    expect(screen.getByText(/2 of 2 items selected/i)).toBeInTheDocument();
  });

  it('submits approved mutations when apply button clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, appliedCount: 2, status: 'applied' }),
    });

    const onApplySuccess = jest.fn();

    render(
      <ChangeProposalDiffViewer
        proposal={mockProposal}
        items={mockItems}
        onApplySuccess={onApplySuccess}
      />
    );

    const applyBtn = screen.getByRole('button', { name: /Approve & Apply Selected/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/change-proposals/prop-1/apply',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ approvedItemIds: ['item-1', 'item-2'] }),
        })
      );
      expect(onApplySuccess).toHaveBeenCalled();
    });
  });
});
