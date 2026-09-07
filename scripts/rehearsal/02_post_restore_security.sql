-- ==============================================================================
-- KEBUN MELON: Post-Restore Explicit Security & Privilege Hardening
-- Purpose: Enforce strict table ownership, revoke unauthorized public HTTP roles,
--          update default privileges, and enable Row Level Security on all tables.
-- Invariance: Zero reliance on target default privileges.
-- ==============================================================================

-- 1. Ensure all public tables are owned by postgres
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO postgres;', r.tablename);
  END LOOP;
END $$;

-- 2. Revoke all direct privileges from public HTTP roles and PUBLIC pseudo-role
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- 3. Adjust default privileges so future tables/sequences created by postgres do not expose grants
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;

-- 4. Grant explicit required privileges to postgres and service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- 5. Enforce Row Level Security across all application tables in public
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
