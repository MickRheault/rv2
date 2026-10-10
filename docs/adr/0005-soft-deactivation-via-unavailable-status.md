# Soft Deactivation via Unavailable Status

When an ingestion run detects that existing shop inventory is missing from the source, the Change Proposal marks the items with `availability_status = 'unavailable'` rather than issuing hard deletes. This preserves foreign keys, historical analytics, and SEO metadata while seamlessly triggering existing database index exclusion (`idx_motorcycles_location_brand_category`) and frontend availability toggles.
