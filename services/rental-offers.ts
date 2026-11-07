import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  convertLegacyRateTiersToOffers,
  hasUnrepresentableLegacyDailyOffers,
  hydrateRentalOffersFromRows,
  NormalizedRentalOffer,
  projectOffersToLegacyDaily,
  RentalOfferConflictError,
  RentalOfferNotFoundError,
  RentalOfferValidationError,
  resolveFallbackRentalOffers,
  validateAndNormalizeRentalOffers,
} from '@/lib/rental-offers';

export interface SavedMotorcycleOffersAndTiers {
  offers: NormalizedRentalOffer[];
  rateTiers: Array<{
    id?: string;
    motorcycle_id: string;
    min_days: number;
    max_days: number | null;
    rate_per_day: number;
    currency: string;
  }>;
}

async function fetchSavedOffersAndRateTiers(
  admin: any,
  motorcycleId: string
): Promise<SavedMotorcycleOffersAndTiers> {
  const [offersRes, tiersRes] = await Promise.all([
    admin
      .from('rental_offers')
      .select('*')
      .eq('motorcycle_id', motorcycleId)
      .order('sort_order', { ascending: true }),
    admin
      .from('rental_rate_tiers')
      .select('*')
      .eq('motorcycle_id', motorcycleId)
      .order('min_days', { ascending: true }),
  ]);

  if (offersRes.error) {
    throw new Error(offersRes.error.message);
  }
  if (tiersRes.error) {
    throw new Error(tiersRes.error.message);
  }

  return {
    offers: hydrateRentalOffersFromRows(offersRes.data || []),
    rateTiers: (tiersRes.data as any[]) || [],
  };
}

function applySavedPricingToEntity(
  motorcycle: Record<string, any>,
  saved: SavedMotorcycleOffersAndTiers
): void {
  const proj = projectOffersToLegacyDaily(saved.offers);
  motorcycle.rental_offers = saved.offers;
  motorcycle.rental_rate_tiers = saved.rateTiers;
  motorcycle.rental_rate_per_day = proj.summaryRatePerDay;
  motorcycle.rental_rate_currency = proj.summaryCurrency;
}

export function serializeOffersForRpc(offers: NormalizedRentalOffer[]) {
  const projection = projectOffersToLegacyDaily(offers);
  return {
    offers: offers.map((o, index) => ({
      offer_type: o.offerType,
      amount: o.amount,
      currency: o.currency,
      billing_basis: o.billingBasis,
      duration_unit: o.durationUnit,
      min_duration: o.minDuration,
      max_duration: o.maxDuration,
      min_commitment_value: o.minCommitment?.value ?? null,
      min_commitment_unit: o.minCommitment?.unit ?? null,
      billing_increment_value: o.billingIncrement?.value ?? null,
      billing_increment_unit: o.billingIncrement?.unit ?? null,
      supplier_label: o.supplierLabel,
      is_from: o.isFrom,
      sort_order: index,
      extensions: o.extensions.map((ext, extIdx) => ({
        amount: ext.amount,
        currency: ext.currency,
        billing_basis: ext.billingBasis,
        duration_unit: ext.durationUnit,
        min_duration: ext.minDuration,
        max_duration: ext.maxDuration,
        billing_increment_value: ext.billingIncrement?.value ?? null,
        billing_increment_unit: ext.billingIncrement?.unit ?? null,
        supplier_label: ext.supplierLabel,
        is_from: ext.isFrom,
        sort_order: extIdx,
      })),
    })),
    legacy_rate_tiers: projection.legacyRateTiers,
    summary_rate_per_day: projection.summaryRatePerDay,
    summary_currency: projection.summaryCurrency,
  };
}

