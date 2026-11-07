import React from 'react';
import { render, screen, within } from '@testing-library/react';
import {
  ChangeProposalDiffViewer,
  DiffViewerItem,
  DiffViewerProposal,
} from '@/components/admin/ChangeProposalDiffViewer';

function buildBaseProposal(overrides: Partial<DiffViewerProposal> = {}): DiffViewerProposal {
  return {
    id: 'prop-flex-1',
    shop_id: 'shop-1',
    source_url: 'https://patoymoto.example/fleet',
    status: 'pending',
    coverage_status: 'complete',
    reconciliation_status: 'complete',
    application_status: 'pending',
    version: 1,
    created_at: '2026-11-05T10:00:00Z',
    rental_shops: {
      provider_name: 'Patoy Moto',
      slug: 'patoy-moto',
      cities: {
        name: 'Bangkok',
        provinces: {
          countries: {
            name: 'Thailand',
          },
        },
      },
    },
    ...overrides,
  };
}

describe('ChangeProposalDiffViewer Flexible Rental Offers (#211)', () => {
  it('renders coexisting daily, hourly, fixed-duration package, calendar-month, and 30-day offers with daily equivalents and nested extensions on Added items', () => {
    const proposal = buildBaseProposal();
    const items: DiffViewerItem[] = [
      {
        id: 'item-add-1',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'add',
        entity_id: null,
        brand_name: 'Honda',
        model_name: 'Forza 350',
        original_data: null,
        proposed_data: {
          brand: 'Honda',
          model: 'Forza 350',
          year: 2024,
          engineCapacityCc: 330,
          offers: [
            {
              offerType: 'daily',
              amount: 500,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: 6,
              isFrom: true,
            },
            {
              offerType: 'hourly',
              amount: 100,
              currency: 'THB',
              billingBasis: 'per_hour',
              durationUnit: 'hour',
              minDuration: 1,
              maxDuration: null,
              minCommitment: { value: 2, unit: 'hour' },
              billingIncrement: { value: 30, unit: 'minute' },
              supplierLabel: 'Quick Spin',
            },
            {
              offerType: 'package',
              amount: 3000,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              supplierLabel: 'Weekly Package',
              extensions: [
                {
                  amount: 450,
                  currency: 'THB',
                  billingBasis: 'per_day',
                  durationUnit: 'day',
                  minDuration: 1,
                  supplierLabel: 'Extra days',
                },
              ],
            },
            {
              offerType: 'monthly',
              amount: 6000,
              currency: 'THB',
              billingBasis: 'per_calendar_month',
              durationUnit: 'calendar_month',
              minDuration: 1,
              maxDuration: null,
              minCommitment: { value: 3, unit: 'calendar_month' },
              supplierLabel: 'Calendar Month Plan',
            },
            {
              offerType: 'monthly',
              amount: 8000,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 30,
              maxDuration: 30,
              supplierLabel: '30-Day Pass',
            },
          ],
        },
        diff_summary: null,
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={proposal} items={items} />);

    // Preserves billing units & duration phrases verbatim
    expect(screen.getByText(/1–6 days/i)).toBeInTheDocument();
    expect(screen.getByText(/per day/i)).toBeInTheDocument();
    expect(screen.getByText(/From/i)).toBeInTheDocument();

    expect(screen.getByText('Quick Spin')).toBeInTheDocument();
    expect(screen.getByText(/per hour/i)).toBeInTheDocument();
    expect(screen.getByText(/Min\. commitment: 2 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Billed in 30-minute increments/i)).toBeInTheDocument();

    const weeklyOffer = screen.getByTestId('proposal-offer-item-add-1-2');
    expect(within(weeklyOffer).getByText('Weekly Package')).toBeInTheDocument();
    expect(within(weeklyOffer).getByText(/3,000/)).toBeInTheDocument();
    expect(within(weeklyOffer).getByText(/for 7 days/i)).toBeInTheDocument();
    expect(within(weeklyOffer).getByText(/428\.57/)).toBeInTheDocument();
    expect(within(weeklyOffer).getByText(/daily equivalent/i)).toBeInTheDocument();
    expect(within(weeklyOffer).getByText(/Extra days/i)).toBeInTheDocument();
    expect(within(weeklyOffer).getByText(/450/)).toBeInTheDocument();
    expect(within(weeklyOffer).getByText(/per extra day/i)).toBeInTheDocument();

    // Calendar month must NOT display a daily equivalent, whereas 30-day package DOES
    const calMonthOffer = screen.getByTestId('proposal-offer-item-add-1-3');
    expect(within(calMonthOffer).getByText('Calendar Month Plan')).toBeInTheDocument();
    expect(within(calMonthOffer).getByText(/per calendar month/i)).toBeInTheDocument();
    expect(within(calMonthOffer).getByText(/Min\. commitment: 3 calendar months/i)).toBeInTheDocument();
    expect(within(calMonthOffer).queryByText(/daily equivalent/i)).not.toBeInTheDocument();

    const thirtyDayOffer = screen.getByTestId('proposal-offer-item-add-1-4');
    expect(within(thirtyDayOffer).getByText('30-Day Pass')).toBeInTheDocument();
    expect(within(thirtyDayOffer).getByText(/for 30 days/i)).toBeInTheDocument();
    expect(within(thirtyDayOffer).getByText(/266\.67/)).toBeInTheDocument();
    expect(within(thirtyDayOffer).getByText(/daily equivalent/i)).toBeInTheDocument();
  });

  it('renders clear before/after offer diffs (modified amounts/extensions, added offers, removed offers, and unchanged offers) on Updated items', () => {
    const proposal = buildBaseProposal();
    const items: DiffViewerItem[] = [
      {
        id: 'item-upd-1',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-1',
        brand_name: 'Yamaha',
        model_name: 'XMAX 300',
        original_data: {
          offers: [
            {
              offerType: 'daily',
              amount: 600,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: 6,
            },
            {
              offerType: 'package',
              amount: 3500,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              supplierLabel: 'Weekly Deal',
              extensions: [
                {
                  amount: 500,
                  currency: 'THB',
                  billingBasis: 'per_day',
                },
              ],
            },
            {
              offerType: 'hourly',
              amount: 150,
              currency: 'THB',
              billingBasis: 'per_hour',
              durationUnit: 'hour',
              minDuration: 1,
              maxDuration: null,
            },
          ],
        },
        proposed_data: {
          offers: [
            {
              offerType: 'daily',
              amount: 600,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: 6,
            },
            {
              offerType: 'package',
              amount: 3200,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              supplierLabel: 'Weekly Deal',
              extensions: [
                {
                  amount: 450,
                  currency: 'THB',
                  billingBasis: 'per_day',
                },
              ],
            },
            {
              offerType: 'monthly',
              amount: 9000,
              currency: 'THB',
              billingBasis: 'per_calendar_month',
              durationUnit: 'calendar_month',
              minDuration: 1,
              maxDuration: null,
            },
          ],
        },
        diff_summary: { offers: true },
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={proposal} items={items} />);

    const diffContainer = screen.getByTestId('proposal-offers-diff-item-upd-1');

    // Unchanged daily offer
    expect(within(diffContainer).getByText(/✓ Unchanged/i)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/600/)).toBeInTheDocument();

    // Modified weekly package (3,500 -> 3,200, updated daily equivalent 457.14, extension 500 -> 450)
    expect(within(diffContainer).getByText('Weekly Deal')).toBeInTheDocument();
    expect(within(diffContainer).getByText(/3,500/)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/3,200/)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/457\.14/)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/500\s+per extra day/i)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/450\s+per extra day/i)).toBeInTheDocument();

    // Added monthly offer
    expect(within(diffContainer).getByText(/\+ Added/i)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/9,000/)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/per calendar month/i)).toBeInTheDocument();

    // Removed hourly offer
    expect(within(diffContainer).getByText(/- Removed/i)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/150/)).toBeInTheDocument();
    expect(within(diffContainer).getByText(/per hour/i)).toBeInTheDocument();
  });

  it('renders delisted and unchanged inventory accounting offers accurately while keeping legacy rates fallback intact', () => {
    const proposal = buildBaseProposal();
    const items: DiffViewerItem[] = [
      {
        id: 'item-delist-1',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'delist',
        entity_id: 'bike-delist-1',
        brand_name: 'Kawasaki',
        model_name: 'Z400',
        original_data: {
          offers: [
            {
              offerType: 'package',
              amount: 4200,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              extensions: [
                {
                  amount: 550,
                  currency: 'THB',
                  billingBasis: 'per_day',
                },
              ],
            },
          ],
        },
        proposed_data: { availabilityStatus: 'unavailable' },
        diff_summary: null,
        status: 'pending',
      },
      {
        id: 'item-legacy-add',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'add',
        entity_id: null,
        brand_name: 'Suzuki',
        model_name: 'Burgman 200',
        original_data: null,
        proposed_data: {
          rates: [{ minDays: 1, maxDays: 6, ratePerDay: 350, currency: 'THB' }],
        },
        diff_summary: null,
        status: 'pending',
      },
      {
        id: 'item-unchanged-legacy',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'unchanged',
        entity_id: 'bike-unch-item',
        brand_name: 'Vespa',
        model_name: 'Sprint 150',
        original_data: null,
        proposed_data: null,
        baseline_data: {
          offers: [
            {
              offerType: 'monthly',
              amount: 7500,
              currency: 'THB',
              billingBasis: 'per_calendar_month',
              durationUnit: 'calendar_month',
              minDuration: 1,
              maxDuration: null,
            },
          ],
        },
        diff_summary: null,
        status: 'pending',
      },
    ];

    const report: any = {
      reportDigest: 'sha256:test',
      scope: {
        branch: 'Main',
        services: ['rental'],
        catalogType: 'fleet_list',
        availabilityBasis: 'listed_fleet_only',
      },
      coverage: {
        status: 'complete',
        discoveryComplete: true,
        pages: [],
        limitations: [],
      },
    };

    const entries: any[] = [
      {
        id: 'entry-unch-1',
        entryKey: 'honda-adv160',
        disposition: 'unchanged',
        brand: 'Honda',
        model: 'ADV 160',
        existingMotorcycleId: 'bike-adv-1',
        comparedAttributes: ['offers'],
        baseline_data: {
          offers: [
            {
              offerType: 'package',
              amount: 2800,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
            },
          ],
        },
      },
    ];

    render(
      <ChangeProposalDiffViewer
        proposal={proposal}
        items={items}
        report={report}
        entries={entries}
      />
    );

    // Delisted package + extension rendered with strike-through styling
    const delistOffer = screen.getByTestId('proposal-offer-item-delist-1-0');
    expect(delistOffer).toHaveClass('line-through');
    expect(within(delistOffer).getByText(/4,200/)).toBeInTheDocument();
    expect(within(delistOffer).getByText(/for 7 days/i)).toBeInTheDocument();
    expect(within(delistOffer).getByText(/550/)).toBeInTheDocument();
    expect(within(delistOffer).getByText(/per extra day/i)).toBeInTheDocument();

    // Unchanged reconciliation report entry renders baseline offers in emerald
    const accountingSection = screen.getByTestId('reconciliation-accounting-section');
    expect(within(accountingSection).getByText(/2,800/)).toBeInTheDocument();
    expect(within(accountingSection).getByText(/for 7 days/i)).toBeInTheDocument();
    expect(within(accountingSection).getByText(/400\.00/)).toBeInTheDocument();

    // Legacy rates-only item still renders classic rate chip
    expect(screen.getByText(/1-6 days: ฿350\/day/i)).toBeInTheDocument();

    // Confirmed Unchanged Inventory section (expanded by default) renders baseline offers
    expect(screen.getByText(/7,500/)).toBeInTheDocument();
    expect(screen.getByText(/per calendar month/i)).toBeInTheDocument();
  });

  it('preserves legacy Rate Tiers diff when a legacy rates-only update item has hydrated baseline_data.offers', () => {
    const proposal = buildBaseProposal();
    const items: DiffViewerItem[] = [
      {
        id: 'item-legacy-upd',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-legacy-1',
        brand_name: 'Honda',
        model_name: 'Click 160',
        original_data: {
          rates: [{ minDays: 1, maxDays: null, ratePerDay: 250, currency: 'THB' }],
        },
        proposed_data: {
          rates: [{ minDays: 1, maxDays: null, ratePerDay: 300, currency: 'THB' }],
        },
        baseline_data: {
          rates: [{ minDays: 1, maxDays: null, ratePerDay: 250, currency: 'THB' }],
          offers: [
            {
              offerType: 'daily',
              amount: 250,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: null,
            },
          ],
        },
        diff_summary: null,
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={proposal} items={items} />);

    expect(screen.getByText('Rate Tiers:')).toBeInTheDocument();
    expect(screen.getByText('฿250/day')).toBeInTheDocument();
    expect(screen.getByText('฿300/day')).toBeInTheDocument();
  });

  it('ignores rogue dailyEquivalent overrides on non-fixed-day offers, renders commitment/increment/dailyEquivalent deltas on modified offers, and shows full details on removed offers', () => {
    const proposal = buildBaseProposal();
    const items: DiffViewerItem[] = [
      {
        id: 'item-rogue-add',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'add',
        entity_id: null,
        brand_name: 'Honda',
        model_name: 'Giorgano 125',
        original_data: null,
        proposed_data: {
          offers: [
            {
              offerType: 'monthly',
              amount: 6000,
              currency: 'THB',
              billingBasis: 'per_calendar_month',
              durationUnit: 'calendar_month',
              minDuration: 1,
              maxDuration: null,
              // Rogue override in untrusted snapshot JSON must be ignored!
              dailyEquivalent: 200,
            },
          ],
        },
        diff_summary: null,
        status: 'pending',
      },
      {
        id: 'item-rich-upd',
        proposal_id: 'prop-flex-1',
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: 'bike-rich-1',
        brand_name: 'Yamaha',
        model_name: 'NMAX 155',
        original_data: {
          offers: [
            {
              offerType: 'package',
              amount: 3500,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              supplierLabel: 'Weekly Promo',
              minCommitment: { value: 7, unit: 'day' },
              billingIncrement: { value: 1, unit: 'day' },
              extensions: [
                {
                  amount: 500,
                  currency: 'THB',
                  billingBasis: 'per_day',
                  billingIncrement: { value: 1, unit: 'day' },
                },
              ],
            },
            {
              offerType: 'hourly',
              amount: 120,
              currency: 'THB',
              billingBasis: 'per_hour',
              durationUnit: 'hour',
              minDuration: 1,
              maxDuration: null,
              minCommitment: { value: 2, unit: 'hour' },
              billingIncrement: { value: 30, unit: 'minute' },
              extensions: [
                {
                  amount: 100,
                  currency: 'THB',
                  billingBasis: 'per_hour',
                  billingIncrement: { value: 30, unit: 'minute' },
                },
              ],
            },
          ],
        },
        proposed_data: {
          offers: [
            {
              offerType: 'package',
              amount: 2800,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              supplierLabel: 'Weekly Promo',
              minCommitment: null,
              billingIncrement: { value: 7, unit: 'day' },
              extensions: [
                {
                  amount: 450,
                  currency: 'THB',
                  billingBasis: 'per_day',
                  billingIncrement: { value: 2, unit: 'day' },
                },
              ],
            },
          ],
        },
        diff_summary: { offers: true },
        status: 'pending',
      },
    ];

    render(<ChangeProposalDiffViewer proposal={proposal} items={items} />);

    // 1. Calendar-month offer never shows rogue dailyEquivalent
    const rogueOffer = screen.getByTestId('proposal-offer-item-rogue-add-0');
    expect(within(rogueOffer).queryByText(/daily equivalent/i)).not.toBeInTheDocument();

    const richDiff = screen.getByTestId('proposal-offers-diff-item-rich-upd');

    // 2. Modified package shows old -> new dailyEquivalent (500.00 -> 400.00), removed minCommitment, and old -> new billingIncrement
    expect(within(richDiff).getByText(/500\.00/)).toBeInTheDocument();
    expect(within(richDiff).getByText(/400\.00/)).toBeInTheDocument();
    expect(within(richDiff).getByText(/7 days.*removed/i)).toBeInTheDocument();
    expect(within(richDiff).getAllByText(/1-day increments/i).length).toBeGreaterThanOrEqual(1);
    expect(within(richDiff).getByText(/7-day increments/i)).toBeInTheDocument();
    expect(within(richDiff).getByText(/2-day increments/i)).toBeInTheDocument();

    // 3. Removed hourly offer preserves minCommitment, billingIncrement, and attached extension
    expect(within(richDiff).getByText(/Min\. commitment: 2 hours/i)).toBeInTheDocument();
    expect(within(richDiff).getAllByText(/30-minute increments/i).length).toBeGreaterThanOrEqual(1);
    expect(within(richDiff).getByText(/100\s+per extra hour/i)).toBeInTheDocument();
  });
});
