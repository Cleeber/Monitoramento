-- On existing projects where unaccent belongs to supabase_admin, reinstall the
-- standard extension in "extensions" through the Dashboard first. Check for
-- custom dependent objects before doing so; never drop those objects with CASCADE.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

DO $extension$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent' AND n.nspname <> 'extensions'
  ) THEN
    ALTER EXTENSION unaccent SET SCHEMA extensions;
  END IF;
END;
$extension$;

-- Application functions already have pg_catalog, public, extensions as their
-- fixed search_path. Their accent removal and slug triggers remain compatible.
