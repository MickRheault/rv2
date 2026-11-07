import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RentalOffersModal } from '@/components/admin/RentalOffersModal';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('RentalOffersModal (#210)', () => {
  const mockMotorcycle = {
    id: 'bike-uuid-1',
    model: 'PCX 160',
    brand: 'Honda',
    currency: 'THB',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays coexisting daily, package (with daily equivalent & attached extension), and calendar-month offers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        offers: [
          {
            id: 'offer-daily',
            offerType: 'daily',
            amount: 500,
            currency: 'THB',
            billingBasis: 'per_day',
            durationUnit: 'day',
            minDuration: 1,
            maxDuration: 6,
            minCommitment: null,
            billingIncrement: null,
            supplierLabel: null,
            isFrom: false,
            sortOrder: 0,
            dailyEquivalent: null,
            extensions: [],
          },
          {
            id: 'offer-pkg',
            offerType: 'package',
            amount: 3000,
            currency: 'THB',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 7,
            maxDuration: 7,
            minCommitment: null,
            billingIncrement: null,
            supplierLabel: 'Weekly Deal',
            isFrom: false,
            sortOrder: 1,
            dailyEquivalent: 428.57,
            extensions: [
              {
                id: 'ext-1',
                amount: 450,
                currency: 'THB',
                billingBasis: 'per_day',
                durationUnit: 'day',
                minDuration: 1,
                maxDuration: null,
                billingIncrement: null,
                supplierLabel: null,
                isFrom: false,
              },
            ],
          },
          {
            id: 'offer-monthly',
            offerType: 'monthly',
            amount: 6000,
            currency: 'THB',
            billingBasis: 'per_calendar_month',
            durationUnit: 'calendar_month',
            minDuration: 1,
            maxDuration: null,
            minCommitment: { value: 3, unit: 'calendar_month' },
            billingIncrement: null,
            supplierLabel: 'Calendar Month Special',
            isFrom: true,
            sortOrder: 2,
            dailyEquivalent: null,
            extensions: [],
          },
        ],
      }),
    });

    render(
      <RentalOffersModal
        isOpen={true}
        onClose={jest.fn()}
        motorcycle={mockMotorcycle}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Weekly Deal/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/per day/i)).toBeInTheDocument();
    expect(screen.getByText(/for 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/428\.57.*daily equivalent/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ 450 THB per extra day/i)).toBeInTheDocument();
    expect(screen.getByText(/per calendar month/i)).toBeInTheDocument();
    expect(screen.getByText(/Min\. commitment: 3 calendar months/i)).toBeInTheDocument();
  });

  it('supports adding a fixed-day package with live daily equivalent preview and attached extension, plus a calendar-month offer without daily equivalent, and saves via PUT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ offers: [] }),
    });

    const onSaved = jest.fn();
    render(
      <RentalOffersModal
        isOpen={true}
        onClose={jest.fn()}
        onSaved={onSaved}
        motorcycle={mockMotorcycle}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No rental offers configured/i)).toBeInTheDocument();
    });

    // Click "Add Rental Offer"
    fireEvent.click(screen.getByRole('button', { name: /Add Rental Offer/i }));

    // Select Offer Type = package
    fireEvent.change(screen.getByLabelText(/Offer Type/i), {
      target: { value: 'package' },
    });

    // Enter amount 3000 and fixed duration 7 days
    fireEvent.change(screen.getByLabelText(/^Amount/i), {
      target: { value: '3000' },
    });
    fireEvent.change(screen.getByLabelText(/Package Duration/i), {
      target: { value: '7' },
    });
    fireEvent.change(screen.getByLabelText(/Supplier Label/i), {
      target: { value: '7-Day Package' },
    });

    // Live read-only daily equivalent preview should appear
    expect(screen.getByText(/428\.57 THB\/day daily equivalent/i)).toBeInTheDocument();

    // Add an attached Extension Charge inside the package offer
    fireEvent.click(screen.getByRole('button', { name: /Add Extension Charge/i }));
    fireEvent.change(screen.getByLabelText(/Extension Amount/i), {
      target: { value: '450' },
    });
    fireEvent.change(screen.getByLabelText(/Extension Billing/i), {
      target: { value: 'per_day' },
    });

    // Stage this offer into the draft list
    fireEvent.click(screen.getByRole('button', { name: /Add Offer to List/i }));

    // Now add a Monthly Calendar-Month offer and verify NO daily equivalent preview is shown
    fireEvent.click(screen.getByRole('button', { name: /Add Rental Offer/i }));
    fireEvent.change(screen.getByLabelText(/Offer Type/i), {
      target: { value: 'monthly' },
    });
    fireEvent.change(screen.getByLabelText(/Monthly Billing Mode/i), {
      target: { value: 'per_calendar_month' },
    });
    fireEvent.change(screen.getByLabelText(/^Amount/i), {
      target: { value: '6000' },
    });
    // Ensure no 200 THB/day or 6000/30 daily equivalent preview appears on calendar_month!
    expect(screen.queryByText(/200(\.00)? THB\/day daily equivalent/i)).not.toBeInTheDocument();

    // Add minimum commitment of 3 calendar months
    fireEvent.change(screen.getByLabelText(/Minimum Commitment Value/i), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText(/Minimum Commitment Unit/i), {
      target: { value: 'calendar_month' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Offer to List/i }));

    // Mock PUT response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        offers: [
          {
            id: 'saved-1',
            offerType: 'package',
            amount: 3000,
            currency: 'THB',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 7,
            maxDuration: 7,
            minCommitment: null,
            billingIncrement: null,
            supplierLabel: '7-Day Package',
            isFrom: false,
            sortOrder: 0,
            dailyEquivalent: 428.57,
            extensions: [
              {
                id: 'saved-ext-1',
                amount: 450,
                currency: 'THB',
                billingBasis: 'per_day',
                durationUnit: 'day',
                minDuration: 1,
                maxDuration: null,
                billingIncrement: null,
                supplierLabel: null,
                isFrom: false,
              },
            ],
          },
          {
            id: 'saved-2',
            offerType: 'monthly',
            amount: 6000,
            currency: 'THB',
            billingBasis: 'per_calendar_month',
            durationUnit: 'calendar_month',
            minDuration: 1,
            maxDuration: null,
            minCommitment: { value: 3, unit: 'calendar_month' },
            billingIncrement: null,
            supplierLabel: null,
            isFrom: false,
            sortOrder: 1,
            dailyEquivalent: null,
            extensions: [],
          },
        ],
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Rental Offers/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/motorcycles/bike-uuid-1/offers',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    const putCall = mockFetch.mock.calls.find((c) => c[1]?.method === 'PUT');
    const sentPayload = JSON.parse(putCall[1].body);
    expect(sentPayload.offers).toHaveLength(2);
    expect(sentPayload.offers[0]).toMatchObject({
      offerType: 'package',
      amount: 3000,
      currency: 'THB',
      billingBasis: 'package_total',
      durationUnit: 'day',
      minDuration: 7,
      maxDuration: 7,
      supplierLabel: '7-Day Package',
      extensions: [
        {
          amount: 450,
          currency: 'THB',
          billingBasis: 'per_day',
        },
      ],
    });
    expect(sentPayload.offers[1]).toMatchObject({
      offerType: 'monthly',
      amount: 6000,
      currency: 'THB',
      billingBasis: 'per_calendar_month',
      durationUnit: 'calendar_month',
      minDuration: 1,
      minCommitment: { value: 3, unit: 'calendar_month' },
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
