-- Consolidated RLS migration
-- - Enables RLS and adds public read policies (anon + authenticated)
-- - Adds admin-only write policies (INSERT/UPDATE/DELETE guarded by is_admin())
-- - Uses full-sentence policy names consistent with existing migrations

BEGIN;

-- Helper: enable RLS + public read + admin writes for a table
-- Note: Postgres lacks IF NOT EXISTS for policies; use DROP POLICY IF EXISTS before CREATE

-- Brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read brands" ON public.brands;
CREATE POLICY "Allow anonymous users to read brands" ON public.brands FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read brands" ON public.brands;
CREATE POLICY "Allow authenticated users to read brands" ON public.brands FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create brands" ON public.brands;
CREATE POLICY "Allow admins to create brands" ON public.brands FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update brands" ON public.brands;
CREATE POLICY "Allow admins to update brands" ON public.brands FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete brands" ON public.brands;
CREATE POLICY "Allow admins to delete brands" ON public.brands FOR DELETE TO authenticated USING (is_admin());

-- Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read categories" ON public.categories;
CREATE POLICY "Allow anonymous users to read categories" ON public.categories FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read categories" ON public.categories;
CREATE POLICY "Allow authenticated users to read categories" ON public.categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create categories" ON public.categories;
CREATE POLICY "Allow admins to create categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update categories" ON public.categories;
CREATE POLICY "Allow admins to update categories" ON public.categories FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete categories" ON public.categories;
CREATE POLICY "Allow admins to delete categories" ON public.categories FOR DELETE TO authenticated USING (is_admin());

-- Features
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read features" ON public.features;
CREATE POLICY "Allow anonymous users to read features" ON public.features FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read features" ON public.features;
CREATE POLICY "Allow authenticated users to read features" ON public.features FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create features" ON public.features;
CREATE POLICY "Allow admins to create features" ON public.features FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update features" ON public.features;
CREATE POLICY "Allow admins to update features" ON public.features FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete features" ON public.features;
CREATE POLICY "Allow admins to delete features" ON public.features FOR DELETE TO authenticated USING (is_admin());

-- Images (metadata)
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read images" ON public.images;
CREATE POLICY "Allow anonymous users to read images" ON public.images FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read images" ON public.images;
CREATE POLICY "Allow authenticated users to read images" ON public.images FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create images" ON public.images;
CREATE POLICY "Allow admins to create images" ON public.images FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update images" ON public.images;
CREATE POLICY "Allow admins to update images" ON public.images FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete images" ON public.images;
CREATE POLICY "Allow admins to delete images" ON public.images FOR DELETE TO authenticated USING (is_admin());

-- Countries
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read countries" ON public.countries;
CREATE POLICY "Allow anonymous users to read countries" ON public.countries FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read countries" ON public.countries;
CREATE POLICY "Allow authenticated users to read countries" ON public.countries FOR SELECT TO authenticated USING (true);

-- Provinces
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read provinces" ON public.provinces;
CREATE POLICY "Allow anonymous users to read provinces" ON public.provinces FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read provinces" ON public.provinces;
CREATE POLICY "Allow authenticated users to read provinces" ON public.provinces FOR SELECT TO authenticated USING (true);

-- Cities
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read cities" ON public.cities;
CREATE POLICY "Allow anonymous users to read cities" ON public.cities FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read cities" ON public.cities;
CREATE POLICY "Allow authenticated users to read cities" ON public.cities FOR SELECT TO authenticated USING (true);

-- Condition types
ALTER TABLE public.condition_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read condition types" ON public.condition_types;
CREATE POLICY "Allow anonymous users to read condition types" ON public.condition_types FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read condition types" ON public.condition_types;
CREATE POLICY "Allow authenticated users to read condition types" ON public.condition_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create condition types" ON public.condition_types;
CREATE POLICY "Allow admins to create condition types" ON public.condition_types FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update condition types" ON public.condition_types;
CREATE POLICY "Allow admins to update condition types" ON public.condition_types FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete condition types" ON public.condition_types;
CREATE POLICY "Allow admins to delete condition types" ON public.condition_types FOR DELETE TO authenticated USING (is_admin());

