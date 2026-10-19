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
    expect(screen.getByText(/\+ New Bike/i)).toBeInTheDocument();
    expect(screen.getByText(/- Delisted \/ Unavailable/i)).toBeInTheDocument();
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

    // Unchanged section header is collapsed by default
    const unchangedToggle = screen.getByRole('button', {
      name: /Confirmed Unchanged Inventory \(1\)/i,
    });
    expect(unchangedToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Yamaha Grand Filano')).not.toBeInTheDocument();

    // Expanding shows the unchanged inventory details
    fireEvent.click(unchangedToggle);
    expect(unchangedToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Yamaha Grand Filano')).toBeInTheDocument();
    expect(screen.getByText(/1\+ days: ฿350\/day/i)).toBeInTheDocument();

    // Collapsing again hides the unchanged inventory details
    fireEvent.click(unchangedToggle);
    expect(unchangedToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Yamaha Grand Filano')).not.toBeInTheDocument();

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

  it('renders detailed before-and-after rate diff showing old and new rates instead of generic banner', () => {
    const rateUpdateItems: DiffViewerItem[] = [
      {
        id: 'item-update-rates-1',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-existing-adv',
        brand_name: 'Honda',
        model_name: 'ADV 160',
        original_data: {
          rates: [{ min_days: 1, max_days: null, rate_per_day: 500, currency: 'THB' }],
        },
        proposed_data: {
          rates: [{ minDays: 1, maxDays: null, ratePerDay: 600, currency: 'THB' }],
        },
        diff_summary: {
          rates: {
            old: [{ min_days: 1, max_days: null, rate_per_day: 500 }],
            new: [{ minDays: 1, maxDays: null, ratePerDay: 600, currency: 'THB' }],
          },
        },
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={rateUpdateItems} />);

    // Must show bike title
    expect(screen.getByText('Honda ADV 160')).toBeInTheDocument();
    // Must show the previous/old rate (e.g. 500)
    expect(screen.getByText(/500/)).toBeInTheDocument();
    // Must show the new/proposed rate (e.g. 600)
    expect(screen.getByText(/600/)).toBeInTheDocument();
    // Must NOT just show a generic vague message with zero numbers
    expect(screen.queryByText(/Rates updated: New rate schedule proposed/i)).not.toBeInTheDocument();
  });

  it('renders tiered rate diffs with added, removed, and modified tier indicators', () => {
    const tieredItems: DiffViewerItem[] = [
      {
        id: 'item-tiered-1',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-tiered',
        brand_name: 'Yamaha',
        model_name: 'NMAX 155',
        original_data: {
          rates: [
            { min_days: 1, max_days: 6, rate_per_day: 500 },
            { min_days: 14, max_days: null, rate_per_day: 350 },
          ],
        },
        proposed_data: {
          rates: [
            { minDays: 1, maxDays: 6, ratePerDay: 600, currency: 'THB' },
            { minDays: 7, maxDays: 13, ratePerDay: 450, currency: 'THB' },
          ],
        },
        diff_summary: {
          rates: {
            old: [
              { min_days: 1, max_days: 6, rate_per_day: 500 },
              { min_days: 14, max_days: null, rate_per_day: 350 },
            ],
            new: [
              { minDays: 1, maxDays: 6, ratePerDay: 600, currency: 'THB' },
              { minDays: 7, maxDays: 13, ratePerDay: 450, currency: 'THB' },
            ],
            tiersDiff: [
              {
                status: 'modified',
                minDays: 1,
                maxDays: 6,
                oldRate: 500,
                newRate: 600,
                delta: 100,
                percentage: 20,
                currency: 'THB',
              },
              {
                status: 'added',
                minDays: 7,
                maxDays: 13,
                newRate: 450,
                currency: 'THB',
              },
              {
                status: 'removed',
                minDays: 14,
                maxDays: null,
                oldRate: 350,
              },
            ],
          },
        },
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={tieredItems} />);

    expect(screen.getByText('Yamaha NMAX 155')).toBeInTheDocument();
    // Modified tier: 500 -> 600 with delta
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/600\/day/)).toBeInTheDocument();
    expect(screen.getByText(/\+฿100/)).toBeInTheDocument();
    expect(screen.getByText(/\+20%/)).toBeInTheDocument();

    // Added tier with "+ Added" badge
    expect(screen.getByText(/\+ Added/i)).toBeInTheDocument();
    expect(screen.getByText(/7-13 days:/i)).toBeInTheDocument();

    // Removed tier with "- Removed" badge
    expect(screen.getByText(/- Removed/i)).toBeInTheDocument();
    expect(screen.getByText(/14\+ days:/i)).toBeInTheDocument();
  });

  it('renders duration updated rate tiers without misleading zero delta', () => {
    const durationModifiedItems: DiffViewerItem[] = [
      {
        id: 'item-duration-1',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-duration-1',
        brand_name: 'Honda',
        model_name: 'Click 160',
        original_data: {
          rates: [{ min_days: 1, max_days: 6, rate_per_day: 450 }],
        },
        proposed_data: {
          rates: [{ minDays: 1, maxDays: 13, ratePerDay: 450, currency: 'THB' }],
        },
        diff_summary: {
          rates: {
            old: [{ min_days: 1, max_days: 6, rate_per_day: 450 }],
            new: [{ minDays: 1, maxDays: 13, ratePerDay: 450, currency: 'THB' }],
            tiersDiff: [
              {
                status: 'duration_modified',
                minDays: 1,
                maxDays: 13,
                oldMaxDays: 6,
                oldRate: 450,
                newRate: 450,
                currency: 'THB',
              },
            ],
          },
        },
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={durationModifiedItems} />);

    expect(screen.getByText('Honda Click 160')).toBeInTheDocument();
    expect(screen.getByText(/Duration Updated/i)).toBeInTheDocument();
    expect(screen.getByText(/1-6 days/i)).toBeInTheDocument();
    expect(screen.getByText(/1-13 days:/i)).toBeInTheDocument();
    expect(screen.getByText(/฿450\/day/i)).toBeInTheDocument();
    // Must NOT show misleading +฿0 (+0%)
    expect(screen.queryByText(/\+฿0/i)).not.toBeInTheDocument();
  });

  it('renders shop updates with added and removed inclusions and conditions', () => {
    const shopUpdateItems: DiffViewerItem[] = [
      {
        id: 'item-shop-1',
        proposal_id: 'prop-1',
        entity_type: 'rental_shop',
        action: 'update',
        entity_id: 'shop-1',
        brand_name: 'Shop Profile',
        model_name: 'General Information & Policies',
        original_data: {
          phone: '+66 81 111 1111',
          inclusions: ['Helmets provided'],
          conditions: ['Driver license required'],
        },
        proposed_data: {
          phone: '+66 81 222 2222',
          inclusions: ['Helmets provided', 'Free insurance'],
          conditions: ['Driver license required', 'Passport deposit'],
        },
        diff_summary: {
          phone: { old: '+66 81 111 1111', new: '+66 81 222 2222' },
          inclusions: {
            old: ['Helmets provided'],
            new: ['Helmets provided', 'Free insurance'],
            added: ['Free insurance'],
            removed: [],
          },
          conditions: {
            old: ['Driver license required'],
            new: ['Driver license required', 'Passport deposit'],
            added: ['Passport deposit'],
            removed: [],
          },
        },
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={shopUpdateItems} />);

    expect(screen.getByText(/Shop Profile Updates/i)).toBeInTheDocument();
    expect(screen.getByText(/\+66 81 111 1111/)).toBeInTheDocument();
    expect(screen.getByText(/\+66 81 222 2222/)).toBeInTheDocument();

    expect(screen.getByText('Free insurance')).toBeInTheDocument();
    expect(screen.getByText('Passport deposit')).toBeInTheDocument();
  });

  it('renders the "View on GMR" public shop link in the header and executes one-click Reject Proposal', async () => {
    const onRejectSuccess = jest.fn();
    const proposalWithUrl: DiffViewerProposal = {
      ...mockProposal,
      shop_url: '/shop/cambodia/siem-reap/we-scooter-rental-siem-reap',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        appliedCount: 0,
        status: 'rejected',
      }),
    });

    render(
      <ChangeProposalDiffViewer
        proposal={proposalWithUrl}
        items={mockItems}
        onRejectSuccess={onRejectSuccess}
      />
    );

    const gmrLink = screen.getByRole('link', { name: /View on GMR/i });
    expect(gmrLink).toHaveAttribute('href', '/shop/cambodia/siem-reap/we-scooter-rental-siem-reap');
    expect(gmrLink).toHaveAttribute('target', '_blank');

    const rejectBtn = screen.getByRole('button', { name: /Reject Proposal/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/change-proposals/prop-1/apply',
        expect.objectContaining({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [] }),
        })
      );
    });

    expect(onRejectSuccess).toHaveBeenCalledTimes(1);
  });

  it('hides action toolbar and Reject Proposal button when proposal status is partially_applied', () => {
    const partiallyAppliedProposal: DiffViewerProposal = {
      ...mockProposal,
      status: 'partially_applied',
    };

    render(<ChangeProposalDiffViewer proposal={partiallyAppliedProposal} items={mockItems} />);

    expect(screen.queryByRole('button', { name: /Reject Proposal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve & Apply Selected/i })).not.toBeInTheDocument();
  });

  it('renders brand and model attribute diffs when an existing motorcycle is updated with corrected brand or model', () => {
    const brandModelUpdateItems: DiffViewerItem[] = [
      {
        id: 'item-qbix',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
        brand_name: 'Yamaha',
        model_name: 'QBIX 125',
        original_data: {
          brand: 'Honda',
          modelName: 'QBIX',
          year: 2022,
          rates: [{ minDays: 1, ratePerDay: 10, currency: 'USD' }],
        },
        proposed_data: {
          brand: 'Yamaha',
          modelName: 'QBIX 125',
          year: 2022,
          rates: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }],
        },
        diff_summary: {
          brand: { old: 'Honda', new: 'Yamaha' },
          model: { old: 'QBIX', new: 'QBIX 125' },
        },
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={brandModelUpdateItems} />);

    expect(screen.getByText('Yamaha QBIX 125')).toBeInTheDocument();
    expect(screen.getByText('Brand:')).toBeInTheDocument();
    expect(screen.getByText('Honda')).toBeInTheDocument();
    expect(screen.getByText('Yamaha')).toBeInTheDocument();
    expect(screen.getByText('Model:')).toBeInTheDocument();
    expect(screen.getByText('QBIX')).toBeInTheDocument();
    expect(screen.getByText('QBIX 125')).toBeInTheDocument();
  });

  it('renders before/after attribute and rate diffs from original_data and proposed_data even when diff_summary is omitted', () => {
    const itemsWithoutDiffSummary: DiffViewerItem[] = [
      {
        id: 'item-no-summary',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
        brand_name: 'Yamaha',
        model_name: 'PG-1',
        original_data: {
          brand: 'Honda',
          model: 'PG1',
          year: 2024,
          engineCapacityCc: 110,
          sourceUrl: 'https://example.com/old-pg1',
          rates: [{ minDays: 1, ratePerDay: 10, currency: 'USD' }],
        },
        proposed_data: {
          brand: 'Yamaha',
          model: 'PG-1',
          year: 2025,
          engineCapacityCc: 115,
          sourceUrl: 'https://example.com/new-pg1',
          rates: [{ minDays: 1, ratePerDay: 12, currency: 'USD' }],
        },
        diff_summary: null,
        status: 'pending',
      },
      {
        id: 'item-shop-no-summary',
        proposal_id: 'prop-1',
        entity_type: 'rental_shop',
        action: 'update',
        entity_id: 'shop-1',
        brand_name: 'Shop Profile',
        model_name: 'General Information & Policies',
        original_data: {
          businessDescription: 'Old description',
          phone: '+661111',
          inclusions: ['2 Helmets'],
        },
        proposed_data: {
          businessDescription: 'New description',
          phone: '+662222',
          inclusions: ['2 Helmets', 'Phone Holder'],
        },
        diff_summary: null,
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={itemsWithoutDiffSummary} />);

    expect(screen.getByText('Yamaha PG-1')).toBeInTheDocument();
    expect(screen.getByText('Honda')).toBeInTheDocument();
    expect(screen.getByText('PG1')).toBeInTheDocument();
    expect(screen.getByText('110cc')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/old-pg1')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/new-pg1')).toBeInTheDocument();
    expect(screen.getByText(/\$10\/day/i)).toBeInTheDocument();
    expect(screen.getByText(/\$12\/day/i)).toBeInTheDocument();
    expect(screen.getByText('Old description')).toBeInTheDocument();
    expect(screen.getByText('New description')).toBeInTheDocument();
    expect(screen.getByText('+662222')).toBeInTheDocument();
    expect(screen.getByText('Phone Holder')).toBeInTheDocument();
    expect(screen.queryByText(/Needs Identity Review/i)).not.toBeInTheDocument();
  });

  it('displays a clear timeout/server error instead of JSON syntax error when apply returns a non-JSON 504 response (#153)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 504,
      json: async () => {
        throw new SyntaxError('Unexpected token \'A\', "An error o"... is not valid JSON');
      },
    });

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={mockItems} />);

    const applyBtn = screen.getByRole('button', { name: /Approve & Apply Selected/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Request timed out while applying changes/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Unexpected token/i)).not.toBeInTheDocument();
  });

  it('renders an Applied badge without an unchecked checkbox for already-applied items in a pending proposal (#153)', () => {
    const partiallyCompletedItems: DiffViewerItem[] = [
      {
        id: 'item-applied-update',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-applied-1',
        brand_name: 'Honda',
        model_name: 'Moove 110',
        original_data: { year: 2022, rates: [{ minDays: 1, ratePerDay: 200 }] },
        proposed_data: { year: 2023, rates: [{ minDays: 1, ratePerDay: 250 }] },
        diff_summary: null,
        status: 'applied',
      },
      {
        id: 'item-pending-update',
        proposal_id: 'prop-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-pending-2',
        brand_name: 'Yamaha',
        model_name: 'Fazzio 125',
        original_data: { year: 2023, rates: [{ minDays: 1, ratePerDay: 300 }] },
        proposed_data: { year: 2024, rates: [{ minDays: 1, ratePerDay: 350 }] },
        diff_summary: null,
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={mockProposal} items={partiallyCompletedItems} />);

    // Only the 1 pending item should have a checkbox (and be checked)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0]).toBeChecked();

    // The already-applied item should display an "Applied" badge and toolbar summary
    expect(screen.getByText('Honda Moove 110')).toBeInTheDocument();
    expect(screen.getByText('Yamaha Fazzio 125')).toBeInTheDocument();
    expect(screen.getByText(/^✓ Applied$/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 items selected/i)).toBeInTheDocument();
    expect(screen.getByText(/1 already applied/i)).toBeInTheDocument();
  });
});



