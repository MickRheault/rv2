-- Premium Listings System Migration
-- Created: 2025-01-16 12:00:00
-- Purpose: Add premium listing management with tiers, expiry, and analytics

-- Create enums for premium system
CREATE TYPE premium_tier AS ENUM ('gold', 'platinum', 'featured');
CREATE TYPE premium_status AS ENUM ('active', 'expired', 'paused', 'cancelled');
CREATE TYPE premium_content_type AS ENUM ('motorcycle', 'rental_shop');
CREATE TYPE premium_metric_type AS ENUM ('views', 'clicks', 'inquiries', 'conversions', 'favorites');

-- Premium Pricing Plans Table
CREATE TABLE premium_pricing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier premium_tier NOT NULL,
    duration_days INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    features JSONB,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT premium_pricing_plans_price_check CHECK (price > 0),
    CONSTRAINT premium_pricing_plans_duration_check CHECK (duration_days > 0)
);

-- Premium Listings Table
CREATE TABLE premium_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type premium_content_type NOT NULL,
    entity_id UUID NOT NULL,
    premium_tier premium_tier NOT NULL,
    status premium_status NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_paid DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    pricing_plan_id UUID REFERENCES premium_pricing_plans(id),
    auto_renew BOOLEAN DEFAULT false,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT premium_listings_date_check CHECK (end_date > start_date),
    CONSTRAINT premium_listings_price_check CHECK (price_paid IS NULL OR price_paid > 0),
    CONSTRAINT premium_listings_unique_active UNIQUE (content_type, entity_id)
);

-- Premium Analytics Table
CREATE TABLE premium_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    premium_listing_id UUID NOT NULL REFERENCES premium_listings(id) ON DELETE CASCADE,
    metric_type premium_metric_type NOT NULL,
    metric_value INTEGER NOT NULL DEFAULT 0,
    recorded_date DATE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT premium_analytics_value_check CHECK (metric_value >= 0),
    CONSTRAINT premium_analytics_unique_daily UNIQUE (premium_listing_id, metric_type, recorded_date)
);

-- Create indexes for performance
CREATE INDEX idx_premium_listings_content_type_entity ON premium_listings(content_type, entity_id);
CREATE INDEX idx_premium_listings_tier_status ON premium_listings(premium_tier, status);
CREATE INDEX idx_premium_listings_dates ON premium_listings(start_date, end_date);
CREATE INDEX idx_premium_listings_created_at ON premium_listings(created_at);
CREATE INDEX idx_premium_analytics_listing_date ON premium_analytics(premium_listing_id, recorded_date);
CREATE INDEX idx_premium_analytics_listing_metric ON premium_analytics(premium_listing_id, metric_type);

-- Insert default pricing plans
INSERT INTO premium_pricing_plans (tier, duration_days, price, currency, description) VALUES
('gold', 7, 19.99, 'USD', '1 Week Gold Premium - Priority placement'),
('gold', 30, 49.99, 'USD', '1 Month Gold Premium - Priority placement'),
('gold', 90, 129.99, 'USD', '3 Months Gold Premium - Priority placement'),
('platinum', 7, 39.99, 'USD', '1 Week Platinum Premium - Top priority + featured'),
('platinum', 30, 99.99, 'USD', '1 Month Platinum Premium - Top priority + featured'),
('platinum', 90, 249.99, 'USD', '3 Months Platinum Premium - Top priority + featured'),
('featured', 7, 59.99, 'USD', '1 Week Featured Premium - Maximum visibility'),
('featured', 30, 149.99, 'USD', '1 Month Featured Premium - Maximum visibility'),
('featured', 90, 399.99, 'USD', '3 Months Featured Premium - Maximum visibility');

-- Function to get premium listing dashboard stats
CREATE OR REPLACE FUNCTION get_premium_dashboard_stats()
RETURNS TABLE (
    total_active_listings BIGINT,
    total_expired_listings BIGINT,
    expiring_soon BIGINT,
    revenue_this_month DECIMAL(10,2),
    revenue_last_month DECIMAL(10,2),
    new_listings_this_month BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'active') as total_active_listings,
        COUNT(*) FILTER (WHERE status = 'expired') as total_expired_listings,
        COUNT(*) FILTER (WHERE status = 'active' AND end_date <= CURRENT_DATE + INTERVAL '7 days') as expiring_soon,
        COALESCE(SUM(price_paid) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0) as revenue_this_month,
        COALESCE(SUM(price_paid) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
                                              AND created_at < date_trunc('month', CURRENT_DATE)), 0) as revenue_last_month,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_listings_this_month
    FROM premium_listings;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically expire premium listings
CREATE OR REPLACE FUNCTION expire_premium_listings()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE premium_listings
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active' 
      AND end_date < CURRENT_DATE;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get analytics summary for a premium listing
CREATE OR REPLACE FUNCTION get_premium_analytics_summary(
    p_listing_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    metric_type premium_metric_type,
    total_value BIGINT,
    avg_daily_value DECIMAL(10,2),
    days_tracked INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pa.metric_type,
        SUM(pa.metric_value)::BIGINT as total_value,
        ROUND(AVG(pa.metric_value)::NUMERIC, 2) as avg_daily_value,
        COUNT(DISTINCT pa.recorded_date)::INTEGER as days_tracked
    FROM premium_analytics pa
    WHERE pa.premium_listing_id = p_listing_id
      AND (p_start_date IS NULL OR pa.recorded_date >= p_start_date)
      AND (p_end_date IS NULL OR pa.recorded_date <= p_end_date)
    GROUP BY pa.metric_type
    ORDER BY total_value DESC;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE premium_pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_analytics ENABLE ROW LEVEL SECURITY;

-- Premium pricing plans are publicly readable
CREATE POLICY "Premium pricing plans are publicly readable"
ON premium_pricing_plans FOR SELECT
TO authenticated
USING (true);

-- Admin policies for premium listings
CREATE POLICY "Admins can manage premium listings"
ON premium_listings FOR ALL
TO authenticated
USING (is_admin());

-- Admin policies for premium analytics
CREATE POLICY "Admins can manage premium analytics"
ON premium_analytics FOR ALL
TO authenticated
USING (is_admin());

-- Update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_premium_listings_updated_at
    BEFORE UPDATE ON premium_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_premium_pricing_plans_updated_at
    BEFORE UPDATE ON premium_pricing_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_premium_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION expire_premium_listings() TO authenticated;
GRANT EXECUTE ON FUNCTION get_premium_analytics_summary(UUID, DATE, DATE) TO authenticated;