-- Insurance types
ALTER TABLE public.insurance_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read insurance types" ON public.insurance_types;
CREATE POLICY "Allow anonymous users to read insurance types" ON public.insurance_types FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read insurance types" ON public.insurance_types;
CREATE POLICY "Allow authenticated users to read insurance types" ON public.insurance_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create insurance types" ON public.insurance_types;
CREATE POLICY "Allow admins to create insurance types" ON public.insurance_types FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update insurance types" ON public.insurance_types;
CREATE POLICY "Allow admins to update insurance types" ON public.insurance_types FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete insurance types" ON public.insurance_types;
CREATE POLICY "Allow admins to delete insurance types" ON public.insurance_types FOR DELETE TO authenticated USING (is_admin());

-- Rental rate tiers
ALTER TABLE public.rental_rate_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read rental rate tiers" ON public.rental_rate_tiers;
CREATE POLICY "Allow anonymous users to read rental rate tiers" ON public.rental_rate_tiers FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read rental rate tiers" ON public.rental_rate_tiers;
CREATE POLICY "Allow authenticated users to read rental rate tiers" ON public.rental_rate_tiers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create rental rate tiers" ON public.rental_rate_tiers;
CREATE POLICY "Allow admins to create rental rate tiers" ON public.rental_rate_tiers FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update rental rate tiers" ON public.rental_rate_tiers;
CREATE POLICY "Allow admins to update rental rate tiers" ON public.rental_rate_tiers FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete rental rate tiers" ON public.rental_rate_tiers;
CREATE POLICY "Allow admins to delete rental rate tiers" ON public.rental_rate_tiers FOR DELETE TO authenticated USING (is_admin());

-- Rental shops
ALTER TABLE public.rental_shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read rental shops" ON public.rental_shops;
CREATE POLICY "Allow anonymous users to read rental shops" ON public.rental_shops FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read rental shops" ON public.rental_shops;
CREATE POLICY "Allow authenticated users to read rental shops" ON public.rental_shops FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create rental shops" ON public.rental_shops;
CREATE POLICY "Allow admins to create rental shops" ON public.rental_shops FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update rental shops" ON public.rental_shops;
CREATE POLICY "Allow admins to update rental shops" ON public.rental_shops FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete rental shops" ON public.rental_shops;
CREATE POLICY "Allow admins to delete rental shops" ON public.rental_shops FOR DELETE TO authenticated USING (is_admin());

-- Rental shop inclusions
ALTER TABLE public.rental_shop_inclusions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read rental shop inclusions" ON public.rental_shop_inclusions;
CREATE POLICY "Allow anonymous users to read rental shop inclusions" ON public.rental_shop_inclusions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read rental shop inclusions" ON public.rental_shop_inclusions;
CREATE POLICY "Allow authenticated users to read rental shop inclusions" ON public.rental_shop_inclusions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create rental shop inclusions" ON public.rental_shop_inclusions;
CREATE POLICY "Allow admins to create rental shop inclusions" ON public.rental_shop_inclusions FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update rental shop inclusions" ON public.rental_shop_inclusions;
CREATE POLICY "Allow admins to update rental shop inclusions" ON public.rental_shop_inclusions FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete rental shop inclusions" ON public.rental_shop_inclusions;
CREATE POLICY "Allow admins to delete rental shop inclusions" ON public.rental_shop_inclusions FOR DELETE TO authenticated USING (is_admin());

-- Rental shop service locations
ALTER TABLE public.rental_shop_service_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read rental shop service locations" ON public.rental_shop_service_locations;
CREATE POLICY "Allow anonymous users to read rental shop service locations" ON public.rental_shop_service_locations FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read rental shop service locations" ON public.rental_shop_service_locations;
CREATE POLICY "Allow authenticated users to read rental shop service locations" ON public.rental_shop_service_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create rental shop service locations" ON public.rental_shop_service_locations;
CREATE POLICY "Allow admins to create rental shop service locations" ON public.rental_shop_service_locations FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update rental shop service locations" ON public.rental_shop_service_locations;
CREATE POLICY "Allow admins to update rental shop service locations" ON public.rental_shop_service_locations FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete rental shop service locations" ON public.rental_shop_service_locations;
CREATE POLICY "Allow admins to delete rental shop service locations" ON public.rental_shop_service_locations FOR DELETE TO authenticated USING (is_admin());

