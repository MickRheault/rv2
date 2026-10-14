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

  it('renders prices and engine capacity properly when proposed data uses dailyRate and engineCapacity aliases', () => {
    const aliasItems: DiffViewerItem[] = [
      {
        id: 'item-hermes-1',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'add',
        entity_id: null,
        brand_name: 'Honda',
        model_name: 'ADV 160',
        original_data: null,
        proposed_data: {
          brand: 'Honda',
          modelName: 'ADV 160',
          engineCapacity: 157, // alias without Cc
          rates: [
            {
              minDays: 1,
              dailyRate: 600, // alias instead of ratePerDay
              currency: 'THB',
            },
          ],
        },
        diff_summary: null,
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={aliasItems} />);

    // Should render bike title
    expect(screen.getByText('Honda ADV 160')).toBeInTheDocument();
    // Should render engine capacity with cc suffix
    expect(screen.getByText(/Engine: 157cc/i)).toBeInTheDocument();
    // Should render formatted price verbatim with currency symbol
    expect(screen.getByText(/1\+ days: ฿600\/day/i)).toBeInTheDocument();
  });

  it('renders confirmed unchanged inventory section and excludes unchanged items from Select All', () => {
    const mixedItems: DiffViewerItem[] = [
      {
        id: 'item-add-1',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'add',
        entity_id: null,
        brand_name: 'Honda',
        model_name: 'Click 160',
        original_data: null,
        proposed_data: {
          engineCapacityCc: 160,
          rates: [{ minDays: 1, ratePerDay: 450 }],
        },
        diff_summary: null,
        status: 'pending',
      },
      {
        id: 'item-unchanged-1',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'unchanged',
        entity_id: 'bike-existing-1',
        brand_name: 'Yamaha',
        model_name: 'Grand Filano',
        original_data: {
          rates: [{ min_days: 1, rate_per_day: 350 }],
        },
        proposed_data: {
          engineCapacity: 125,
          rates: [{ minDays: 1, dailyRate: 350, currency: 'THB' }],
        },
        diff_summary: null,
        status: 'applied',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={mixedItems} />);

    // Unchanged section header
    expect(screen.getByText(/Confirmed Unchanged Inventory \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Yamaha Grand Filano')).toBeInTheDocument();
    expect(screen.getByText(/1\+ days: ฿350\/day/i)).toBeInTheDocument();

    // Toolbar count should only show 1 actionable item
    expect(screen.getByText(/1 of 1 items selected/i)).toBeInTheDocument();

    // Deselect All then Select All
    const deselectBtn = screen.getByRole('button', { name: /^Deselect All$/i });
    fireEvent.click(deselectBtn);
    expect(screen.getByText(/0 of 1 items selected/i)).toBeInTheDocument();

    const selectAllBtn = screen.getByRole('button', { name: /^Select All$/i });
    fireEvent.click(selectAllBtn);
    expect(screen.getByText(/1 of 1 items selected/i)).toBeInTheDocument();
  });
});
