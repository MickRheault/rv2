import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

export type ShopAgentConfig = Database['public']['Tables']['shop_agent_configs']['Row'];
export type ShopAgentConfigInsert = Database['public']['Tables']['shop_agent_configs']['Insert'];
export type ShopAgentConfigUpdate = Database['public']['Tables']['shop_agent_configs']['Update'];

export interface ShopCrawlerConfigFormData {
  shop_id: string;
  tier: number;
  source_url: string;
  extraction_hints: string | null;
  is_active: boolean;
}

/**
 * Fetches the crawler configuration for a specific shop.
 */
export async function getShopCrawlerConfig(shopId: string): Promise<ShopAgentConfig | null> {
  const { data, error } = await supabase
    .from('shop_agent_configs')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching shop crawler config:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Saves or updates the crawler configuration for a shop.
 */
export async function saveShopCrawlerConfig(
  formData: ShopCrawlerConfigFormData
): Promise<ShopAgentConfig> {
  const { data, error } = await (supabase
    .from('shop_agent_configs') as any)
    .upsert(
      {
        shop_id: formData.shop_id,
        tier: formData.tier,
        source_url: formData.source_url,
        extraction_hints: formData.extraction_hints || null,
        is_active: formData.is_active,
      },
      { onConflict: 'shop_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving shop crawler config:', error);
    throw new Error(error.message);
  }

  return data;
}
