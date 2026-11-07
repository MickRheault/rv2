import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  convertLegacyRateTiersToOffers,
  hasNonDailyOrExtensionOffers,
  hydrateRentalOffersFromRows,
  NormalizedRentalOffer,
  projectOffersToLegacyDaily,
  RentalOfferConflictError,
  RentalOfferNotFoundError,
  RentalOfferValidationError,
  validateAndNormalizeRentalOffers,
} from '@/lib/rental-offers';

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

  if (rows && rows.length > 0) {
    return hydrateRentalOffersFromRows(rows);
  }

  const { data: tierRows } = await admin
    .from('rental_rate_tiers')
    .select('*')
    .eq('motorcycle_id', motorcycleId)
    .order('min_days', { ascending: true });

  if (tierRows && tierRows.length > 0) {
    return convertLegacyRateTiersToOffers(tierRows);
  }

  if (
    typeof (bike as any).rental_rate_per_day === 'number' &&
    (bike as any).rental_rate_per_day > 0 &&
    typeof (bike as any).rental_rate_currency === 'string' &&
    (bike as any).rental_rate_currency.trim().length === 3
  ) {
    return validateAndNormalizeRentalOffers([
      {
        offerType: 'daily',
        amount: Number((bike as any).rental_rate_per_day),
        currency: (bike as any).rental_rate_currency.trim().toUpperCase(),
        billingBasis: 'per_day',
        durationUnit: 'day',
        minDuration: 1,
        maxDuration: null,
      },
    ]);
  }

  return [];
}

export async function replaceMotorcycleRentalOffers(
  motorcycleId: string,
  rawOffers: unknown
): Promise<NormalizedRentalOffer[]> {
  const normalizedOffers = validateAndNormalizeRentalOffers(rawOffers, { fieldPath: 'offers' });
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

  const { data: savedRows, error: fetchError } = await admin
    .from('rental_offers')
    .select('*')
    .eq('motorcycle_id', motorcycleId)
    .order('sort_order', { ascending: true });

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  return hydrateRentalOffersFromRows(savedRows || []);
}

export async function replaceMotorcycleRateTiersLegacyCompat(
  motorcycleId: string,
  rawRateTiers: unknown
): Promise<{
  rateTiers: Array<{
    id?: string;
    motorcycle_id: string;
    min_days: number;
    max_days: number | null;
    rate_per_day: number;
    currency: string;
  }>;
  offers: NormalizedRentalOffer[];
}> {
  const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
  if (hasNonDailyOrExtensionOffers(currentOffers)) {
    throw new RentalOfferConflictError(
      'Cannot overwrite flexible non-daily or extension offers via legacy rate-tiers endpoint; use /offers instead.'
    );
  }

  const normalizedOffers = convertLegacyRateTiersToOffers(rawRateTiers as any[]);
  const admin = getSupabaseAdmin();
  const rpcPayload = serializeOffersForRpc(normalizedOffers);

  const { error: rpcError } = await (admin as any).rpc('replace_motorcycle_rental_offers', {
    p_motorcycle_id: motorcycleId,
    p_payload: rpcPayload,
  });

  if (rpcError) {
    throw new Error(rpcError.message);
  }

  const { data: savedTiers, error: tiersErr } = await admin
    .from('rental_rate_tiers')
    .select('*')
    .eq('motorcycle_id', motorcycleId)
    .order('min_days', { ascending: true });

  if (tiersErr) {
    throw new Error(tiersErr.message);
  }

  const { data: savedRows, error: offersErr } = await admin
    .from('rental_offers')
    .select('*')
    .eq('motorcycle_id', motorcycleId)
    .order('sort_order', { ascending: true });

  if (offersErr) {
    throw new Error(offersErr.message);
  }

  return {
    rateTiers: (savedTiers as any[]) || [],
    offers: hydrateRentalOffersFromRows(savedRows || []),
  };
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
        const savedOffers = await replaceMotorcycleRentalOffers(motorcycle.id, normalized);
        const savedProj = projectOffersToLegacyDaily(savedOffers);
        motorcycle.rental_offers = savedOffers;
        motorcycle.rental_rate_per_day = savedProj.summaryRatePerDay;
        motorcycle.rental_rate_currency = savedProj.summaryCurrency;
      },
    };
  }

  if (rentalRateTiers !== undefined) {
    if (motorcycleId) {
      const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
      if (hasNonDailyOrExtensionOffers(currentOffers)) {
        throw new RentalOfferConflictError(
          'Cannot overwrite flexible non-daily or extension offers via legacy rental_rate_tiers; use rental_offers instead.'
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
        const savedProj = projectOffersToLegacyDaily(saved.offers);
        motorcycle.rental_rate_tiers = saved.rateTiers;
        motorcycle.rental_offers = saved.offers;
        motorcycle.rental_rate_per_day = savedProj.summaryRatePerDay;
        motorcycle.rental_rate_currency = savedProj.summaryCurrency;
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
      if (hasNonDailyOrExtensionOffers(currentOffers)) {
        throw new RentalOfferConflictError(
          'Cannot overwrite flexible non-daily or extension offers via scalar rental_rate_per_day; use rental_offers instead.'
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
          const savedOffers = await replaceMotorcycleRentalOffers(motorcycle.id, []);
          motorcycle.rental_offers = savedOffers;
          motorcycle.rental_rate_tiers = [];
          motorcycle.rental_rate_per_day = null;
          motorcycle.rental_rate_currency = null;
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
        const savedOffers = await replaceMotorcycleRentalOffers(motorcycle.id, synthesized);
        const savedProj = projectOffersToLegacyDaily(savedOffers);
        motorcycle.rental_offers = savedOffers;
        motorcycle.rental_rate_per_day = savedProj.summaryRatePerDay;
        motorcycle.rental_rate_currency = savedProj.summaryCurrency;
      },
    };
  }

  if (scalarCurrency !== undefined && motorcycleId) {
    const currentOffers = await getMotorcycleRentalOffers(motorcycleId);
    if (hasNonDailyOrExtensionOffers(currentOffers)) {
      throw new RentalOfferConflictError(
        'Cannot overwrite currency on flexible non-daily or extension offers via scalar rental_rate_currency; use rental_offers instead.'
      );
    }
  }

  return {
    hasPricingMutation: false,
    commit: async (motorcycle) => {
      if (motorcycle && typeof motorcycle === 'object') {
        motorcycle.rental_offers = hydrateRentalOffersFromRows(motorcycle.rental_offers);
      }
    },
  };
}
