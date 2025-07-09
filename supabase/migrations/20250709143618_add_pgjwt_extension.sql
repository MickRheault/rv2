-- Add pgjwt extension for JWT token processing
-- This extension is required for the admin authentication system
create extension if not exists "pgjwt" with schema "extensions";
