-- ==============================================================================
-- KEBUN MELON: Local Restore Rehearsal - Integrity & Security Verification Script
-- Purpose: Verify table counts, table ownership, RLS status, effective privileges,
--          and true relational foreign key integrity across all tables in public.
-- ==============================================================================

\set ON_ERROR_STOP on

-- Temporary table to hold audit results
CREATE TEMP TABLE rehearsal_verification_results (
  check_name TEXT PRIMARY KEY,
  expected TEXT NOT NULL,
  actual TEXT NOT NULL,
  status TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- 1. Table Count Verification (Public Schema)
-- ------------------------------------------------------------------------------
INSERT INTO rehearsal_verification_results (check_name, expected, actual, status)
SELECT 
  'Public Tables Count',
  '26',
  count(*)::text,
  CASE WHEN count(*) = 26 THEN 'PASS' ELSE 'FAIL' END
FROM pg_tables
WHERE schemaname = 'public';

-- ------------------------------------------------------------------------------
-- 2. Table Ownership Verification (Must be postgres)
-- ------------------------------------------------------------------------------
INSERT INTO rehearsal_verification_results (check_name, expected, actual, status)
SELECT 
  'Tables Owned by postgres',
  '26',
  count(*)::text,
  CASE WHEN count(*) = 26 THEN 'PASS' ELSE 'FAIL' END
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
  AND pg_get_userbyid(c.relowner) = 'postgres';

-- ------------------------------------------------------------------------------
-- 3. Row Level Security Enforcement (Must be enabled on 26 tables)
-- ------------------------------------------------------------------------------
INSERT INTO rehearsal_verification_results (check_name, expected, actual, status)
SELECT 
  'Tables with RLS Enabled',
  '26',
  count(*)::text,
  CASE WHEN count(*) = 26 THEN 'PASS' ELSE 'FAIL' END
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
  AND c.relrowsecurity = true;

-- ------------------------------------------------------------------------------
-- 4. Effective Privileges Audit (anon, authenticated, PUBLIC must have 0 grants)
-- ------------------------------------------------------------------------------
INSERT INTO rehearsal_verification_results (check_name, expected, actual, status)
WITH unauthorized_privileges AS (
  SELECT 
    c.relname AS table_name,
    r.rolname AS role_name,
    p.privilege_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated'), ('public')) AS r(rolname)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(privilege_name)
  WHERE n.nspname = 'public' 
    AND c.relkind = 'r'
    AND has_table_privilege(r.rolname, c.oid, p.privilege_name)
)
SELECT 
  'Unauthorized Public/Anon Grants',
  '0',
  count(*)::text,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM unauthorized_privileges;

-- ------------------------------------------------------------------------------
-- 5. Application Role Privileges Audit (postgres and service_role must have full access)
-- ------------------------------------------------------------------------------
INSERT INTO rehearsal_verification_results (check_name, expected, actual, status)
WITH missing_app_privileges AS (
  SELECT 
    c.relname AS table_name,
    r.rolname AS role_name,
    p.privilege_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('postgres'), ('service_role')) AS r(rolname)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(privilege_name)
  WHERE n.nspname = 'public' 
    AND c.relkind = 'r'
    AND NOT has_table_privilege(r.rolname, c.oid, p.privilege_name)
)
SELECT 
  'Application Role Privileges (postgres & service_role)',
  '0 missing',
  count(*)::text || ' missing',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM missing_app_privileges;

-- ------------------------------------------------------------------------------
-- 6. Prisma Migration History Verification
-- ------------------------------------------------------------------------------
INSERT INTO rehearsal_verification_results (check_name, expected, actual, status)
SELECT 
  'Prisma Migrations Applied',
  '>= 10',
  count(*)::text,
  CASE WHEN count(*) >= 10 THEN 'PASS' ELSE 'FAIL' END
FROM public._prisma_migrations;

