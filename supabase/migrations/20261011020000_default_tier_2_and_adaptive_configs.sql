-- Migration: Default all rental shops to Tier 2 shop agent configs and auto-provision on shop creation
-- Ticket #102: feat: default Tier 2 shop agent configs and adaptive extraction hints

-- 1. Backfill all existing rental shops that have a valid website into Tier 2 (30-day cadence)
INSERT INTO public.shop_agent_configs (shop_id, tier, source_url, is_active)
SELECT 
  id,
  2,
  TRIM(website),
  true
FROM public.rental_shops
WHERE website IS NOT NULL 
  AND TRIM(website) != ''
ON CONFLICT (shop_id) DO UPDATE
SET source_url = CASE 
  WHEN shop_agent_configs.source_url IS NULL OR TRIM(shop_agent_configs.source_url) = '' 
  THEN EXCLUDED.source_url 
  ELSE shop_agent_configs.source_url 
END;

-- 2. Trigger function to auto-provision Tier 2 shop agent config when a rental shop has a website
CREATE OR REPLACE FUNCTION public.handle_rental_shop_agent_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.website IS NOT NULL AND TRIM(NEW.website) != '' THEN
    INSERT INTO public.shop_agent_configs (shop_id, tier, source_url, is_active)
    VALUES (NEW.id, 2, TRIM(NEW.website), true)
    ON CONFLICT (shop_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to rental_shops table
DROP TRIGGER IF EXISTS trg_rental_shop_auto_agent_config ON public.rental_shops;
CREATE TRIGGER trg_rental_shop_auto_agent_config
  AFTER INSERT OR UPDATE OF website ON public.rental_shops
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_rental_shop_agent_config();
