-- Migration: Add content_sections JSONB column to countries table
-- 
-- This migration adds a flexible content management system to country pages
-- allowing administrators to add custom informational sections like:
-- - "Why ride a motorcycle in [Country]?"
-- - "Rental requirements & licenses"
-- - "Top motorcycle routes"
-- - "Best time to visit"
--
-- The content_sections field stores an array of section objects:
-- [
--   {
--     "id": "uuid",
--     "title": "Section Title",
--     "content": "Markdown content...",
--     "order": 1,
--     "createdAt": "2024-01-01T00:00:00Z",
--     "updatedAt": "2024-01-01T00:00:00Z"
--   }
-- ]
--
-- This is a SAFE migration because:
-- 1. Column is nullable - existing records continue to work
-- 2. No data loss occurs
-- 3. Existing queries are unaffected
-- 4. JSONB provides efficient storage and querying

-- Add content_sections column to countries table
ALTER TABLE countries 
  ADD COLUMN content_sections JSONB DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN countries.content_sections IS 'Array of content section objects for displaying location-specific information. Each section includes id, title, content (markdown), order, createdAt, and updatedAt fields.';

-- Verify the migration worked
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'countries' 
  AND column_name = 'content_sections';