-- Rental shop tours
ALTER TABLE public.rental_shop_tours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read rental shop tours" ON public.rental_shop_tours;
CREATE POLICY "Allow anonymous users to read rental shop tours" ON public.rental_shop_tours FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read rental shop tours" ON public.rental_shop_tours;
CREATE POLICY "Allow authenticated users to read rental shop tours" ON public.rental_shop_tours FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create rental shop tours" ON public.rental_shop_tours;
CREATE POLICY "Allow admins to create rental shop tours" ON public.rental_shop_tours FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update rental shop tours" ON public.rental_shop_tours;
CREATE POLICY "Allow admins to update rental shop tours" ON public.rental_shop_tours FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete rental shop tours" ON public.rental_shop_tours;
CREATE POLICY "Allow admins to delete rental shop tours" ON public.rental_shop_tours FOR DELETE TO authenticated USING (is_admin());

-- Rental shop conditions
ALTER TABLE public.rental_shop_conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read rental shop conditions" ON public.rental_shop_conditions;
CREATE POLICY "Allow anonymous users to read rental shop conditions" ON public.rental_shop_conditions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read rental shop conditions" ON public.rental_shop_conditions;
CREATE POLICY "Allow authenticated users to read rental shop conditions" ON public.rental_shop_conditions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create rental shop conditions" ON public.rental_shop_conditions;
CREATE POLICY "Allow admins to create rental shop conditions" ON public.rental_shop_conditions FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update rental shop conditions" ON public.rental_shop_conditions;
CREATE POLICY "Allow admins to update rental shop conditions" ON public.rental_shop_conditions FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete rental shop conditions" ON public.rental_shop_conditions;
CREATE POLICY "Allow admins to delete rental shop conditions" ON public.rental_shop_conditions FOR DELETE TO authenticated USING (is_admin());

-- Motorcycle rentals
ALTER TABLE public.motorcycle_rentals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read motorcycle rentals" ON public.motorcycle_rentals;
CREATE POLICY "Allow anonymous users to read motorcycle rentals" ON public.motorcycle_rentals FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read motorcycle rentals" ON public.motorcycle_rentals;
CREATE POLICY "Allow authenticated users to read motorcycle rentals" ON public.motorcycle_rentals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create motorcycle rentals" ON public.motorcycle_rentals;
CREATE POLICY "Allow admins to create motorcycle rentals" ON public.motorcycle_rentals FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update motorcycle rentals" ON public.motorcycle_rentals;
CREATE POLICY "Allow admins to update motorcycle rentals" ON public.motorcycle_rentals FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete motorcycle rentals" ON public.motorcycle_rentals;
CREATE POLICY "Allow admins to delete motorcycle rentals" ON public.motorcycle_rentals FOR DELETE TO authenticated USING (is_admin());

-- Motorcycle features (link table)
ALTER TABLE public.motorcycle_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read motorcycle features" ON public.motorcycle_features;
CREATE POLICY "Allow anonymous users to read motorcycle features" ON public.motorcycle_features FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read motorcycle features" ON public.motorcycle_features;
CREATE POLICY "Allow authenticated users to read motorcycle features" ON public.motorcycle_features FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create motorcycle features" ON public.motorcycle_features;
CREATE POLICY "Allow admins to create motorcycle features" ON public.motorcycle_features FOR INSERT TO authenticated WITH CHECK (is_admin()));
DROP POLICY IF EXISTS "Allow admins to delete motorcycle features" ON public.motorcycle_features;
CREATE POLICY "Allow admins to delete motorcycle features" ON public.motorcycle_features FOR DELETE TO authenticated USING (is_admin());

-- Motorcycle images (link table)
ALTER TABLE public.motorcycle_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read motorcycle images" ON public.motorcycle_images;
CREATE POLICY "Allow anonymous users to read motorcycle images" ON public.motorcycle_images FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read motorcycle images" ON public.motorcycle_images;
CREATE POLICY "Allow authenticated users to read motorcycle images" ON public.motorcycle_images FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create motorcycle images" ON public.motorcycle_images;
CREATE POLICY "Allow admins to create motorcycle images" ON public.motorcycle_images FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete motorcycle images" ON public.motorcycle_images;
CREATE POLICY "Allow admins to delete motorcycle images" ON public.motorcycle_images FOR DELETE TO authenticated USING (is_admin());

