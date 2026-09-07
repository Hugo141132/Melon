-- ==============================================================================
-- KEBUN MELON: Local Restore Rehearsal - Scaffolding Script
-- Purpose: Setup required Supabase-compatible roles, schemas, and extensions
-- Target: Local isolated PostgreSQL instance (e.g. port 5433)
-- Invariance: Isolated container/local DB only; zero external connections
-- ==============================================================================

-- 1. Create standard Supabase roles if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN;
  END IF;
END $$;

-- 2. Establish standard role membership
GRANT anon, authenticated, service_role TO authenticator;

-- 3. Create extensions schema and install core extensions (matching Supabase structure)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role, postgres;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
