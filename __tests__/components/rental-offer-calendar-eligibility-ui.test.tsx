import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MotorcycleDetails from '@/components/motorcycle/MotorcycleDetails';
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard';
import MotorcycleTable from '@/components/motorcycle/MotorcycleTable';
import { RentalOffersModal } from '@/components/admin/RentalOffersModal';
import {
  ChangeProposalDiffViewer,
  type DiffViewerItem,
  type DiffViewerProposal,
  type DiffViewerReportEntry,
} from '@/components/admin/ChangeProposalDiffViewer';
import { SYSTEM_PROMPT } from '@/lib/chat/prompt';
import {
  generateEnhancedMotorcycleSchema,
  generateOfferPricingSchema,
  generateShopMotorcycleSchemas,
} from '@/lib/seo/structured-data';
import { generateMotorcycleSEO } from '@/lib/seo/config';
import type { NormalizedRentalOffer, OfferCalendarEligibility } from '@/lib/rental-offers';

jest.mock('@/components/common/FlagButton', () => ({
  FlagButton: () => <button type="button">Report Issue</button>,
}));

jest.mock('@/components/motorcycle/SameModelWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="same-model-widget" />,
}));

const WEEKEND_SAT_SUN: OfferCalendarEligibility = {
  kind: 'weekend',
  startDay: 'saturday',
  endDay: 'sunday',
  startTime: null,
  endTime: null,
  timezoneBasis: 'shop_local',
};

const LA_DUCATESSA_OFFERS: NormalizedRentalOffer[] = [
  {
    id: 'off-std-2d',
    offerType: 'package',
    amount: 215,
    currency: 'EUR',
    billingBasis: 'package_total',
    durationUnit: 'day',
    minDuration: 2,
    maxDuration: 2,
    minCommitment: null,
    billingIncrement: null,
    supplierLabel: '2-day package',
    isFrom: false,
    calendarEligibility: null,
    overlapPolicy: null,
    sortOrder: 0,
    dailyEquivalent: 107.5,
    extensions: [],
  },
  {
    id: 'off-wknd-2d',
    offerType: 'package',
    amount: 260,
    currency: 'EUR',
    billingBasis: 'package_total',
    durationUnit: 'day',
    minDuration: 2,
    maxDuration: 2,
    minCommitment: null,
    billingIncrement: null,
    supplierLabel: 'Weekend package',
    isFrom: false,
    calendarEligibility: WEEKEND_SAT_SUN,
    overlapPolicy: 'unknown',
    sortOrder: 1,
    dailyEquivalent: 130,
    extensions: [],
  },
];

function buildMotorcycle(overrides: Record<string, any> = {}): any {
  return {
    id: 'bike-ducatessa-1',
    model: 'Scrambler Icon',
    year: 2025,
    year_to: null,
    engine_capacity_cc: 803,
    availability_status: 'available',
    rental_rate_per_day: null,
    rental_rate_currency: 'EUR',
    brands: { id: 'b-ducati', name: 'Ducati' },
    categories: { id: 'c-naked', name: 'Naked' },
    rental_shops: {
      id: 'shop-ducatessa',
      provider_name: 'La Ducatessa',
      slug: 'la-ducatessa',
      cities: {
        name: 'Milan',
        slug: 'milan',
        provinces: {
          name: 'Lombardy',
          countries: { name: 'Italy', slug: 'italy' },
        },
      },
    },
    motorcycle_features: [],
    motorcycle_conditions: [],
    motorcycle_images: [],
    rental_rate_tiers: [],
    rental_offers: LA_DUCATESSA_OFFERS,
    specifications_details: null,
    conditions_details: null,
    ...overrides,
  };
}

