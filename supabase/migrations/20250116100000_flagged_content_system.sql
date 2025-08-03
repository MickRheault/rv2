-- Create flagged content system for content moderation
-- This allows users to flag incorrect information and admins to review/apply changes

-- Content type enum for different flaggable entities
CREATE TYPE content_type AS ENUM (
  'motorcycle',
  'rental_shop',
  'motorcycle_feature',
  'motorcycle_condition',
  'motorcycle_insurance',
  'rental_shop_inclusion',
  'rental_shop_tour'
);

-- Flag category enum for different types of issues
CREATE TYPE flag_category AS ENUM (
  'incorrect_info',
  'outdated_info',
  'missing_info',
  'inappropriate_content',
  'pricing_error',
  'contact_error',
  'location_error',
  'specification_error',
  'availability_error',
  'other'
);

-- Flag status enum for workflow tracking
CREATE TYPE flag_status AS ENUM (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'applied'
);

-- Main flagged content table
CREATE TABLE flagged_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content identification
  content_type content_type NOT NULL,
  entity_id UUID NOT NULL, -- References the specific motorcycle/shop/etc.
  
  -- Flag details
  flag_category flag_category NOT NULL,
  flag_reason TEXT NOT NULL, -- User explanation
  
  -- Data comparison
  original_data JSONB NOT NULL, -- Current state when flagged
  proposed_data JSONB NOT NULL, -- Suggested changes
  
  -- Status and workflow
  status flag_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT, -- Admin review notes
  
  -- User tracking
  flagged_by_user_id UUID, -- Can be null for anonymous flags
  flagged_by_email VARCHAR(255), -- For non-registered users
  
  -- Admin tracking
  reviewed_by_admin_id UUID REFERENCES auth.users(id),
  applied_by_admin_id UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  applied_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional metadata
  priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
  is_verified BOOLEAN DEFAULT false, -- Admin verified the flag is legitimate
  
  -- Ensure at least one contact method
  CONSTRAINT flagged_content_contact_check CHECK (
    flagged_by_user_id IS NOT NULL OR flagged_by_email IS NOT NULL
  )
);

-- Create indexes for efficient querying
CREATE INDEX idx_flagged_content_status ON flagged_content(status);
CREATE INDEX idx_flagged_content_content_type ON flagged_content(content_type);
CREATE INDEX idx_flagged_content_entity_id ON flagged_content(entity_id);
CREATE INDEX idx_flagged_content_flag_category ON flagged_content(flag_category);
CREATE INDEX idx_flagged_content_created_at ON flagged_content(created_at DESC);
CREATE INDEX idx_flagged_content_priority ON flagged_content(priority DESC);

-- Composite indexes for admin dashboard queries
CREATE INDEX idx_flagged_content_admin_review ON flagged_content(status, priority DESC, created_at DESC);
CREATE INDEX idx_flagged_content_content_entity ON flagged_content(content_type, entity_id);

-- Table for tracking field-level changes (for detailed diff view)
CREATE TABLE flagged_content_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_content_id UUID NOT NULL REFERENCES flagged_content(id) ON DELETE CASCADE,
  
  -- Field details
  field_name VARCHAR(100) NOT NULL, -- e.g., 'model', 'rental_rate_per_day', 'phone'
  field_path VARCHAR(200), -- JSON path for nested fields, e.g., 'specifications.engine_capacity'
  
  -- Value changes
  original_value TEXT, -- Current value (as text for display)
  proposed_value TEXT NOT NULL, -- Suggested value
  
  -- Change metadata
  change_type VARCHAR(20) NOT NULL DEFAULT 'update', -- 'update', 'add', 'remove'
  is_critical BOOLEAN DEFAULT false, -- Important changes (price, contact info)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_flagged_content_changes_flagged_content_id ON flagged_content_changes(flagged_content_id);
CREATE INDEX idx_flagged_content_changes_field_name ON flagged_content_changes(field_name);

-- RLS policies for flagged content
ALTER TABLE flagged_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_content_changes ENABLE ROW LEVEL SECURITY;

-- Create clean RLS policies for flagged_content
-- 1. Allow anyone (authenticated and anonymous) to create flagged content
CREATE POLICY "Allow insert for all users" ON flagged_content
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- 2. Allow users to read their own flagged content (authenticated users only)
CREATE POLICY "Allow users to read own flagged content" ON flagged_content
  FOR SELECT TO authenticated
  USING (flagged_by_user_id = auth.uid());

-- 3. Allow anonymous users to read flagged content they created (if they have email)
CREATE POLICY "Allow anonymous users to read flagged content" ON flagged_content
  FOR SELECT TO anon
  USING (true);
  -- We'll handle filtering in the application layer

-- 4. Allow admins to read all flagged content
CREATE POLICY "Allow admins to read all flagged content" ON flagged_content
  FOR SELECT TO authenticated
  USING (is_admin());

-- 5. Allow admins to update flagged content
CREATE POLICY "Allow admins to update flagged content" ON flagged_content
  FOR UPDATE TO authenticated
  USING (is_admin());

-- 6. Allow admins to delete flagged content
CREATE POLICY "Allow admins to delete flagged content" ON flagged_content
  FOR DELETE TO authenticated
  USING (is_admin());

