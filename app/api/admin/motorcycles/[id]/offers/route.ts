export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';
import {
  getMotorcycleRentalOffers,
  replaceMotorcycleRentalOffers,
} from '@/services/rental-offers';
import {
  RentalOfferConflictError,
  RentalOfferNotFoundError,
  RentalOfferValidationError,
} from '@/lib/rental-offers';
import { purgePublicCache } from '@/lib/cache/purgePublicCache';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/motorcycles/:id/offers
 * Session-authenticated admin endpoint returning hydrated Rental Offers + nested Extensions.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Motorcycle ID is required' }, { status: 400 });
    }

    const offers = await getMotorcycleRentalOffers(id);
    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof RentalOfferNotFoundError) {
      return NextResponse.json({ error: 'Motorcycle not found' }, { status: 404 });
    }
    console.error('Error fetching admin motorcycle rental offers:', error);
    return NextResponse.json({ error: 'Failed to load rental offers' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/motorcycles/:id/offers
 * Session-authenticated admin endpoint atomically replacing Rental Offers + nested Extensions.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Motorcycle ID is required' }, { status: 400 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !Array.isArray(body.offers)) {
      return NextResponse.json({ error: 'offers array is required' }, { status: 400 });
    }

    const offers = await replaceMotorcycleRentalOffers(id, body.offers);
    purgePublicCache();

    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof RentalOfferValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof RentalOfferConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof RentalOfferNotFoundError) {
      return NextResponse.json({ error: 'Motorcycle not found' }, { status: 404 });
    }
    console.error('Error saving admin motorcycle rental offers:', error);
    return NextResponse.json({ error: 'Failed to save rental offers' }, { status: 500 });
  }
}