-- ------------------------------------------------------------------------------
-- 7. Real Foreign Key Integrity Verification (Detecting Orphaned Rows)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  fk_rec RECORD;
  orphan_count BIGINT;
  total_orphans BIGINT := 0;
  fk_checked_count INT := 0;
  query_text TEXT;
BEGIN
  CREATE TEMP TABLE temp_fk_violations (
    constraint_name TEXT,
    child_table TEXT,
    parent_table TEXT,
    child_columns TEXT,
    parent_columns TEXT,
    orphan_count BIGINT
  );

  FOR fk_rec IN
    SELECT 
      c.conname AS constraint_name,
      child_tbl.relname AS child_table,
      parent_tbl.relname AS parent_table,
      string_agg(quote_ident(a_child.attname), ', ' ORDER BY pos.ord) AS child_cols,
      string_agg(quote_ident(a_parent.attname), ', ' ORDER BY pos.ord) AS parent_cols,
      string_agg(
        format('c.%I = p.%I', a_child.attname, a_parent.attname),
        ' AND ' ORDER BY pos.ord
      ) AS join_condition,
      string_agg(
        format('c.%I IS NOT NULL', a_child.attname),
        ' AND ' ORDER BY pos.ord
      ) AS not_null_condition
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class child_tbl ON child_tbl.oid = c.conrelid
    JOIN pg_class parent_tbl ON parent_tbl.oid = c.confrelid
    CROSS JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS pos(child_att, parent_att, ord)
    JOIN pg_attribute a_child ON a_child.attrelid = child_tbl.oid AND a_child.attnum = pos.child_att
    JOIN pg_attribute a_parent ON a_parent.attrelid = parent_tbl.oid AND a_parent.attnum = pos.parent_att
    WHERE n.nspname = 'public' AND c.contype = 'f'
    GROUP BY c.conname, child_tbl.relname, parent_tbl.relname
  LOOP
    fk_checked_count := fk_checked_count + 1;
    query_text := format(
      'SELECT count(*) FROM public.%I c LEFT JOIN public.%I p ON %s WHERE %s AND p.%I IS NULL',
      fk_rec.child_table,
      fk_rec.parent_table,
      fk_rec.join_condition,
      fk_rec.not_null_condition,
      -- check against first parent column
      split_part(fk_rec.parent_cols, ', ', 1)
    );

    EXECUTE query_text INTO orphan_count;

    IF orphan_count > 0 THEN
      total_orphans := total_orphans + orphan_count;
      INSERT INTO temp_fk_violations VALUES (
        fk_rec.constraint_name,
        fk_rec.child_table,
        fk_rec.parent_table,
        fk_rec.child_cols,
        fk_rec.parent_cols,
        orphan_count
      );
    END IF;
  END LOOP;

  INSERT INTO rehearsal_verification_results (check_name, expected, actual, status)
  VALUES (
    'Foreign Key Referential Integrity (' || fk_checked_count || ' FKs checked)',
    '0 orphaned rows',
    total_orphans || ' orphaned rows',
    CASE WHEN total_orphans = 0 THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ------------------------------------------------------------------------------
-- Display Final Verification Table
-- ------------------------------------------------------------------------------
\echo '========================================================================'
\echo '            KEBUN MELON: LOCAL REHEARSAL VERIFICATION REPORT            '
\echo '========================================================================'
SELECT 
  rpad(check_name, 50) AS "Check Name",
  rpad(expected, 18) AS "Expected",
  rpad(actual, 18) AS "Actual",
  status AS "Status"
FROM rehearsal_verification_results;

-- If any check failed, raise exception to exit with non-zero code
DO $$
DECLARE
  failed_count INT;
BEGIN
  SELECT count(*) INTO failed_count FROM rehearsal_verification_results WHERE status = 'FAIL';
  IF failed_count > 0 THEN
    RAISE EXCEPTION 'Rehearsal integrity verification FAILED with % failed checks!', failed_count;
  END IF;
END $$;
