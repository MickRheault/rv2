import { SupabaseClient } from '@supabase/supabase-js';
import { ShopManifest, SyncResult } from '@/types/shop-manifest';
import { resolveCityId, resolveBrandId, resolveCategoryId } from '@/lib/mcp/tools';

export class ShopSyncService {
  private supabase: any;
  private dryRun: boolean;

  constructor(supabaseClient: any, dryRun = false) {
    this.supabase = supabaseClient;
    this.dryRun = dryRun;
  }

  // Idempotently create or update a shop and its inventory
  async sync(manifest: ShopManifest): Promise<SyncResult> {
    const { shop, inventory } = manifest;
    const result: SyncResult = {
      shopId: '',
      shopName: shop.provider_name,
      action: 'no-change',
      inventory: { created: 0, updated: 0, skipped: 0, errors: [] },
    };

    // 1. Resolve Dependencies
    const cityId = await resolveCityId(shop.city);
    if (!cityId) throw new Error(`City not found: ${shop.city}`);

    // 2. Find existing shop (by slug or name+city)
    const { data: existingShop } = await this.supabase
      .from('rental_shops')
      .select('id, slug')
      .eq('city_id', cityId)
      .eq('provider_name', shop.provider_name)
      .maybeSingle();

    let shopId = existingShop?.id;

    // 3. Create or Update Shop
    const shopData = {
      provider_name: shop.provider_name,
      city_id: cityId,
      full_address: shop.address,
      phone: shop.phone,
      website: shop.website,
      google_maps_url: shop.google_maps_url,
      latitude: shop.latitude,
      longitude: shop.longitude,
      rating: shop.rating,
      review_count: shop.review_count,
      slug: shop.slug || existingShop?.slug || this.slugify(shop.provider_name),
    };

    if (!shopId) {
      if (!this.dryRun) {
        const { data, error } = await this.supabase
          .from('rental_shops')
          .insert(shopData)
          .select()
          .single();
        if (error) throw new Error(`Create shop failed: ${error.message}`);
        shopId = data.id;
      }
      result.action = 'created';
    } else {
      if (!this.dryRun) {
        const { error } = await this.supabase
          .from('rental_shops')
          .update(shopData)
          .eq('id', shopId);
        if (error) throw new Error(`Update shop failed: ${error.message}`);
      }
      result.action = 'updated';
    }

    result.shopId = shopId || 'dry-run-id';

    // 4. Sync Inventory
    if (shopId) {
      // Fetch existing inventory for diffing
      const { data: existingInventory } = await this.supabase
        .from('motorcycle_rentals')
        .select('id, model, rental_rate_per_day')
        .eq('shop_id', shopId);
      
      const existingMap = new Map<string, any>(existingInventory?.map((m: any) => [m.model.toLowerCase(), m]) || []);

      for (const item of inventory.items) {
        try {
          // Resolve item dependencies
          const brandId = await resolveBrandId(item.brand);
          const categoryId = await resolveCategoryId(item.category);
          
          if (!brandId || !categoryId) {
            result.inventory.errors.push(`Skipped ${item.model}: Brand '${item.brand}' or Category '${item.category}' not found`);
            continue;
          }

          const itemData = {
            shop_id: shopId,
            model: item.model,
            brand_id: brandId,
            category_id: categoryId,
            engine_capacity_cc: item.cc,
            year: item.year,
            rental_rate_per_day: item.daily_rate,
            rental_rate_currency: inventory.defaults?.currency || 'THB',
            availability_status: inventory.defaults?.status || 'AVAILABLE',
            source_url: item.source_url,
            // image_url: item.image_url, // handled separately via images table usually
          };

          const match = existingMap.get(item.model.toLowerCase());

          if (match) {
            // Update existing
            if (!this.dryRun) {
              await this.supabase
                .from('motorcycle_rentals')
                .update(itemData)
                .eq('id', match.id);
            }
            result.inventory.updated++;
          } else {
            // Create new (handle qty loop if needed, for now create 1)
            const count = item.qty || 1;
            for (let i = 0; i < count; i++) {
              if (!this.dryRun) {
                await this.supabase.from('motorcycle_rentals').insert(itemData);
              }
              result.inventory.created++;
            }
          }
        } catch (err: any) {
          result.inventory.errors.push(`Error syncing ${item.model}: ${err.message}`);
        }
      }
    }

    return result;
  }

  private slugify(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }
}
