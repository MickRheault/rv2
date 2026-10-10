import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RentalShopCrawlerModal } from './RentalShopCrawlerModal';
import * as shopAgentConfigsService from '@/services/shop-agent-configs';

jest.mock('@/services/shop-agent-configs', () => {
  const getShopAgentConfig = jest.fn();
  const saveShopAgentConfig = jest.fn();
  return {
    getShopAgentConfig,
    saveShopAgentConfig,
    getShopCrawlerConfig: getShopAgentConfig,
    saveShopCrawlerConfig: saveShopAgentConfig,
  };
});

describe('RentalShopCrawlerModal', () => {
  const mockShop = {
    id: 'shop-uuid-1',
    name: 'Phuket Moto Rentals',
    website: 'https://phuketmoto.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with shop defaults when no existing config', async () => {
    (shopAgentConfigsService.getShopCrawlerConfig as jest.Mock).mockResolvedValue(null);

    render(
      <RentalShopCrawlerModal
        isOpen={true}
        onClose={jest.fn()}
        shop={mockShop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Crawler Settings: Phuket Moto Rentals/i)).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/https:\/\/rentals.example.com\/rates/i)).toHaveValue(
      'https://phuketmoto.com'
    );
    expect(screen.getByLabelText(/Enable Crawler Agent for this Shop/i)).toBeChecked();
  });

  it('loads and displays existing crawler settings', async () => {
    (shopAgentConfigsService.getShopCrawlerConfig as jest.Mock).mockResolvedValue({
      id: 'cfg-1',
      shop_id: 'shop-uuid-1',
      tier: 1,
      source_url: 'https://phuketmoto.com/fleet',
      extraction_hints: 'Only crawl automatic scooters',
      is_active: true,
      last_run_at: '2026-10-05T10:00:00Z',
      consecutive_errors: 0,
      last_error: null,
    });

    render(
      <RentalShopCrawlerModal
        isOpen={true}
        onClose={jest.fn()}
        shop={mockShop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Crawl Status & Telemetry/i)).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/https:\/\/rentals.example.com\/rates/i)).toHaveValue(
      'https://phuketmoto.com/fleet'
    );
    expect(
      screen.getByPlaceholderText(/Prices listed in THB on \/fleet/i)
    ).toHaveValue('Only crawl automatic scooters');
  });

  it('saves updated settings when form is submitted', async () => {
    (shopAgentConfigsService.getShopCrawlerConfig as jest.Mock).mockResolvedValue(null);
    (shopAgentConfigsService.saveShopCrawlerConfig as jest.Mock).mockResolvedValue({
      id: 'new-cfg',
      shop_id: 'shop-uuid-1',
      tier: 1,
      source_url: 'https://phuketmoto.com/rates-2026',
      extraction_hints: 'Updated hint',
      is_active: true,
    });

    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <RentalShopCrawlerModal
        isOpen={true}
        onClose={onClose}
        shop={mockShop}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Crawler Settings: Phuket Moto Rentals/i)).toBeInTheDocument();
    });

    const urlInput = screen.getByPlaceholderText(/https:\/\/rentals.example.com\/rates/i);
    fireEvent.change(urlInput, { target: { value: 'https://phuketmoto.com/rates-2026' } });

    const submitBtn = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(shopAgentConfigsService.saveShopCrawlerConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          shop_id: 'shop-uuid-1',
          source_url: 'https://phuketmoto.com/rates-2026',
        })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
