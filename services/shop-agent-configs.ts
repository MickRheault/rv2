import { supabase } from '@/lib/supabase/client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

export type ShopAgentConfig = Database['public']['Tables']['shop_agent_configs']['Row'];
export type ShopAgentConfigInsert = Database['public']['Tables']['shop_agent_configs']['Insert'];
export type ShopAgentConfigUpdate = Database['public']['Tables']['shop_agent_configs']['Update'];

export interface ShopAgentConfigFormData {
  shop_id: string;
  tier: number;
  source_url: string;
  extraction_hints: string | null;
  is_active: boolean;
}

export type ShopCrawlerConfigFormData = ShopAgentConfigFormData;

export interface LearnedAgentConfig {
  extractionHints?: string | null;
  discoveredSourceUrl?: string | null;
}

export function sanitizeLearnedConfig(config?: LearnedAgentConfig | null): {
  extraction_hints?: string;
  source_url?: string;
} {
  const result: { extraction_hints?: string; source_url?: string } = {};
  if (!config) return result;

  if (typeof config.extractionHints === 'string' && config.extractionHints.trim() !== '') {
    result.extraction_hints = config.extractionHints.trim();
  }

  if (typeof config.discoveredSourceUrl === 'string' && config.discoveredSourceUrl.trim() !== '') {
    result.source_url = config.discoveredSourceUrl.trim();
  }

  return result;
}

/**
 * Fetches the agent configuration for a specific shop.
 */
export async function getShopAgentConfig(shopId: string): Promise<ShopAgentConfig | null> {
  const { data, error } = await supabase
    .from('shop_agent_configs')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching shop agent config:', error);
    throw new Error(error.message);
  }

  return data;
}

export const getShopCrawlerConfig = getShopAgentConfig;

/**
 * Saves or updates the agent configuration for a shop.
 */
export async function saveShopAgentConfig(
  formData: ShopAgentConfigFormData
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
    console.error('Error saving shop agent config:', error);
    throw new Error(error.message);
  }

  return data;
}

export const saveShopCrawlerConfig = saveShopAgentConfig;

/**
 * Updates learned extraction hints or discovered source URL for a shop agent config.
 * If no configuration row exists yet for this shop, automatically provisions a Tier 2 config.
 */
export async function updateShopLearnedConfig(
  identifier: { taskId?: string; shopId?: string },
  learned: LearnedAgentConfig
): Promise<ShopAgentConfig | null> {
  const sanitized = sanitizeLearnedConfig(learned);
  if (Object.keys(sanitized).length === 0) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin.from('shop_agent_configs').update(sanitized);

  if (identifier.taskId) {
    query = (query as any).eq('id', identifier.taskId);
  } else if (identifier.shopId) {
    query = (query as any).eq('shop_id', identifier.shopId);
  } else {
    return null;
  }

  const { data, error } = await (query as any).select().maybeSingle();
  if (error) {
    console.error('Failed to update learned agent config:', error);
    throw new Error(`Failed to update learned agent config: ${error.message}`);
  }

  if (data) {
    return data;
  }

  // If no row existed to update and we have a shopId, upsert a new Tier 2 config
  if (!data && identifier.shopId) {
    const { data: shop } = await supabaseAdmin
      .from('rental_shops')
      .select('website')
      .eq('id', identifier.shopId)
      .maybeSingle();

    const targetUrl = sanitized.source_url || shop?.website;
    if (targetUrl) {
      const { data: upserted, error: upsertError } = await (supabaseAdmin
        .from('shop_agent_configs') as any)
        .upsert(
          {
            shop_id: identifier.shopId,
            tier: 2,
            source_url: targetUrl,
            extraction_hints: sanitized.extraction_hints || null,
            is_active: true,
          },
          { onConflict: 'shop_id' }
        )
        .select()
        .maybeSingle();

      if (upsertError) {
        console.error('Failed to upsert missing agent config with learned data:', upsertError);
        throw new Error(`Failed to upsert agent config: ${upsertError.message}`);
      }
      return upserted;
    }
  }

  return null;
}

