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

  describe('FlaggedContentService.applyFlaggedContentChanges', () => {
    it('delegates to apply_flagged_content_changes RPC and updates SQL function in migration to normalize year and year_to', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });

      const result = await FlaggedContentService.applyFlaggedContentChanges('flag-1');
      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('apply_flagged_content_changes', {
        flagged_content_id: 'flag-1',
        admin_id: 'admin-1',
      });

      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261015230000_add_motorcycle_year_to.sql'
      );
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION apply_flagged_content_changes/i);
      expect(sql).toMatch(/parsed_end\s*=\s*parsed_start/i);
      expect(sql).toMatch(/parsed_end\s*<\s*parsed_start/i);
    });

    it('hardens apply_flagged_content_changes against SQL injection and missing admin authorization (#165)', () => {
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261020000000_harden_apply_flagged_content_changes_rpc.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // 1. SECURITY DEFINER + pinned search_path
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_flagged_content_changes\(flagged_content_id UUID,\s*admin_id UUID\)/i);
      expect(sql).toMatch(/SECURITY DEFINER/i);
      expect(sql).toMatch(/SET search_path = public, extensions/i);

      // 2. Explicit admin / service_role authorization check (must not check current_user inside SECURITY DEFINER)
      expect(sql).toMatch(/IF COALESCE\(auth\.role\(\), ''\) <> 'service_role'\s+AND NOT public\.is_admin\(\) THEN/i);
      expect(sql).not.toMatch(/current_user/i);
      expect(sql).toMatch(/RAISE EXCEPTION 'Access denied: admin privileges required'/i);

      // 3. Audit trail verified against auth.uid() and bound to auth.uid()
      expect(sql).toMatch(/IF auth\.uid\(\) IS NOT NULL AND admin_id IS NOT NULL AND admin_id <> auth\.uid\(\) THEN/i);
      expect(sql).toMatch(/acting_admin_id\s*:=\s*COALESCE\(auth\.uid\(\),\s*admin_id\)/i);
      expect(sql).toMatch(/applied_by_admin_id\s*=\s*acting_admin_id/i);

      // 4. Explicit per-content_type column allowlist and safe identifier quoting with format('%I', ...)
      expect(sql).toMatch(/allowed_fields\s*:=\s*ARRAY\[/i);
      expect(sql).toMatch(/NOT\s*\(field_name\s*=\s*ANY\(allowed_fields\)\)/i);
      expect(sql).toMatch(/RAISE EXCEPTION 'Disallowed field "%" for content_type "%"'/i);
      expect(sql).toMatch(/format\('%I = %L',\s*field_name,\s*field_value\)/i);
      expect(sql).toMatch(/format\('%I = NULL',\s*field_name\)/i);
      expect(sql).not.toMatch(/update_query\s*\|\|\s*field_name\s*\|\|/i);

      // 5. Function EXECUTE grants revoked from PUBLIC and anon
      expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.apply_flagged_content_changes\(UUID,\s*UUID\) FROM PUBLIC,\s*anon/i);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_flagged_content_changes\(UUID,\s*UUID\) TO authenticated,\s*service_role/i);

      // 6. flagged_content INSERT RLS restricted to pending status and null admin fields
      expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow insert for all users" ON public\.flagged_content/i);
      expect(sql).toMatch(/CREATE POLICY "Allow insert for all users" ON public\.flagged_content/i);
      expect(sql).toMatch(/status = 'pending'/i);
      expect(sql).toMatch(/reviewed_by_admin_id IS NULL/i);
      expect(sql).toMatch(/applied_by_admin_id IS NULL/i);
    });
  });

  describe('FlaggedContentService.createFlaggedContent proposed_data allowlist validation (#165)', () => {
    it('rejects disallowed SQL-injection keys in proposed_data before inserting', async () => {
      await expect(
        FlaggedContentService.createFlaggedContent(
          {
            content_type: 'motorcycle',
            entity_id: 'bike-1',
            flag_category: 'incorrect_info',
            flag_reason: 'Injected key attempt',
            proposed_data: {
              'model = \'x\'; DROP TABLE user_roles; --': 'malicious',
            },
            flagged_by_email: 'test@example.com',
          },
          { id: 'bike-1', model: 'CB500X' }
        )
      ).rejects.toThrow(/Disallowed field in proposed_data/i);

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('accepts allowlisted rental_shop fields, strips immutable metadata, and enforces status = pending', async () => {
      const singleMock = jest.fn().mockResolvedValue({ data: { id: 'flag-shop-1', status: 'pending' }, error: null });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      const insertMock = jest.fn().mockReturnValue({ select: selectMock });
      (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });

      await FlaggedContentService.createFlaggedContent(
        {
          content_type: 'rental_shop',
          entity_id: 'shop-1',
          flag_category: 'contact_error',
          flag_reason: 'Updated phone and website',
          proposed_data: {
            id: 'should-be-stripped',
            phone: '+66 81 234 5678',
            website: 'https://example.com',
          },
          flagged_by_email: 'rider@example.com',
          ...({ status: 'approved', reviewed_by_admin_id: 'spoofed-admin' } as any),
        },
        { id: 'shop-1', provider_name: 'Test Shop' }
      );

      expect(insertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          content_type: 'rental_shop',
          entity_id: 'shop-1',
          proposed_data: {
            phone: '+66 81 234 5678',
            website: 'https://example.com',
          },
          status: 'pending',
        }),
      ]);
      const insertedPayload = insertMock.mock.calls[0][0][0];
      expect(insertedPayload.reviewed_by_admin_id).toBeUndefined();
      expect(insertedPayload.proposed_data.id).toBeUndefined();
    });

    it('does not expose non-column joined relation names (brand_name, category_name, city_name) in FlagContentForm', () => {
      render(
        <FlagContentForm
          contentType="motorcycle"
          entityId="bike-1"
          entityData={{
            id: 'bike-1',
            model: 'CB500X',
            year: 2020,
            brands: { name: 'Honda' },
            categories: { name: 'Adventure' },
          }}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
          isSubmitting={false}
          setIsSubmitting={jest.fn()}
        />
      );

      expect(screen.queryByDisplayValue('Honda')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Adventure')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('CB500X')).toBeInTheDocument();
    });
  });
});

