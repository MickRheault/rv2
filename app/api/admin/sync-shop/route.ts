import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ShopSyncService } from '@/services/shop-sync';
import { ShopManifest } from '@/types/shop-manifest';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  
  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse Request
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { manifest, dryRun } = body as { manifest: ShopManifest; dryRun?: boolean };

  if (!manifest || !manifest.shop || !manifest.inventory) {
    return NextResponse.json({ error: 'Invalid manifest structure' }, { status: 400 });
  }

  try {
    // 3. Sync Logic
    const syncService = new ShopSyncService(supabase, dryRun);
    const result = await syncService.sync(manifest);

    return NextResponse.json({ result });

  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
