-- Fix the missed parse_flagged_content_changes function security issue
-- This function was missed in the previous security migration

-- Fix search_path for the parse_flagged_content_changes trigger function
DO $$
BEGIN
    BEGIN
        ALTER FUNCTION parse_flagged_content_changes() SET search_path = '';
        RAISE NOTICE 'Successfully fixed search_path for parse_flagged_content_changes()';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function parse_flagged_content_changes() does not exist, skipping';
    END;
END
$$;

