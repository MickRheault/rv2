import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ChangeProposalsPage from '@/app/admin/change-proposals/page';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

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
});