-- Motorcycle insurance details
ALTER TABLE public.motorcycle_insurance_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read motorcycle insurance details" ON public.motorcycle_insurance_details;
CREATE POLICY "Allow anonymous users to read motorcycle insurance details" ON public.motorcycle_insurance_details FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read motorcycle insurance details" ON public.motorcycle_insurance_details;
CREATE POLICY "Allow authenticated users to read motorcycle insurance details" ON public.motorcycle_insurance_details FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create motorcycle insurance details" ON public.motorcycle_insurance_details;
CREATE POLICY "Allow admins to create motorcycle insurance details" ON public.motorcycle_insurance_details FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update motorcycle insurance details" ON public.motorcycle_insurance_details;
CREATE POLICY "Allow admins to update motorcycle insurance details" ON public.motorcycle_insurance_details FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete motorcycle insurance details" ON public.motorcycle_insurance_details;
CREATE POLICY "Allow admins to delete motorcycle insurance details" ON public.motorcycle_insurance_details FOR DELETE TO authenticated USING (is_admin());

-- Motorcycle required documents
ALTER TABLE public.motorcycle_required_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read motorcycle required documents" ON public.motorcycle_required_documents;
CREATE POLICY "Allow anonymous users to read motorcycle required documents" ON public.motorcycle_required_documents FOR SELECT TO anon USING (true));
DROP POLICY IF EXISTS "Allow authenticated users to read motorcycle required documents" ON public.motorcycle_required_documents;
CREATE POLICY "Allow authenticated users to read motorcycle required documents" ON public.motorcycle_required_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create motorcycle required documents" ON public.motorcycle_required_documents;
CREATE POLICY "Allow admins to create motorcycle required documents" ON public.motorcycle_required_documents FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete motorcycle required documents" ON public.motorcycle_required_documents;
CREATE POLICY "Allow admins to delete motorcycle required documents" ON public.motorcycle_required_documents FOR DELETE TO authenticated USING (is_admin());

-- Required document types
ALTER TABLE public.required_document_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read required document types" ON public.required_document_types;
CREATE POLICY "Allow anonymous users to read required document types" ON public.required_document_types FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read required document types" ON public.required_document_types;
CREATE POLICY "Allow authenticated users to read required document types" ON public.required_document_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create required document types" ON public.required_document_types;
CREATE POLICY "Allow admins to create required document types" ON public.required_document_types FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update required document types" ON public.required_document_types;
CREATE POLICY "Allow admins to update required document types" ON public.required_document_types FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete required document types" ON public.required_document_types;
CREATE POLICY "Allow admins to delete required document types" ON public.required_document_types FOR DELETE TO authenticated USING (is_admin());

-- Business statuses
ALTER TABLE public.business_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read business statuses" ON public.business_statuses;
CREATE POLICY "Allow anonymous users to read business statuses" ON public.business_statuses FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read business statuses" ON public.business_statuses;
CREATE POLICY "Allow authenticated users to read business statuses" ON public.business_statuses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create business statuses" ON public.business_statuses;
CREATE POLICY "Allow admins to create business statuses" ON public.business_statuses FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to update business statuses" ON public.business_statuses;
CREATE POLICY "Allow admins to update business statuses" ON public.business_statuses FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow admins to delete business statuses" ON public.business_statuses;
CREATE POLICY "Allow admins to delete business statuses" ON public.business_statuses FOR DELETE TO authenticated USING (is_admin());

-- Motorcycle conditions
ALTER TABLE public.motorcycle_conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous users to read motorcycle conditions" ON public.motorcycle_conditions;
CREATE POLICY "Allow anonymous users to read motorcycle conditions" ON public.motorcycle_conditions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to read motorcycle conditions" ON public.motorcycle_conditions;
CREATE POLICY "Allow authenticated users to read motorcycle conditions" ON public.motorcycle_conditions FOR SELECT TO authenticated USING (true);

COMMIT;