-- Create RLS policies for flagged_content_changes
-- 1. Allow reading flagged content changes (linked to flagged content permissions)
CREATE POLICY "Allow reading flagged content changes" ON flagged_content_changes
  FOR SELECT TO authenticated, anon 
  USING (
    EXISTS (
      SELECT 1 FROM flagged_content fc 
      WHERE fc.id = flagged_content_changes.flagged_content_id
      AND (
        fc.flagged_by_user_id = auth.uid() -- User's own content
        OR is_admin() -- Admin can see all
      )
    )
  );

-- 2. Allow system to insert flagged content changes (via trigger)
CREATE POLICY "Allow system to insert flagged content changes" ON flagged_content_changes
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- 3. Allow admins to update/delete flagged content changes
CREATE POLICY "Allow admins to manage flagged content changes" ON flagged_content_changes
  FOR ALL TO authenticated
  USING (is_admin());

-- Function to automatically parse field changes when flagged content is created
CREATE OR REPLACE FUNCTION parse_flagged_content_changes()
RETURNS TRIGGER AS $$
DECLARE
  key TEXT;
  original_val TEXT;
  proposed_val TEXT;
BEGIN
  -- Parse top-level field changes
  FOR key IN SELECT jsonb_object_keys(NEW.proposed_data)
  LOOP
    original_val := COALESCE((NEW.original_data ->> key), '');
    proposed_val := NEW.proposed_data ->> key;
    
    -- Only insert if values are different
    IF original_val != proposed_val THEN
      INSERT INTO flagged_content_changes (
        flagged_content_id,
        field_name,
        original_value,
        proposed_value,
        change_type,
        is_critical
      ) VALUES (
        NEW.id,
        key,
        original_val,
        proposed_val,
        CASE 
          WHEN original_val = '' THEN 'add'
          WHEN proposed_val = '' THEN 'remove'
          ELSE 'update'
        END,
        -- Mark certain fields as critical
        key IN ('rental_rate_per_day', 'phone', 'website', 'full_address', 'provider_name')
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically parse changes
CREATE TRIGGER trigger_parse_flagged_content_changes
  AFTER INSERT ON flagged_content
  FOR EACH ROW
  EXECUTE FUNCTION parse_flagged_content_changes();

-- Function to apply flagged content changes
CREATE OR REPLACE FUNCTION apply_flagged_content_changes(flagged_content_id UUID, admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  flag_record RECORD;
  update_query TEXT;
  field_name TEXT;
  field_value TEXT;
  table_name TEXT;
  success BOOLEAN DEFAULT false;
BEGIN
  -- Get the flagged content record
  SELECT * INTO flag_record FROM flagged_content 
  WHERE id = flagged_content_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flagged content not found or not approved';
  END IF;
  
  -- Determine target table based on content type
  table_name := CASE flag_record.content_type
    WHEN 'motorcycle' THEN 'motorcycle_rentals'
    WHEN 'rental_shop' THEN 'rental_shops'
    ELSE NULL
  END;
  
  IF table_name IS NULL THEN
    RAISE EXCEPTION 'Unsupported content type: %', flag_record.content_type;
  END IF;
  
  -- Build dynamic update query for top-level fields
  update_query := 'UPDATE ' || table_name || ' SET ';
  
  -- Add each field from proposed_data
  FOR field_name IN SELECT jsonb_object_keys(flag_record.proposed_data)
  LOOP
    field_value := flag_record.proposed_data ->> field_name;
    
    -- Skip certain fields that shouldn't be directly updated
    IF field_name NOT IN ('id', 'created_at', 'updated_at') THEN
      update_query := update_query || field_name || ' = ' || quote_literal(field_value) || ', ';
    END IF;
  END LOOP;
  
  -- Remove trailing comma and add WHERE clause
  update_query := rtrim(update_query, ', ');
  update_query := update_query || ', updated_at = NOW()';
  update_query := update_query || ' WHERE id = ' || quote_literal(flag_record.entity_id);
  
  -- Execute the update
  EXECUTE update_query;
  
  -- Update the flagged content status
  UPDATE flagged_content 
  SET 
    status = 'applied',
    applied_by_admin_id = admin_id,
    applied_at = NOW()
  WHERE id = flagged_content_id;
  
  success := true;
  RETURN success;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false
    RAISE WARNING 'Error applying flagged content changes: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to get flagged content statistics for admin dashboard
CREATE OR REPLACE FUNCTION get_flagged_content_stats()
RETURNS TABLE (
  total_pending INTEGER,
  total_under_review INTEGER,
  total_approved INTEGER,
  total_applied INTEGER,
  total_rejected INTEGER,
  critical_pending INTEGER,
  motorcycle_flags INTEGER,
  rental_shop_flags INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as total_pending,
    COUNT(CASE WHEN status = 'under_review' THEN 1 END)::INTEGER as total_under_review,
    COUNT(CASE WHEN status = 'approved' THEN 1 END)::INTEGER as total_approved,
    COUNT(CASE WHEN status = 'applied' THEN 1 END)::INTEGER as total_applied,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END)::INTEGER as total_rejected,
    COUNT(CASE WHEN status = 'pending' AND priority >= 4 THEN 1 END)::INTEGER as critical_pending,
    COUNT(CASE WHEN content_type = 'motorcycle' THEN 1 END)::INTEGER as motorcycle_flags,
    COUNT(CASE WHEN content_type = 'rental_shop' THEN 1 END)::INTEGER as rental_shop_flags
  FROM flagged_content;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION apply_flagged_content_changes TO authenticated;
GRANT EXECUTE ON FUNCTION get_flagged_content_stats TO authenticated; 