describe('Calendar Eligibility & Overlap Policy across UI, Admin, Chat & JSON-LD (#248)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('1. Public MotorcycleDetails, MotorcycleCard & MotorcycleTable', () => {
    it('renders La Ducatessa coexisting standard and weekend packages without cluttered per-row pills/labels while keeping the bottom catalog note', () => {
      const { unmount } = render(<MotorcycleDetails motorcycle={buildMotorcycle()} />);

      const stdOffer = screen.getByTestId('rental-offer-off-std-2d');
      expect(within(stdOffer).getByText('2-day package')).toBeInTheDocument();
      expect(within(stdOffer).getByText('€215')).toBeInTheDocument();
      expect(within(stdOffer).getByText(/for 2 days/i)).toBeInTheDocument();
      expect(within(stdOffer).queryByText(/Fixed Package/i)).not.toBeInTheDocument();
      expect(within(stdOffer).queryByText(/Fixed 2 days/i)).not.toBeInTheDocument();
      expect(within(stdOffer).queryByText(/Saturday–Sunday/i)).not.toBeInTheDocument();

      const wkndOffer = screen.getByTestId('rental-offer-off-wknd-2d');
      expect(within(wkndOffer).getByText('Weekend package')).toBeInTheDocument();
      expect(within(wkndOffer).getByText('€260')).toBeInTheDocument();
      expect(within(wkndOffer).getByText(/for 2 days/i)).toBeInTheDocument();
      // Cluttered per-row labels are intentionally removed from public MotorcycleDetails (#254)
      expect(within(wkndOffer).queryByText(/Fixed Package/i)).not.toBeInTheDocument();
      expect(within(wkndOffer).queryByText(/Saturday–Sunday/i)).not.toBeInTheDocument();
      expect(within(wkndOffer).queryByText(/Fixed 2 days/i)).not.toBeInTheDocument();
      expect(within(wkndOffer).queryByText(/Overlap policy unknown/i)).not.toBeInTheDocument();
      // Never fabricates pickup/return hours
      expect(within(wkndOffer).queryByText(/09:00|18:00|48 hours/i)).not.toBeInTheDocument();

      // Transparent non-authoritative catalog framing note stays visible when calendar-restricted offers exist
      expect(screen.getByTestId('calendar-offers-catalog-note')).toHaveTextContent(
        /confirm exact dates.*directly with the shop/i
      );
      unmount();

      // Unlabeled standard and weekend packages use natural fallback titles (never "Fixed Package")
      render(
        <MotorcycleDetails
          motorcycle={buildMotorcycle({
            rental_offers: LA_DUCATESSA_OFFERS.map((o) => ({ ...o, supplierLabel: null })),
          })}
        />
      );
      expect(within(screen.getByTestId('rental-offer-off-std-2d')).getByText('2-day package')).toBeInTheDocument();
      expect(within(screen.getByTestId('rental-offer-off-wknd-2d')).getByText('Weekend package')).toBeInTheDocument();
      expect(screen.queryByText(/Fixed Package/i)).not.toBeInTheDocument();
    });

    it('keeps restricted-only (Sat–Sun) suffix on header/card/table while omitting per-row calendar/overlap/type pills on MotorcycleDetails', () => {
      const restrictedOnlyBike = buildMotorcycle({
        id: 'bike-wknd-only',
        rental_offers: [
          {
            ...LA_DUCATESSA_OFFERS[1],
            id: 'off-wknd-timed',
            calendarEligibility: {
              ...WEEKEND_SAT_SUN,
              startTime: '09:00',
              endTime: '18:00',
            },
            overlapPolicy: 'replaces_standard',
          },
        ],
      });

      const { unmount } = render(<MotorcycleDetails motorcycle={restrictedOnlyBike} />);
      expect(screen.getByText(/for 2 days \(Sat–Sun, 09:00–18:00\)/i)).toBeInTheDocument();
      const timedCard = screen.getByTestId('rental-offer-off-wknd-timed');
      expect(within(timedCard).getByText('Weekend package')).toBeInTheDocument();
      expect(within(timedCard).queryByText(/Fixed Package/i)).not.toBeInTheDocument();
      expect(within(timedCard).queryByText(/Saturday–Sunday/i)).not.toBeInTheDocument();
      expect(within(timedCard).queryByText(/Fixed 2 days/i)).not.toBeInTheDocument();
      expect(
        within(timedCard).queryByText(/Replaces standard rates on eligible days/i)
      ).not.toBeInTheDocument();
      unmount();

      // Listing card prefers unrestricted headline for coexisting bike, and appends (Sat–Sun) for restricted-only bike
      const { unmount: unmountCard1 } = render(<MotorcycleCard motorcycle={buildMotorcycle()} />);
      expect(screen.getByText('for 2 days')).toBeInTheDocument();
      expect(screen.queryByText(/Sat–Sun/i)).not.toBeInTheDocument();
      unmountCard1();

      const { unmount: unmountCard2 } = render(<MotorcycleCard motorcycle={restrictedOnlyBike} />);
      expect(screen.getByText('for 2 days (Sat–Sun, 09:00–18:00)')).toBeInTheDocument();
      unmountCard2();

      // Fleet table also surfaces explicit restriction suffix for restricted-only bike
      render(<MotorcycleTable motorcycles={[buildMotorcycle(), restrictedOnlyBike]} />);
      expect(
        screen.getAllByText('for 2 days (Sat–Sun, 09:00–18:00)').length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Admin RentalOffersModal Calendar Eligibility & Overlap Policy Editor', () => {
    it('loads coexisting offers, adds a weekend package with optional hours & overlapPolicy, preserves unrestricted offers, and submits via PUT', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ offers: [LA_DUCATESSA_OFFERS[0]] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ offers: LA_DUCATESSA_OFFERS }),
        });
      global.fetch = mockFetch as any;

      const onSaved = jest.fn();
      render(
        <RentalOffersModal
          isOpen={true}
          onClose={jest.fn()}
          onSaved={onSaved}
          motorcycle={{ id: 'bike-ducatessa-1', model: 'Scrambler Icon', brand: 'Ducati', currency: 'EUR' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2-day package')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Rental Offer/i }));
      fireEvent.change(screen.getByLabelText(/Offer Type/i), { target: { value: 'package' } });
      fireEvent.change(screen.getByLabelText(/^Amount/i), { target: { value: '260' } });
      fireEvent.change(screen.getByLabelText(/Package Duration/i), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText(/Supplier Label/i), {
        target: { value: 'Weekend package' },
      });

      // Configure Calendar Eligibility = weekend + Overlap Policy = alternative + optional times
      fireEvent.change(screen.getByLabelText(/Calendar Eligibility/i), {
        target: { value: 'weekend' },
      });
      fireEvent.change(screen.getByLabelText(/Overlap Policy/i), {
        target: { value: 'alternative' },
      });
      fireEvent.change(screen.getByLabelText(/Saturday Start Time/i), {
        target: { value: '09:00' },
      });
      fireEvent.change(screen.getByLabelText(/Sunday End Time/i), {
        target: { value: '18:00' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Offer to List/i }));

      await waitFor(() => {
        expect(screen.getByText('Weekend package')).toBeInTheDocument();
      });
      expect(screen.getByText('Saturday–Sunday (09:00–18:00)')).toBeInTheDocument();
      expect(screen.getByText(/Alternative to standard rates/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Save Rental Offers/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const [, putInit] = mockFetch.mock.calls[1];
      expect(putInit.method).toBe('PUT');
      const sentBody = JSON.parse(putInit.body);
      expect(sentBody.offers).toHaveLength(2);
      expect(sentBody.offers[0].calendarEligibility).toBeNull();
      expect(sentBody.offers[0].overlapPolicy).toBeNull();
      expect(sentBody.offers[1].calendarEligibility).toEqual({
        kind: 'weekend',
        startDay: 'saturday',
        endDay: 'sunday',
        startTime: '09:00',
        endTime: '18:00',
        timezoneBasis: 'shop_local',
      });
      expect(sentBody.offers[1].overlapPolicy).toBe('alternative');
    });
  });

  describe('3. Admin ChangeProposalDiffViewer Offer Diffs & Private Provenance Badge', () => {
    it('displays calendarEligibility and overlapPolicy on added/modified offer diffs and badges owner_approved_interpretation evidence', () => {
      const proposal: DiffViewerProposal = {
        id: 'prop-248-1',
        shop_id: 'shop-ducatessa',
        source_url: 'https://laducatessa.example/rental',
        status: 'pending',
        coverage_status: 'complete',
        reconciliation_status: 'complete',
        application_status: 'pending',
        version: 1,
        created_at: '2026-11-25T10:00:00Z',
      };

      const items: DiffViewerItem[] = [
        {
          id: 'item-upd-1',
          proposal_id: 'prop-248-1',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-ducatessa-1',
          brand_name: 'Ducati',
          model_name: 'Scrambler Icon',
          original_data: {
            offers: [
              LA_DUCATESSA_OFFERS[0],
              {
                ...LA_DUCATESSA_OFFERS[1],
                overlapPolicy: 'unknown',
              },
            ],
          },
          proposed_data: {
            offers: [
              LA_DUCATESSA_OFFERS[0],
              {
                ...LA_DUCATESSA_OFFERS[1],
                calendarEligibility: {
                  ...WEEKEND_SAT_SUN,
                  startTime: '09:00',
                  endTime: '18:00',
                },
                overlapPolicy: 'replaces_standard',
              },
            ],
          },
          diff_summary: null,
          status: 'pending',
        },
      ];

      const entries: DiffViewerReportEntry[] = [
        {
          id: 'entry-1',
          entryIndex: 0,
          entryKey: 'ducati-scrambler-icon',
          brand: 'Ducati',
          model: 'Scrambler Icon',
          existingMotorcycleId: 'bike-ducatessa-1',
          disposition: 'ready_change',
          proposalItemRefs: ['item-upd-1'],
          linkedProposalItemIds: ['item-upd-1'],
          evidence: [
            {
              sourceUrl: 'https://laducatessa.example/rental',
              kind: 'pricing_table',
              snippet: '2 days €215; Weekend €260',
              provenance: 'supplier_explicit',
            },
            {
              sourceUrl: 'https://laducatessa.example/rental',
              kind: 'policy_clarification',
              snippet: 'Weekend column mapped to Saturday–Sunday per owner approval on #244',
              provenance: 'owner_approved_interpretation',
            },
          ],
        },
      ];

      render(
        <ChangeProposalDiffViewer
          proposal={proposal}
          items={items}
          report={{
            id: 'rep-1',
            schemaVersion: 1,
            reportVersion: 1,
            reportDigest: 'sha256:abc',
            scope: {
              branch: 'Milan',
              services: ['daily_rental'],
              availabilityBasis: 'supplier_catalog_not_live_stock',
            },
            coverage: { status: 'complete', discoveryComplete: true, limitations: [], pages: [] },
            serverCounts: {
              readyActionableItems: 1,
              accountedDiscoveredModels: 1,
              unresolvedModels: 0,
              unchangedModels: 0,
              excludedModels: 0,
              duplicateModels: 0,
              pagesProcessed: 1,
              pagesFailed: 0,
              pagesNotProcessed: 0,
              add: 0,
              update: 1,
              delist: 0,
              unchanged: 0,
            },
          }}
          entries={entries}
        />
      );

      // Offer diff shows before -> after for calendarEligibility and overlapPolicy
      const diffBox = screen.getByTestId('proposal-offers-diff-item-upd-1');
      expect(within(diffBox).getByText('Saturday–Sunday')).toBeInTheDocument();
      expect(within(diffBox).getByText('Saturday–Sunday (09:00–18:00)')).toBeInTheDocument();
      expect(within(diffBox).getByText(/Overlap policy unknown/i)).toBeInTheDocument();
      expect(
        within(diffBox).getByText(/Replaces standard rates on eligible days/i)
      ).toBeInTheDocument();

      // Evidence provenance badges render directly inline on the linked ready_change card
      expect(screen.getByTestId('evidence-provenance-owner-approved')).toHaveTextContent(
        /Owner-Approved Interpretation/i
      );
      expect(screen.getByTestId('evidence-provenance-supplier-explicit')).toHaveTextContent(
        /Supplier Explicit/i
      );
    });

    it('covers RentalOffersModal edit/reset/invalid-HH:MM flows, DiffViewer add/delist/unchanged/unlabeled/transition/snake_case/dedup evidence, and unrestricted catalog note absence', async () => {
      // 1. MotorcycleDetails: no catalog note on unrestricted-only bikes; known-policy note when replaces_standard
      const { unmount: unmountUnrestricted } = render(
        <MotorcycleDetails motorcycle={buildMotorcycle({ rental_offers: [LA_DUCATESSA_OFFERS[0]] })} />
      );
      expect(screen.queryByTestId('calendar-offers-catalog-note')).not.toBeInTheDocument();
      unmountUnrestricted();

      const { unmount: unmountKnown } = render(
        <MotorcycleDetails
          motorcycle={buildMotorcycle({
            rental_offers: [{ ...LA_DUCATESSA_OFFERS[1], overlapPolicy: 'replaces_standard' }],
          })}
        />
      );
      expect(screen.getByTestId('calendar-offers-catalog-note')).toHaveTextContent(
        /Calendar restrictions apply in shop-local time/i
      );
      unmountKnown();

      // 2. RentalOffersModal: edit existing weekend offer, validate invalid HH:MM, switch weekend -> unrestricted -> null/null
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ offers: LA_DUCATESSA_OFFERS }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ offers: [LA_DUCATESSA_OFFERS[0]] }),
        });
      global.fetch = mockFetch as any;

      const { unmount: unmountModal } = render(
        <RentalOffersModal
          isOpen={true}
          onClose={jest.fn()}
          motorcycle={{ id: 'bike-ducatessa-1', model: 'Scrambler Icon', brand: 'Ducati', currency: 'EUR' }}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Weekend package')).toBeInTheDocument();
      });

      // Click Edit on the 2nd offer (Weekend package)
      const editButtons = screen.getAllByTitle('Edit offer');
      fireEvent.click(editButtons[1]);
      expect((screen.getByLabelText(/Calendar Eligibility/i) as HTMLSelectElement).value).toBe('weekend');
      expect((screen.getByLabelText(/Overlap Policy/i) as HTMLSelectElement).value).toBe('unknown');

      // Malformed HH:MM time is rejected with error alert
      fireEvent.change(screen.getByLabelText(/Saturday Start Time/i), { target: { value: '25:00' } });
      fireEvent.click(screen.getByRole('button', { name: /Update Offer in List/i }));
      expect(screen.getByText(/startTime/i)).toBeInTheDocument();

      // Switch to unrestricted (must clear times & overlapPolicy) and change duration so it doesn't collide with 2-day standard
      fireEvent.change(screen.getByLabelText(/Calendar Eligibility/i), {
        target: { value: 'unrestricted' },
      });
      fireEvent.change(screen.getByLabelText(/Package Duration/i), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /Update Offer in List/i }));

      fireEvent.click(screen.getByRole('button', { name: /Save Rental Offers/i }));
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      const savedOffers = JSON.parse(mockFetch.mock.calls[1][1].body).offers;
      expect(savedOffers[1].calendarEligibility).toBeNull();
      expect(savedOffers[1].overlapPolicy).toBeNull();
      unmountModal();

      // 3. ChangeProposalDiffViewer: add, delist, unlabeled coexistence, labeled unrestricted->weekend transition, snake_case rows + corrupt DB row resilience, proposalItemRefs + dedup + javascript: URL safety
      const proposal: DiffViewerProposal = {
        id: 'prop-248-edge',
        shop_id: 'shop-ducatessa',
        source_url: 'https://laducatessa.example/rental',
        status: 'pending',
        coverage_status: 'complete',
        reconciliation_status: 'complete',
        application_status: 'pending',
        version: 1,
        created_at: '2026-11-25T10:00:00Z',
      };

      const edgeItems: DiffViewerItem[] = [
        {
          id: 'item-add-wknd',
          client_item_id: 'client-add-1',
          proposal_id: 'prop-248-edge',
          entity_type: 'motorcycle',
          action: 'add',
          entity_id: null,
          brand_name: 'Ducati',
          model_name: 'Monster',
          original_data: null,
          proposed_data: {
            offers: [
              {
                offerType: 'package',
                amount: 260,
                currency: 'EUR',
                billingBasis: 'package_total',
                durationUnit: 'day',
                minDuration: 2,
                maxDuration: 2,
                calendar_eligibility: { kind: 'weekend', start_time: '10:00', end_time: '19:00' },
                overlap_policy: 'alternative',
              },
            ],
          },
          diff_summary: null,
          status: 'pending',
        },
        {
          id: 'item-upd-transition',
          proposal_id: 'prop-248-edge',
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: 'bike-trans',
          brand_name: 'Ducati',
          model_name: 'Multistrada',
          original_data: {
            offers: [
              { ...LA_DUCATESSA_OFFERS[0], supplierLabel: null },
              { ...LA_DUCATESSA_OFFERS[0], amount: 260, supplierLabel: 'Weekend Special' },
            ],
          },
          proposed_data: {
            offers: [
              { ...LA_DUCATESSA_OFFERS[0], supplierLabel: null },
              { ...LA_DUCATESSA_OFFERS[1], supplierLabel: null },
              { ...LA_DUCATESSA_OFFERS[1], amount: 260, supplierLabel: 'Weekend Special' },
            ],
          },
          diff_summary: null,
          status: 'pending',
        },
        {
          id: 'item-delist-corrupt',
          proposal_id: 'prop-248-edge',
          entity_type: 'motorcycle',
          action: 'delist',
          entity_id: 'bike-delist',
          brand_name: 'Ducati',
          model_name: 'DesertX',
          original_data: {
            offers: [
              {
                offer_type: 'package',
                amount: 300,
                currency: 'EUR',
                billing_basis: 'package_total',
                duration_unit: 'day',
                min_duration: 2,
                max_duration: 2,
                calendar_eligibility: { kind: 'invalid_corrupt_kind' },
                overlap_policy: 'unknown',
              },
            ],
          },
          proposed_data: null,
          diff_summary: null,
          status: 'pending',
        },
      ];

      const dupEv = {
        sourceUrl: 'javascript:alert(1)',
        kind: 'policy_clarification',
        snippet: 'Mapped via owner decision',
        provenance: 'owner_approved_interpretation' as const,
      };

      render(
        <ChangeProposalDiffViewer
          proposal={proposal}
          items={edgeItems}
          entries={[
            {
              id: 'entry-add-ref',
              entryIndex: 0,
              entryKey: 'ducati-monster',
              brand: 'Ducati',
              model: 'Monster',
              disposition: 'ready_change',
              proposalItemRefs: [' client-add-1 '],
              linkedProposalItemIds: ['item-add-wknd'],
              evidence: [dupEv, dupEv],
            },
            {
              id: 'entry-unchanged-wknd',
              entryIndex: 1,
              entryKey: 'ducati-hypermotard',
              brand: 'Ducati',
              model: 'Hypermotard',
              existingMotorcycleId: 'bike-hyper',
              disposition: 'unchanged',
              baseline_data: { offers: [LA_DUCATESSA_OFFERS[1]] },
              evidence: [],
            },
          ]}
        />
      );

      // Snake_case start_time/end_time rendered cleanly on Added item
      expect(screen.getByText('Saturday–Sunday (10:00–19:00)')).toBeInTheDocument();
      // Evidence linked by both linkedProposalItemIds + proposalItemRefs is deduplicated to a single provenance badge and javascript: URL is inert
      expect(screen.getAllByTestId('evidence-provenance-owner-approved')).toHaveLength(1);
      expect(screen.queryByRole('link', { name: /javascript:/i })).not.toBeInTheDocument();

      // Transition diff pairs labeled 'Weekend Special' unrestricted -> weekend as modified while keeping unlabeled standard unchanged & unlabeled weekend added
      const transDiff = screen.getByTestId('proposal-offers-diff-item-upd-transition');
      expect(within(transDiff).getByText(/✓ Unchanged/i)).toBeInTheDocument();
      expect(within(transDiff).getByText(/\+ Added/i)).toBeInTheDocument();
      expect(within(transDiff).getByText('Weekend Special')).toBeInTheDocument();
    });
  });

  describe('4. AI Chat Prompt & SEO JSON-LD / Meta Helpers', () => {
    it('instructs AI Chat to preserve calendar restrictions, avoid fabricating hours, refuse guessing unknown overlap precedence, and never present catalog options as live date-specific quotes', () => {
      expect(SYSTEM_PROMPT).toMatch(/calendarEligibility|calendar-restricted/i);
      expect(SYSTEM_PROMPT).toMatch(/overlapPolicy/i);
      expect(SYSTEM_PROMPT).toMatch(/unknown/i);
      expect(SYSTEM_PROMPT).toMatch(/never.*fabricat|invent.*hour|48\s*hours/i);
      expect(SYSTEM_PROMPT).toMatch(/live date-specific quotes/i);
      expect(SYSTEM_PROMPT).toMatch(/cheapest wins/i);
    });

    it('preserves calendar restrictions in JSON-LD offer descriptions and meta SEO without mislabeling package totals as daily rates', () => {
      const specs = generateOfferPricingSchema(LA_DUCATESSA_OFFERS);
      expect(specs).toHaveLength(2);

      // Standard 2-day package
      expect(specs[0].price).toBe('215');
      expect(specs[0].referenceQuantity).toEqual({
        '@type': 'QuantitativeValue',
        value: 2,
        unitCode: 'DAY',
        unitText: 'days',
      });
      expect(specs[0].description).not.toMatch(/Saturday–Sunday/i);

      // Weekend 2-day package preserves calendar restriction & overlap policy without fabricating hours or mislabeling as 1-day rate
      expect(specs[1].price).toBe('260');
      expect(specs[1].referenceQuantity).toEqual({
        '@type': 'QuantitativeValue',
        value: 2,
        unitCode: 'DAY',
        unitText: 'days',
      });
      expect(specs[1].description).toMatch(/Saturday–Sunday/i);
      expect(specs[1].description).toMatch(/Overlap policy unknown/i);
      expect(specs[1].description).not.toMatch(/09:00|18:00|48 hours/i);

      // Unlabeled calendar-restricted offer with omitted overlapPolicy defaults cleanly in JSON-LD
      const [unlabeledSpec] = generateOfferPricingSchema([
        {
          ...LA_DUCATESSA_OFFERS[1],
          supplierLabel: null,
          overlapPolicy: undefined,
        },
      ]);
      expect(unlabeledSpec.name).toBe('260 EUR for 2 days, Saturday–Sunday');
      expect(unlabeledSpec.description).toMatch(/Eligible: Saturday–Sunday/);
      expect(unlabeledSpec.description).toMatch(/Overlap policy unknown/);

      const enhanced = generateEnhancedMotorcycleSchema({
        id: 'bike-ducatessa-1',
        brand: 'Ducati',
        model: 'Scrambler Icon',
        rentalOffers: LA_DUCATESSA_OFFERS,
      });
      expect(enhanced.offers?.priceSpecification).toHaveLength(2);

      // Shop motorcycle schemas hydrate snake_case DB calendar_eligibility & overlap_policy
      const shopSchemas = generateShopMotorcycleSchemas({
        provider_name: 'La Ducatessa',
        motorcycle_rentals: [
          {
            id: 'bike-shop-wknd',
            model: 'Scrambler Icon',
            availability_status: 'available',
            brands: { name: 'Ducati' },
            rental_offers: [
              {
                id: 'row-wknd',
                motorcycle_id: 'bike-shop-wknd',
                parent_offer_id: null,
                offer_type: 'package',
                amount: 260,
                currency: 'EUR',
                billing_basis: 'package_total',
                duration_unit: 'day',
                min_duration: 2,
                max_duration: 2,
                supplier_label: 'Weekend package',
                is_from: false,
                calendar_eligibility: { ...WEEKEND_SAT_SUN, startTime: '09:00', endTime: '18:00' },
                overlap_policy: 'replaces_standard',
                sort_order: 0,
              },
            ],
          },
        ],
      });
      expect((shopSchemas[0].offers?.priceSpecification[0] as any)?.description).toMatch(
        /Saturday–Sunday \(09:00–18:00\)/
      );

      // Meta SEO description appends (Sat–Sun) when restricted-only offer is the headline
      const restrictedSeo = generateMotorcycleSEO({
        id: 'bike-ducatessa-1',
        brand: 'Ducati',
        model: 'Scrambler Icon',
        location: 'Milan, Italy',
        headlineOffer: LA_DUCATESSA_OFFERS[1],
      });
      expect(restrictedSeo.description).toContain('EUR 260 for 2 days (Sat–Sun)');
    });
  });
});
