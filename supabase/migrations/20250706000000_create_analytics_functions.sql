-- Analytics RPC Functions
-- These functions provide aggregated data for the admin analytics dashboard.

-- Geographic Distribution of Rental Shops
CREATE OR REPLACE FUNCTION get_geographic_distribution()
RETURNS TABLE(country TEXT, city TEXT, shop_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.name AS country,
    ci.name AS city,
    count(rs.id) AS shop_count
  FROM rental_shops rs
  JOIN cities ci ON rs.city_id = ci.id
  JOIN provinces p ON ci.province_id = p.id
  JOIN countries c ON p.country_code = c.code
  GROUP BY c.name, ci.name
  ORDER BY shop_count DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Motorcycle Distribution by Category
CREATE OR REPLACE FUNCTION get_category_distribution()
RETURNS TABLE(category TEXT, count BIGINT, avg_price NUMERIC, avg_engine_size NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.name AS category,
    count(mr.id) AS count,
    avg(mr.rental_rate_per_day)::NUMERIC(10, 2) AS avg_price,
    avg(mr.engine_capacity_cc)::NUMERIC(10, 0) AS avg_engine_size
  FROM motorcycle_rentals mr
  JOIN categories c ON mr.category_id = c.id
  GROUP BY c.name
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Motorcycle Distribution by Brand
CREATE OR REPLACE FUNCTION get_brand_distribution()
RETURNS TABLE(brand TEXT, count BIGINT, avg_price NUMERIC, avg_engine_size NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.name AS brand,
    count(mr.id) AS count,
    avg(mr.rental_rate_per_day)::NUMERIC(10, 2) AS avg_price,
    avg(mr.engine_capacity_cc)::NUMERIC(10, 0) AS avg_engine_size
  FROM motorcycle_rentals mr
  JOIN brands b ON mr.brand_id = b.id
  GROUP BY b.name
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql; 