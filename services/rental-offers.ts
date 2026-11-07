import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  convertLegacyRateTiersToOffers,
  hasNonDailyOrExtensionOffers,
  hydrateRentalOffersFromRows,
  NormalizedRentalOffer,
  projectOffersToLegacyDaily,
  RentalOfferConflictError,
  RentalOfferNotFoundError,
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
