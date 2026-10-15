import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FlagContentForm from '@/components/common/FlagContentForm';
import { FlaggedContentService } from '@/services/flagged-content';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }),
      signOut: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('FlagContentForm & FlaggedContentService Model Year Range Support (#139)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FlagContentForm', () => {
    it('renders the year input as text and allows entering a bounded range "2015-2020"', async () => {
      const createSpy = jest
        .spyOn(FlaggedContentService, 'createFlaggedContent')
        .mockResolvedValue({ id: 'flag-1' } as any);

      const entityData = {
        id: 'bike-1',
        model: 'CB500X',
        year: 2020,
        year_to: null,
        engine_capacity_cc: 471,
        rental_rate_per_day: 25,
        rental_rate_currency: 'USD',
      };

      render(
        <FlagContentForm
          contentType="motorcycle"
          entityId="bike-1"
          entityData={entityData}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
          isSubmitting={false}
          setIsSubmitting={jest.fn()}
        />
      );

      const yearInput = screen.getByPlaceholderText(/2015-2020/i) as HTMLInputElement;
      expect(yearInput).toBeInTheDocument();
      expect(yearInput.type).toBe('text');
      expect(yearInput.value).toBe('2020');

      fireEvent.change(yearInput, { target: { value: '2015-2020' } });
      expect(yearInput.value).toBe('2015-2020');

      const reasonInput = screen.getByPlaceholderText(/Describe what's wrong/i);
      fireEvent.change(reasonInput, { target: { value: 'Shop rents the 2015-2020 generation' } });

      fireEvent.click(screen.getByRole('button', { name: /Submit Report/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            content_type: 'motorcycle',
            entity_id: 'bike-1',
            proposed_data: expect.objectContaining({
              year: '2015-2020',
            }),
          }),
          entityData
        );
      });

      createSpy.mockRestore();
    });

    it('initializes the year input with formatted range when entityData has year and year_to', () => {
      render(
        <FlagContentForm
          contentType="motorcycle"
          entityId="bike-1"
          entityData={{
            id: 'bike-1',
            model: 'CB500X',
            year: 2015,
            year_to: 2020,
          }}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
          isSubmitting={false}
          setIsSubmitting={jest.fn()}
        />
      );

      const yearInput = screen.getByDisplayValue('2015-2020') as HTMLInputElement;
      expect(yearInput).toBeInTheDocument();
      expect(yearInput.type).toBe('text');
    });
  });

  describe('FlaggedContentService.applyMotorcycleChanges', () => {
    it('normalizes a range string "2015-2020" into year: 2015 and year_to: 2020 on motorcycle_rentals', async () => {
      const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as jest.Mock).mockReturnValue({ update: updateMock });

      await FlaggedContentService.applyMotorcycleChanges('bike-1', {
        year: '2015-2020',
      });

      expect(supabase.from).toHaveBeenCalledWith('motorcycle_rentals');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2015,
          year_to: 2020,
        })
      );
      expect(eqMock).toHaveBeenCalledWith('id', 'bike-1');
    });

    it('normalizes a single year "2023" into year: 2023 and year_to: null on motorcycle_rentals', async () => {
      const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as jest.Mock).mockReturnValue({ update: updateMock });

      await FlaggedContentService.applyMotorcycleChanges('bike-1', {
        year: '2023',
      });

      expect(supabase.from).toHaveBeenCalledWith('motorcycle_rentals');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2023,
          year_to: null,
        })
      );
      expect(eqMock).toHaveBeenCalledWith('id', 'bike-1');
    });
  });
});
