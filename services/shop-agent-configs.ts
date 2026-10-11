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

export function extractLearnedAgentConfig(
  body: Record<string, any>
): LearnedAgentConfig | undefined {
  if (!body || typeof body !== 'object') return undefined;

  const rawHints = body.learnedExtractionHints ?? body.extractionHints;
  const hints =
    typeof rawHints === 'string' && rawHints.trim() !== '' ? rawHints.trim() : undefined;
  const discoveredUrl =
    typeof body.discoveredSourceUrl === 'string' && body.discoveredSourceUrl.trim() !== ''
      ? body.discoveredSourceUrl.trim()
      : undefined;

  if (!hints && !discoveredUrl) return undefined;
  return {
    extractionHints: hints,
    discoveredSourceUrl: discoveredUrl,
  };
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
  shopId: string,
  learned: LearnedAgentConfig
): Promise<ShopAgentConfig | null> {
  const sanitized = sanitizeLearnedConfig(learned);
  if (Object.keys(sanitized).length === 0) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await (supabaseAdmin
    .from('shop_agent_configs') as any)
    .update(sanitized)
    .eq('shop_id', shopId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to update learned agent config:', error);
    throw new Error(`Failed to update learned agent config: ${error.message}`);
  }

  if (data) {
    return data;
  }

  // If no row existed to update for this shopId, upsert a new Tier 2 config
  const { data: shop } = await supabaseAdmin
    .from('rental_shops')
    .select('website')
    .eq('id', shopId)
    .maybeSingle();

  const targetUrl = sanitized.source_url || shop?.website;
  if (targetUrl) {
    const { data: upserted, error: upsertError } = await (supabaseAdmin
      .from('shop_agent_configs') as any)
      .upsert(
        {
          shop_id: shopId,
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

  return null;
}
