import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ChangeProposalsPage from '@/app/admin/change-proposals/page';
import ProposalReviewPage from '@/app/admin/change-proposals/[id]/page';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/services/shops', () => ({
  shopService: {
    getAllShopsForDropdown: jest.fn().mockResolvedValue([
      { id: 'shop-1', provider_name: 'Pai Motor Shop' },
      { id: 'shop-2', provider_name: 'Samui Scooter Club' },
    ]),
  },
}));

describe('ChangeProposalsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders proposals with summary badges and shop names', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [
          {
            id: 'prop-1',
            shopId: 'shop-1',
            shopName: 'Big Bike Chiang Mai',
            sourceUrl: 'https://bigbike.com/rentals',
            status: 'pending',
            summaryCounts: { add: 3, update: 2, delist: 1 },
            createdAt: '2026-10-10T12:00:00Z',
          },
        ],
        totalCount: 1,
      }),
    });

    render(<ChangeProposalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Big Bike Chiang Mai')).toBeInTheDocument();
    });

    expect(screen.getByText('+3 new')).toBeInTheDocument();
    expect(screen.getByText('~2 updated')).toBeInTheDocument();
    expect(screen.getByText('-1 delisted')).toBeInTheDocument();
    expect(screen.getAllByText('Pending Review').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no proposals exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [],
        totalCount: 0,
      }),
    });

    render(<ChangeProposalsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No change proposals found matching current filter/i)
      ).toBeInTheDocument();
    });
  });

  it('switches to Crawler Activity Log tab, renders runs, and changes filter', async () => {
    // Initial fetch for proposals
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [],
        totalCount: 0,
      }),
    });

    // Fetch for crawler logs on tab switch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        runs: [
          {
            id: 'run-1',
            shopId: 'shop-1',
            shopName: 'Pai Motor Shop',
            status: 'success',
            proposalId: 'prop-abc',
            proposalSummaryCounts: { add: 2, update: 1, delist: 0 },
            createdAt: '2026-10-11T08:00:00Z',
            metadata: { bikesCount: 10 },
          },
          {
            id: 'run-2',
            shopId: 'shop-2',
            shopName: 'Samui Scooter Club',
            status: 'success',
            proposalId: null,
            createdAt: '2026-10-11T09:00:00Z',
            metadata: { bikesCount: 8 },
          },
          {
            id: 'run-3',
            shopId: 'shop-3',
            shopName: 'Phuket Bike Hub',
            status: 'failed',
            proposalId: null,
            errorMessage: 'Cloudflare captcha challenge encountered',
            createdAt: '2026-10-11T10:00:00Z',
            metadata: { httpStatus: 403 },
          },
        ],
        totalCount: 3,
      }),
    });

    render(<ChangeProposalsPage />);

    // Click "Crawler Activity Log" tab
    const crawlerTab = screen.getByRole('button', { name: /Crawler Activity Log/i });
    fireEvent.click(crawlerTab);

    await waitFor(() => {
      expect(screen.getAllByText('Pai Motor Shop').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText('Samui Scooter Club').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Phuket Bike Hub')).toBeInTheDocument();
    expect(screen.getByText('Proposal Generated')).toBeInTheDocument();
    expect(screen.getByText('Clean Crawl (No changes detected)')).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare captcha challenge encountered/i)).toBeInTheDocument();

    // Verify filter dropdown change
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        runs: [
          {
            id: 'run-3',
            shopId: 'shop-3',
            shopName: 'Phuket Bike Hub',
            status: 'failed',
            errorMessage: 'Cloudflare captcha challenge encountered',
            createdAt: '2026-10-11T10:00:00Z',
            metadata: { httpStatus: 403 },
          },
        ],
        totalCount: 1,
      }),
    });

    const select = screen.getByDisplayValue('All Runs');
    fireEvent.change(select, { target: { value: 'failed' } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/admin/crawler-logs?status=failed&limit=50');
    });

    // Verify shop filter dropdown change
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        runs: [],
        totalCount: 0,
      }),
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('All Shops')).toBeInTheDocument();
    });
    const shopSelect = screen.getByDisplayValue('All Shops');
    fireEvent.change(shopSelect, { target: { value: 'shop-1' } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/admin/crawler-logs?status=failed&limit=50&shopId=shop-1');
    });
  });

  it('opens details modal when clicking View Details on a run', async () => {
    // Initial fetch for proposals
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [],
        totalCount: 0,
      }),
    });

    // Fetch for crawler logs on tab switch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        runs: [
          {
            id: 'run-fail',
            shopId: 'shop-err',
            shopName: 'Chiang Rai Motos',
            agentRunId: 'agent-run-99',
            status: 'failed',
            errorMessage: 'Connection timed out after 30000ms',
            createdAt: '2026-10-11T11:00:00Z',
            metadata: { retryCount: 3, proxy: 'sg-node-1' },
          },
        ],
        totalCount: 1,
      }),
    });

    render(<ChangeProposalsPage />);

    // Switch to crawler logs
    fireEvent.click(screen.getByRole('button', { name: /Crawler Activity Log/i }));

    await waitFor(() => {
      expect(screen.getByText('Chiang Rai Motos')).toBeInTheDocument();
    });

    // Click "View Details"
    const viewDetailsBtn = screen.getByRole('button', { name: /View Details/i });
    fireEvent.click(viewDetailsBtn);

    // Modal should be open
    expect(screen.getByText('Crawl Attempt Details')).toBeInTheDocument();
    expect(screen.getAllByText('Connection timed out after 30000ms').length).toBe(2);
    expect(screen.getByText('agent-run-99')).toBeInTheDocument();
    expect(screen.getByText(/"proxy": "sg-node-1"/i)).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Crawl Attempt Details')).not.toBeInTheDocument();
    expect(screen.getAllByText('Connection timed out after 30000ms').length).toBe(1);
  });

  it('renders a "View on GMR" public shop link and executes one-click Reject on a pending proposal row', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [
          {
            id: 'prop-we-scooter',
            shopId: '2b97f3dc-b0af-42b0-bb3a-68d286d94ef3',
            shopName: 'We Scooter Rental Siem Reap',
            shopSlug: 'we-scooter-rental-siem-reap',
            shopUrl: '/shop/cambodia/siem-reap/we-scooter-rental-siem-reap',
            sourceUrl: 'https://wescooterrentalsiemreap.com/',
            status: 'pending',
            summaryCounts: { add: 1, update: 1, delist: 0 },
            createdAt: '2026-10-15T12:00:00Z',
          },
        ],
        totalCount: 1,
      }),
    });

    render(<ChangeProposalsPage />);

    await waitFor(() => {
      expect(screen.getByText('We Scooter Rental Siem Reap')).toBeInTheDocument();
    });

    // Verify "View on GMR" link points to canonical shopUrl and opens in a new tab
    const gmrLink = screen.getByRole('link', { name: /View on GMR/i });
    expect(gmrLink).toHaveAttribute('href', '/shop/cambodia/siem-reap/we-scooter-rental-siem-reap');
    expect(gmrLink).toHaveAttribute('target', '_blank');

    // Mock POST /api/admin/change-proposals/prop-we-scooter/apply with approvedItemIds: []
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        appliedCount: 0,
        status: 'rejected',
      }),
    });

    // Mock refreshed proposals list after rejection
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [],
        totalCount: 0,
      }),
    });

    const rejectBtn = screen.getByRole('button', { name: /Reject/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/change-proposals/prop-we-scooter/apply',
        expect.objectContaining({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [] }),
        })
      );
    });
  });

  it('redirects to /admin/change-proposals when Reject Proposal is clicked on ProposalReviewPage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        proposal: {
          id: 'prop-detail-1',
          shop_id: 'shop-1',
          source_url: 'https://wescooterrentalsiemreap.com/',
          shop_url: '/shop/cambodia/siem-reap/we-scooter-rental-siem-reap',
          status: 'pending',
          created_at: '2026-10-15T12:00:00Z',
          rental_shops: {
            provider_name: 'We Scooter Rental Siem Reap',
            slug: 'we-scooter-rental-siem-reap',
          },
        },
        items: [
          {
            id: 'item-1',
            proposal_id: 'prop-detail-1',
            entity_type: 'motorcycle',
            action: 'add',
            entity_id: null,
            brand_name: 'Honda',
            model_name: 'Click 125',
            original_data: null,
            proposed_data: { rates: [{ minDays: 1, ratePerDay: 11, currency: 'USD' }] },
            diff_summary: null,
            status: 'pending',
          },
        ],
      }),
    });

    await React.act(async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <ProposalReviewPage params={Promise.resolve({ id: 'prop-detail-1' })} />
        </React.Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('We Scooter Rental Siem Reap')).toBeInTheDocument();
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        appliedCount: 0,
        status: 'rejected',
      }),
    });

    const rejectBtn = screen.getByRole('button', { name: /Reject Proposal/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/change-proposals');
    });
  });

  it('renders formatted Model Year Range subtitles and unified diff_summary.year transitions in ChangeProposalDiffViewer (#138)', async () => {
    const { ChangeProposalDiffViewer } = await import(
      '@/components/admin/ChangeProposalDiffViewer'
    );

    render(
      <ChangeProposalDiffViewer
        proposal={{
          id: 'prop-gen-1',
          shop_id: 'shop-1',
          source_url: 'https://example.com/rates',
          status: 'pending',
          created_at: '2026-10-15T12:00:00Z',
          rental_shops: {
            provider_name: 'Chiang Mai Moto',
            slug: 'chiang-mai-moto',
          },
        }}
        items={[
          {
            id: 'item-add-gen',
            proposal_id: 'prop-gen-1',
            entity_type: 'motorcycle',
            action: 'add',
            entity_id: null,
            brand_name: 'Honda',
            model_name: 'Click 125',
            original_data: null,
            proposed_data: {
              year: 2021,
              year_to: 2024,
              engineCapacityCc: 125,
              rates: [{ minDays: 1, ratePerDay: 250, currency: 'THB' }],
            },
            diff_summary: null,
            status: 'pending',
          },
          {
            id: 'item-update-gen',
            proposal_id: 'prop-gen-1',
            entity_type: 'motorcycle',
            action: 'update',
            entity_id: 'bike-1',
            brand_name: 'Honda',
            model_name: 'CB500X',
            original_data: { year: 2020, year_to: null },
            proposed_data: {
              year: 2015,
              year_to: 2020,
              engineCapacityCc: 471,
              rates: [{ minDays: 1, ratePerDay: 800, currency: 'THB' }],
            },
            diff_summary: {
              year: { old: '2020', new: '2015-2020' },
            },
            status: 'pending',
          },
          {
            id: 'item-unchanged-gen',
            proposal_id: 'prop-gen-1',
            entity_type: 'motorcycle',
            action: 'unchanged',
            entity_id: 'bike-2',
            brand_name: 'Yamaha',
            model_name: 'NMAX 155',
            original_data: { year: 2018, year_to: 2022 },
            proposed_data: {
              year: 2018,
              year_to: 2022,
              engineCapacityCc: 155,
              rates: [{ minDays: 1, ratePerDay: 350, currency: 'THB' }],
            },
            diff_summary: null,
            status: 'applied',
          },
        ]}
      />
    );

    expect(screen.getByText('Year: 2021-2024')).toBeInTheDocument();
    expect(screen.getByText('Year: 2015-2020')).toBeInTheDocument();
    expect(screen.getByText('2020')).toBeInTheDocument();
    expect(screen.getByText('2015-2020')).toBeInTheDocument();

    // Confirmed Unchanged Inventory is expanded by default (#199) and toggles cleanly
    expect(screen.getByText('Year: 2018-2022')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirmed Unchanged Inventory/i }));
    expect(screen.queryByText('Year: 2018-2022')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirmed Unchanged Inventory/i }));
    expect(screen.getByText('Year: 2018-2022')).toBeInTheDocument();
  });

  it('renders Category name and UUID on add, old -> new Category transitions (including Uncategorized null) on update, and error badges for unknown category IDs (#197)', async () => {
    const { ChangeProposalDiffViewer } = await import(
      '@/components/admin/ChangeProposalDiffViewer'
    );

    const SCOOTER_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';
    const ADVENTURE_ID = 'c375e3d9-e4df-4e09-8688-e7b26e78861c';
    const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

    render(
      <ChangeProposalDiffViewer
        proposal={{
          id: 'prop-cat-review',
          shop_id: '7ae96506-52b3-4211-8032-672fa6122da6',
          source_url: 'https://www.motorbikerentbangkok.com/product/honda-forza-350/',
          status: 'pending',
          created_at: '2026-10-28T12:00:00Z',
          rental_shops: {
            provider_name: 'PATOY Motorbike Rent Bangkok',
            slug: 'patoy-motorbike-rent-bangkok',
          },
        }}
        items={[
          {
            id: 'item-add-forza',
            proposal_id: 'prop-cat-review',
            entity_type: 'motorcycle',
            action: 'add',
            entity_id: null,
            brand_name: 'Honda',
            model_name: 'Forza 350',
            original_data: null,
            proposed_data: {
              categoryId: SCOOTER_ID,
              categoryName: 'Scooter',
              rates: [
                { minDays: 1, maxDays: 1, ratePerDay: 1200, currency: 'THB' },
                { minDays: 7, maxDays: 7, ratePerDay: 714.29, currency: 'THB' },
                { minDays: 30, maxDays: 30, ratePerDay: 466.67, currency: 'THB' },
              ],
            },
            diff_summary: null,
            status: 'pending',
          },
          {
            id: 'item-update-cat',
            proposal_id: 'prop-cat-review',
            entity_type: 'motorcycle',
            action: 'update',
            entity_id: 'bike-cb500x',
            brand_name: 'Honda',
            model_name: 'CB500X',
            original_data: {
              categoryId: SCOOTER_ID,
              categoryName: 'Scooter',
            },
            proposed_data: {
              categoryId: ADVENTURE_ID,
              categoryName: 'Adventure',
            },
            diff_summary: null,
            status: 'pending',
          },
          {
            id: 'item-update-from-null',
            proposal_id: 'prop-cat-review',
            entity_type: 'motorcycle',
            action: 'update',
            entity_id: 'bike-wave',
            brand_name: 'Honda',
            model_name: 'Wave 110i',
            original_data: {
              categoryId: null,
              categoryName: null,
            },
            proposed_data: {
              categoryId: SCOOTER_ID,
              categoryName: 'Scooter',
            },
            diff_summary: null,
            status: 'pending',
          },
          {
            id: 'item-unknown-cat',
            proposal_id: 'prop-cat-review',
            entity_type: 'motorcycle',
            action: 'add',
            entity_id: null,
            brand_name: 'Honda',
            model_name: 'Mystery Bike',
            original_data: null,
            proposed_data: {
              categoryId: UNKNOWN_ID,
            },
            diff_summary: null,
            status: 'pending',
          },
        ]}
      />
    );

    expect(
      screen.getByText(`Category: Scooter (${SCOOTER_ID})`)
    ).toBeInTheDocument();
    expect(screen.getAllByText(`Scooter (${SCOOTER_ID})`).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(`Adventure (${ADVENTURE_ID})`)).toBeInTheDocument();
    expect(screen.getByText('Uncategorized (null)')).toBeInTheDocument();
    expect(
      screen.getByText(`Category Error: Unknown category ID (${UNKNOWN_ID})`)
    ).toBeInTheDocument();
  });

  it('displays all unchanged fields, rate tiers, conditions, shop policies, and fleet inventory prominently in green while reserving blue/indigo/red for mutations (#199)', async () => {
    const { ChangeProposalDiffViewer } = await import(
      '@/components/admin/ChangeProposalDiffViewer'
    );

    const SCOOTER_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';
    const DEPOSIT_ID = '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b';
    const LICENSE_ID = '11111111-1111-4111-8111-111111111111';

    render(
      <ChangeProposalDiffViewer
        proposal={{
          id: 'prop-green-unchanged-199',
          shop_id: 'shop-199',
          source_url: 'https://example-shop.com/fleet',
          status: 'pending',
          created_at: '2026-10-30T12:00:00Z',
          rental_shops: {
            provider_name: 'Bangkok Moto Hub',
            slug: 'bangkok-moto-hub',
          },
        }}
        items={[
          {
            id: 'item-add-199',
            proposal_id: 'prop-green-unchanged-199',
            entity_type: 'motorcycle',
            action: 'add',
            entity_id: null,
            brand_name: 'Yamaha',
            model_name: 'XMAX 300',
            original_data: null,
            proposed_data: {
              categoryId: SCOOTER_ID,
              categoryName: 'Scooter',
              year: 2024,
              engineCapacityCc: 292,
              rates: [{ minDays: 1, maxDays: 6, ratePerDay: 900, currency: 'THB' }],
            },
            diff_summary: null,
            status: 'pending',
          },
          {
            id: 'item-update-199',
            proposal_id: 'prop-green-unchanged-199',
            entity_type: 'motorcycle',
            action: 'update',
            entity_id: 'bike-pcx-199',
            brand_name: 'Honda',
            model_name: 'PCX 160',
            // Partial original_data: relies on baseline_data for untouched year/sourceUrl
            original_data: {
              categoryId: SCOOTER_ID,
              categoryName: 'Scooter',
              engineCapacityCc: 157,
              rates: [
                { minDays: 1, maxDays: 6, ratePerDay: 350, currency: 'THB' },
                { minDays: 7, maxDays: 29, ratePerDay: 300, currency: 'THB' },
              ],
              conditions: [
                {
                  condition_type_id: DEPOSIT_ID,
                  name: 'Security Deposit',
                  notes: '3000 THB',
                },
                {
                  condition_type_id: LICENSE_ID,
                  name: 'International Driving Permit',
                  notes: 'Required',
                },
              ],
            },
            proposed_data: {
              // Only daily rate and deposit changed; weekly rate, category, engine, year, sourceUrl, and IDP condition did not change
              rates: [
                { minDays: 1, maxDays: 6, ratePerDay: 400, currency: 'THB' },
                { minDays: 7, maxDays: 29, ratePerDay: 300, currency: 'THB' },
                { minDays: 30, maxDays: null, ratePerDay: 220, currency: 'THB' },
              ],
              conditions: [
                {
                  condition_type_id: DEPOSIT_ID,
                  name: 'Security Deposit',
                  notes: '5000 THB',
                },
                {
                  condition_type_id: LICENSE_ID,
                  name: 'International Driving Permit',
                  notes: 'Required',
                },
              ],
            },
            baseline_data: {
              brand: 'Honda',
              model: 'PCX 160',
              categoryId: SCOOTER_ID,
              categoryName: 'Scooter',
              year: 2023,
              year_to: null,
              engineCapacityCc: 157,
              sourceUrl: 'https://example-shop.com/bikes/pcx-160',
            },
            diff_summary: null,
            status: 'pending',
          },
          {
            id: 'item-shop-199',
            proposal_id: 'prop-green-unchanged-199',
            entity_type: 'rental_shop',
            action: 'update',
            entity_id: 'shop-199',
            brand_name: null,
            model_name: null,
            original_data: {
              phone: '+66 81 000 0000',
              inclusions: ['2 Helmets', 'Phone Holder'],
              conditions: ['Passport Copy', 'Minimum Age 20'],
            },
            proposed_data: {
              phone: '+66 81 999 9999',
              inclusions: ['2 Helmets', 'Phone Holder', 'Raincoat'],
              conditions: ['Passport Copy'],
            },
            baseline_data: {
              business_description: 'Trusted scooter rentals in central Bangkok',
              phone: '+66 81 000 0000',
              website: 'https://example-shop.com',
              inclusions: ['2 Helmets', 'Phone Holder'],
              conditions: ['Passport Copy', 'Minimum Age 20'],
            },
            diff_summary: null,
            status: 'pending',
          },
          {
            id: 'item-unchanged-199',
            proposal_id: 'prop-green-unchanged-199',
            entity_type: 'motorcycle',
            action: 'unchanged',
            entity_id: 'bike-click-199',
            brand_name: 'Honda',
            model_name: 'Click 125i',
            original_data: null,
            proposed_data: {
              categoryId: SCOOTER_ID,
              categoryName: 'Scooter',
              year: 2022,
              engineCapacityCc: 125,
              sourceUrl: 'https://example-shop.com/bikes/click-125i',
              rates: [{ minDays: 1, maxDays: 6, ratePerDay: 250, currency: 'THB' }],
              conditions: [
                {
                  condition_type_id: DEPOSIT_ID,
                  name: 'Security Deposit',
                  notes: '2000 THB',
                },
              ],
            },
            diff_summary: null,
            status: 'applied',
          },
        ]}
      />
    );

    // 1. Summary header reserves emerald green for Unchanged and uses indigo for +New
    const newHeaderPill = screen.getByText('+1 New');
    expect(newHeaderPill.className).toContain('bg-indigo-50');
    expect(newHeaderPill.className).not.toContain('emerald');

    const unchangedHeaderPill = screen.getByText('=1 Unchanged');
    expect(unchangedHeaderPill.className).toContain('bg-emerald-50');

    // + New Bike badge is indigo, not emerald
    const newBikeBadge = screen.getByText('+ New Bike');
    expect(newBikeBadge.className).toContain('bg-indigo-100');
    expect(newBikeBadge.className).not.toContain('emerald');

    // 2. Updated motorcycle card shows all unchanged specs & conditions in green
    const unchangedSpecsBox = screen.getByTestId('unchanged-specs-item-update-199');
    expect(unchangedSpecsBox.className).toContain('bg-emerald-50');
    expect(unchangedSpecsBox).toHaveTextContent(`Category:Scooter (${SCOOTER_ID})`);
    expect(unchangedSpecsBox).toHaveTextContent('Brand:Honda');
    expect(unchangedSpecsBox).toHaveTextContent('Model:PCX 160');
    expect(unchangedSpecsBox).toHaveTextContent('Year:2023');
    expect(unchangedSpecsBox).toHaveTextContent('Engine:157cc');
    expect(unchangedSpecsBox).toHaveTextContent(
      'Source URL:https://example-shop.com/bikes/pcx-160'
    );
    expect(unchangedSpecsBox).toHaveTextContent('International Driving Permit:Required');

    // Changed deposit condition uses blue target pill, not emerald
    const newDepositVal = screen.getByText('5000 THB');
    expect(newDepositVal.className).toContain('text-blue-700');
    expect(newDepositVal.className).not.toContain('emerald');

    // Dynamically paired rate tiers: modified (blue), unchanged (emerald), added (indigo)
    const modifiedRateVal = screen.getByText('฿400/day');
    expect(modifiedRateVal.className).toContain('text-blue-700');

    const unchangedWeeklyRate = screen.getByText('฿300/day').closest('div')!;
    expect(unchangedWeeklyRate.className).toContain('bg-emerald-50');
    expect(unchangedWeeklyRate).toHaveTextContent('7-29 days:');
    expect(unchangedWeeklyRate).toHaveTextContent('✓ Unchanged');

    const addedMonthlyRate = screen.getByText('฿220/day').closest('div')!;
    expect(addedMonthlyRate.className).toContain('bg-indigo-50');
    expect(addedMonthlyRate).toHaveTextContent('+ Added');

    // 3. Shop profile card shows unchanged Description & Website in green and unchanged policies in green
    const unchangedShopBox = screen.getByTestId('unchanged-shop-fields-item-shop-199');
    expect(unchangedShopBox.className).toContain('bg-emerald-50');
    expect(unchangedShopBox).toHaveTextContent(
      'Description:Trusted scooter rentals in central Bangkok'
    );
    expect(unchangedShopBox).toHaveTextContent('Website:https://example-shop.com');

    const changedPhoneVal = screen.getByText('+66 81 999 9999');
    expect(changedPhoneVal.className).toContain('text-blue-700');

    const unchangedHelmetRow = screen.getByText('2 Helmets').closest('div')!;
    expect(unchangedHelmetRow.className).toContain('bg-emerald-50');
    expect(unchangedHelmetRow).toHaveTextContent('✓ Unchanged');

    const addedRaincoatRow = screen.getByText('Raincoat').closest('div')!;
    expect(addedRaincoatRow.className).toContain('bg-indigo-50');
    expect(addedRaincoatRow).toHaveTextContent('+ Added');

    const removedMinAgeRow = screen.getByText('Minimum Age 20').closest('div')!;
    expect(removedMinAgeRow.className).toContain('bg-red-50');
    expect(removedMinAgeRow).toHaveTextContent('- Removed');

    const unchangedPassportRow = screen.getByText('Passport Copy').closest('div')!;
    expect(unchangedPassportRow.className).toContain('bg-emerald-50');
    expect(unchangedPassportRow).toHaveTextContent('✓ Unchanged');

    // 4. Confirmed Unchanged Inventory is expanded by default with green styling and full metadata
    expect(screen.getByText('✓ All Matched')).toBeInTheDocument();
    expect(screen.getByText('Click 125i', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Year: 2022')).toBeInTheDocument();
    expect(screen.getByText('Engine: 125cc')).toBeInTheDocument();
    expect(
      screen.getByText('Source URL: https://example-shop.com/bikes/click-125i')
    ).toBeInTheDocument();
    const unchangedBikeRate = screen.getByText('1-6 days: ฿250/day').parentElement!;
    expect(unchangedBikeRate.className).toContain('bg-emerald-100');
  });

  it('displays report-only Ride On Barcelona proposal in pending queue with separate actionable vs unresolved counts, coverage badges, and Acknowledge support (#202)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [
          {
            id: 'prop-rideon-bcn',
            shopId: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
            shopName: 'Ride On - Alquiler moto Barcelona',
            shopSlug: 'ride-on-alquiler-moto-barcelona',
            shopUrl: '/shop/spain/barcelona/ride-on-alquiler-moto-barcelona',
            agentRunId: 'run-rideon-1',
            sourceUrl: 'https://rideon.es/flota/',
            status: 'pending',
            coverageStatus: 'partial',
            reconciliationStatus: 'unresolved',
            applicationStatus: 'not_applicable',
            version: 1,
            hasReconciliationReport: true,
            summaryCounts: {
              add: 0,
              update: 0,
              delist: 0,
              unchanged: 2,
              unresolved: 1,
              excluded: 1,
              duplicate: 0,
            },
            serverCounts: {
              readyActionableItems: 0,
              accountedDiscoveredModels: 4,
              unresolvedModels: 1,
              unchangedModels: 2,
              excludedModels: 1,
              duplicateModels: 0,
              pagesProcessed: 1,
              pagesFailed: 1,
              pagesNotProcessed: 0,
              add: 0,
              update: 0,
              delist: 0,
            },
            createdAt: '2026-10-31T14:00:00Z',
          },
        ],
        totalCount: 1,
      }),
    });

    render(<ChangeProposalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Ride On - Alquiler moto Barcelona')).toBeInTheDocument();
    });

    // Separate actionable vs unresolved counts — never says "No changes detected"
    expect(screen.getByText('0 ready mutations')).toBeInTheDocument();
    expect(screen.getByText('1 unresolved')).toBeInTheDocument();
    expect(screen.getByText('=2 unchanged')).toBeInTheDocument();
    expect(screen.getByText('1 excluded')).toBeInTheDocument();
    expect(screen.queryByText(/No changes detected/i)).not.toBeInTheDocument();

    // Prominent coverage & reconciliation status badges
    expect(screen.getByText('Partial Coverage')).toBeInTheDocument();
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
    expect(screen.getByText('Report Only')).toBeInTheDocument();

    // Filter options include Acknowledged and Superseded
    expect(screen.getByRole('option', { name: 'Acknowledged' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Superseded' })).toBeInTheDocument();

    // Quick Acknowledge sends action: 'acknowledge' with expectedVersion: 1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        status: 'acknowledged',
        applicationStatus: 'not_applicable',
        version: 2,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        proposals: [],
        totalCount: 0,
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: /^Acknowledge$/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/change-proposals/prop-rideon-bcn/apply',
        expect.objectContaining({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'acknowledge', expectedVersion: 1 }),
        })
      );
    });
  });

  it('loads full reconciliation report on ProposalReviewPage and acknowledges report-only Ride On submission without claiming inventory updated (#202)', async () => {
    const reloadSpy = { called: 0 };
    mockFetch.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        proposal: {
          id: 'prop-rideon-detail',
          shop_id: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
          source_url: 'https://rideon.es/flota/',
          status: 'pending',
          coverage_status: 'partial',
          reconciliation_status: 'unresolved',
          application_status: 'not_applicable',
          version: 1,
          created_at: '2026-10-31T14:00:00Z',
          rental_shops: {
            provider_name: 'Ride On - Alquiler moto Barcelona',
            slug: 'ride-on-alquiler-moto-barcelona',
          },
        },
        items: [],
        report: {
          id: 'rep-rideon-1',
          proposalId: 'prop-rideon-detail',
          shopId: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
          agentRunId: 'run-rideon-1',
          schemaVersion: 1,
          reportVersion: 1,
          reportDigest: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          scope: {
            branch: 'Barcelona',
            catalogType: 'global_catalog',
            services: ['daily_rental'],
            availabilityBasis: 'supplier_catalog_not_live_stock',
          },
          coverage: {
            status: 'partial',
            discoveryComplete: false,
            limitations: ['Dynamic booking modal blocked verified rate extraction for BMW R 1250 GS'],
            pages: [
              {
                url: 'https://rideon.es/flota/',
                role: 'catalog',
                required: true,
                status: 'processed',
              },
              {
                url: 'https://rideon.es/flota/bmw-r-1250-gs/',
                role: 'pricing',
                required: true,
                status: 'failed',
                reason: 'Interactive date modal required session token',
              },
            ],
          },
          serverCounts: {
            readyActionableItems: 0,
            accountedDiscoveredModels: 1,
            unresolvedModels: 1,
            unchangedModels: 0,
            excludedModels: 0,
            duplicateModels: 0,
            pagesProcessed: 1,
            pagesFailed: 1,
            pagesNotProcessed: 0,
            add: 0,
            update: 0,
            delist: 0,
          },
        },
        entries: [
          {
            id: 'entry-bmw-1',
            entryIndex: 0,
            entryKey: 'bmw-r-1250-gs',
            brand: 'BMW',
            model: 'R 1250 GS',
            existingMotorcycleId: null,
            candidateId: 'cand-bmw-1',
            disposition: 'unresolved',
            proposalItemRefs: [],
            linkedProposalItemIds: [],
            issues: [
              { code: 'PRICE_UNVERIFIED', detail: 'Rental price not verified.' },
              { code: 'BRANCH_CONFLICT', detail: 'Displayed Barcelona label links to Madrid.' },
            ],
            nextAction: 'Resolve branch conflict and obtain verified pricing before proposing an addition.',
            evidence: [
              {
                sourceUrl: 'https://rideon.es/flota/',
                linkedUrl: 'https://rideon.es/madrid/',
                kind: 'branch_badge',
                snippet: 'BMW R 1250 GS — BARCELONA badge href points to /madrid/',
              },
            ],
          },
        ],
        entriesPagination: {
          total: 1,
          limit: 200,
          offset: 0,
          hasMore: false,
          nextOffset: null,
        },
        candidates: [
          {
            id: 'cand-bmw-1',
            brand_name: 'BMW',
            model_name: 'R 1250 GS',
            state: 'open',
            flagged_for_review: false,
            version: 1,
          },
        ],
      }),
    }));

    await React.act(async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <ProposalReviewPage params={Promise.resolve({ id: 'prop-rideon-detail' })} />
        </React.Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Ride On - Alquiler moto Barcelona')).toBeInTheDocument();
    });

    // Renders Ride On BMW R 1250 GS unresolved details from API payload
    expect(screen.getByText('BMW R 1250 GS')).toBeInTheDocument();
    expect(screen.getByText('PRICE_UNVERIFIED')).toBeInTheDocument();
    expect(screen.getByText('BRANCH_CONFLICT')).toBeInTheDocument();
    expect(
      screen.getByText('Resolve branch conflict and obtain verified pricing before proposing an addition.')
    ).toBeInTheDocument();

    // Acknowledge Report button triggers POST /apply with action: 'acknowledge' and refreshes detail
    mockFetch.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        status: 'acknowledged',
        coverageStatus: 'partial',
        reconciliationStatus: 'unresolved',
        applicationStatus: 'not_applicable',
        version: 2,
      }),
    }));
    mockFetch.mockImplementationOnce(async () => {
      reloadSpy.called += 1;
      return {
        ok: true,
        json: async () => ({
          success: true,
          proposal: {
            id: 'prop-rideon-detail',
            shop_id: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
            source_url: 'https://rideon.es/flota/',
            status: 'acknowledged',
            coverage_status: 'partial',
            reconciliation_status: 'unresolved',
            application_status: 'not_applicable',
            version: 2,
            created_at: '2026-10-31T14:00:00Z',
            rental_shops: {
              provider_name: 'Ride On - Alquiler moto Barcelona',
              slug: 'ride-on-alquiler-moto-barcelona',
            },
          },
          items: [],
          report: {
            id: 'rep-rideon-1',
            schemaVersion: 1,
            reportVersion: 1,
            reportDigest: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            scope: {
              branch: 'Barcelona',
              services: ['daily_rental'],
              availabilityBasis: 'supplier_catalog_not_live_stock',
            },
            coverage: {
              status: 'partial',
              discoveryComplete: false,
              limitations: [],
              pages: [],
            },
            serverCounts: {
              readyActionableItems: 0,
              accountedDiscoveredModels: 1,
              unresolvedModels: 1,
              unchangedModels: 0,
              excludedModels: 0,
              duplicateModels: 0,
              pagesProcessed: 1,
              pagesFailed: 1,
              pagesNotProcessed: 0,
              add: 0,
              update: 0,
              delist: 0,
            },
          },
          entries: [],
        }),
      };
    });

    fireEvent.click(screen.getByRole('button', { name: /Acknowledge Report/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/change-proposals/prop-rideon-detail/apply',
        expect.objectContaining({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'acknowledge', expectedVersion: 1 }),
        })
      );
      expect(reloadSpy.called).toBe(1);
    });

    expect(screen.queryByText(/inventory updated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/successfully applied/i)).not.toBeInTheDocument();
  });
});


