import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ChangeProposalsPage from '@/app/admin/change-proposals/page';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

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
});