export async function getMotorcycleRentalOffers(motorcycleId: string): Promise<NormalizedRentalOffer[]> {
  const admin = getSupabaseAdmin();

  const { data: bike, error: bikeErr } = await admin
    .from('motorcycle_rentals')
    .select('id, rental_rate_per_day, rental_rate_currency')
    .eq('id', motorcycleId)
    .maybeSingle();

  if (bikeErr) {
    throw new Error(bikeErr.message);
  }
  if (!bike) {
    throw new RentalOfferNotFoundError('Motorcycle not found');
  }

  const { data: rows, error } = await admin
    .from('rental_offers')
    .select('*')
    .eq('motorcycle_id', motorcycleId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const { data: tierRows } = await admin
    .from('rental_rate_tiers')
    .select('*')
    .eq('motorcycle_id', motorcycleId)
    .order('min_days', { ascending: true });

  return resolveFallbackRentalOffers({
    rentalOffersRows: rows,
    rentalRateTiers: tierRows,
    rentalRatePerDay: (bike as any).rental_rate_per_day,
    rentalRateCurrency: (bike as any).rental_rate_currency,
    strictTierValidation: true,
  });
}

async function persistNormalizedOffersAndReadBack(
  motorcycleId: string,
  normalizedOffers: NormalizedRentalOffer[]
): Promise<SavedMotorcycleOffersAndTiers> {
  const admin = getSupabaseAdmin();

  const { data: bike, error: bikeErr } = await admin
    .from('motorcycle_rentals')
    .select('id')
    .eq('id', motorcycleId)
    .maybeSingle();

  if (bikeErr) {
    throw new Error(bikeErr.message);
  }
  if (!bike) {
    throw new RentalOfferNotFoundError('Motorcycle not found');
  }

  const rpcPayload = serializeOffersForRpc(normalizedOffers);
  const { error: rpcError } = await (admin as any).rpc('replace_motorcycle_rental_offers', {
    p_motorcycle_id: motorcycleId,
    p_payload: rpcPayload,
  });

  if (rpcError) {
    throw new Error(rpcError.message);
  }

  return fetchSavedOffersAndRateTiers(admin, motorcycleId);
}

export async function replaceMotorcycleRentalOffers(
  motorcycleId: string,
  rawOffers: unknown
): Promise<NormalizedRentalOffer[]> {
  const normalizedOffers = validateAndNormalizeRentalOffers(rawOffers, { fieldPath: 'offers' });
  const saved = await persistNormalizedOffersAndReadBack(motorcycleId, normalizedOffers);
  return saved.offers;
}

export async function replaceMotorcycleRateTiersLegacyCompat(
  motorcycleId: string,
  rawRateTiers: unknown
): Promise<SavedMotorcycleOffersAndTiers> {
  const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
  if (hasUnrepresentableLegacyDailyOffers(currentOffers)) {
    throw new RentalOfferConflictError(
      'Cannot overwrite flexible non-daily, labeled, or extension offers via legacy rate-tiers endpoint; use /offers instead.'
    );
  }

  const normalizedOffers = convertLegacyRateTiersToOffers(rawRateTiers as any[]);
  return persistNormalizedOffersAndReadBack(motorcycleId, normalizedOffers);
}

export interface PreparedMotorcyclePricingMutation {
  hasPricingMutation: boolean;
  summaryRatePerDay?: number | null;
  summaryCurrency?: string | null;
  commit: (motorcycle: Record<string, any>) => Promise<void>;
}

export async function prepareMotorcyclePricingMutation(params: {
  motorcycleId?: string;
  rentalOffers?: unknown;
  rentalRateTiers?: unknown;
  scalarDailyRate?: unknown;
  scalarCurrency?: unknown;
}): Promise<PreparedMotorcyclePricingMutation> {
  const { motorcycleId, rentalOffers, rentalRateTiers, scalarDailyRate, scalarCurrency } = params;

  if (rentalOffers !== undefined && rentalRateTiers !== undefined) {
    throw new RentalOfferValidationError(
      'Provide either rental_offers or legacy rental_rate_tiers, not both'
    );
  }

  if (rentalOffers !== undefined) {
    const normalized = validateAndNormalizeRentalOffers(rentalOffers, {
      fieldPath: 'rental_offers',
    });
    const proj = projectOffersToLegacyDaily(normalized);
    return {
      hasPricingMutation: true,
      summaryRatePerDay: proj.summaryRatePerDay,
      summaryCurrency: proj.summaryCurrency,
      commit: async (motorcycle) => {
        const saved = await persistNormalizedOffersAndReadBack(motorcycle.id, normalized);
        applySavedPricingToEntity(motorcycle, saved);
      },
    };
  }

  if (rentalRateTiers !== undefined) {
    if (motorcycleId) {
      const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
      if (hasUnrepresentableLegacyDailyOffers(currentOffers)) {
        throw new RentalOfferConflictError(
          'Cannot overwrite flexible non-daily, labeled, or extension offers via legacy rental_rate_tiers; use rental_offers instead.'
        );
      }
    }
    const normalized = convertLegacyRateTiersToOffers(rentalRateTiers as any[]);
    const proj = projectOffersToLegacyDaily(normalized);
    return {
      hasPricingMutation: true,
      summaryRatePerDay: proj.summaryRatePerDay,
      summaryCurrency: proj.summaryCurrency,
      commit: async (motorcycle) => {
        const saved = await replaceMotorcycleRateTiersLegacyCompat(
          motorcycle.id,
          rentalRateTiers
        );
        applySavedPricingToEntity(motorcycle, saved);
      },
    };
  }

  if (scalarDailyRate !== undefined) {
    let fallbackCurrency =
      typeof scalarCurrency === 'string' && scalarCurrency.trim().length > 0
        ? scalarCurrency.trim().toUpperCase()
        : null;

    if (motorcycleId) {
      const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
      if (hasUnrepresentableLegacyDailyOffers(currentOffers)) {
        throw new RentalOfferConflictError(
          'Cannot overwrite flexible non-daily, labeled, or extension offers via scalar rental_rate_per_day; use rental_offers instead.'
        );
      }
      if (!fallbackCurrency && currentOffers.length > 0) {
        fallbackCurrency = currentOffers[0].currency;
      }
    }

    if (scalarDailyRate === null) {
      return {
        hasPricingMutation: true,
        summaryRatePerDay: null,
        summaryCurrency: fallbackCurrency,
        commit: async (motorcycle) => {
          const saved = await persistNormalizedOffersAndReadBack(motorcycle.id, []);
          applySavedPricingToEntity(motorcycle, saved);
        },
      };
    }

    const numericRate = Number(scalarDailyRate);
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      throw new RentalOfferValidationError('rental_rate_per_day must be a positive number or null');
    }

    const currency = fallbackCurrency || 'USD';
    const synthesized = validateAndNormalizeRentalOffers(
      [
        {
          offerType: 'daily',
          amount: numericRate,
          currency,
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
          maxDuration: null,
        },
      ],
      { fieldPath: 'rental_offers' }
    );
    const proj = projectOffersToLegacyDaily(synthesized);

    return {
      hasPricingMutation: true,
      summaryRatePerDay: proj.summaryRatePerDay,
      summaryCurrency: proj.summaryCurrency,
      commit: async (motorcycle) => {
        const saved = await persistNormalizedOffersAndReadBack(motorcycle.id, synthesized);
        applySavedPricingToEntity(motorcycle, saved);
      },
    };
  }

  if (scalarCurrency !== undefined) {
    if (scalarCurrency === null) {
      if (motorcycleId) {
        const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
        if (currentOffers.length > 0) {
          throw new RentalOfferConflictError(
            'Cannot clear rental_rate_currency while rental offers exist; update or clear rental_offers instead.'
          );
        }
      }
      return {
        hasPricingMutation: true,
        summaryRatePerDay: null,
        summaryCurrency: null,
        commit: async (motorcycle) => {
          if (motorcycle && typeof motorcycle === 'object') {
            motorcycle.rental_offers = hydrateRentalOffersFromRows(motorcycle.rental_offers);
            motorcycle.rental_rate_tiers = Array.isArray(motorcycle.rental_rate_tiers)
              ? motorcycle.rental_rate_tiers
              : [];
          }
        },
      };
    }

    const normalizedCurrency =
      typeof scalarCurrency === 'string' ? scalarCurrency.trim().toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new RentalOfferValidationError(
        'rental_rate_currency must be a 3-letter ISO currency code'
      );
    }

    if (motorcycleId) {
      const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
      if (hasUnrepresentableLegacyDailyOffers(currentOffers)) {
        throw new RentalOfferConflictError(
          'Cannot overwrite currency on flexible non-daily, labeled, or extension offers via scalar rental_rate_currency; use rental_offers instead.'
        );
      }

      if (currentOffers.length > 0) {
        const rewritten = validateAndNormalizeRentalOffers(
          currentOffers.map((o) => ({
            offerType: o.offerType,
            amount: o.amount,
            currency: normalizedCurrency,
            billingBasis: o.billingBasis,
            durationUnit: o.durationUnit,
            minDuration: o.minDuration,
            maxDuration: o.maxDuration,
          })),
          { fieldPath: 'rental_offers' }
        );
        const proj = projectOffersToLegacyDaily(rewritten);
        return {
          hasPricingMutation: true,
          summaryRatePerDay: proj.summaryRatePerDay,
          summaryCurrency: proj.summaryCurrency,
          commit: async (motorcycle) => {
            const saved = await persistNormalizedOffersAndReadBack(motorcycle.id, rewritten);
            applySavedPricingToEntity(motorcycle, saved);
          },
        };
      }
    }

    return {
      hasPricingMutation: true,
      summaryRatePerDay: null,
      summaryCurrency: normalizedCurrency,
      commit: async (motorcycle) => {
        if (motorcycle && typeof motorcycle === 'object') {
          motorcycle.rental_offers = hydrateRentalOffersFromRows(motorcycle.rental_offers);
          motorcycle.rental_rate_tiers = Array.isArray(motorcycle.rental_rate_tiers)
            ? motorcycle.rental_rate_tiers
            : [];
        }
      },
    };
  }

  return {
    hasPricingMutation: false,
    commit: async (motorcycle) => {
      if (motorcycle && typeof motorcycle === 'object') {
        motorcycle.rental_offers = hydrateRentalOffersFromRows(motorcycle.rental_offers);
        motorcycle.rental_rate_tiers = Array.isArray(motorcycle.rental_rate_tiers)
          ? motorcycle.rental_rate_tiers
          : [];
      }
    },
  };
}
