-- Run once per environment, as the database OWNER, before the first migration.
-- `pnpm db:roles` applies this.
--
-- The application connects as builderhut_app, which is NOBYPASSRLS. That single
-- property is what makes row-level security a real boundary rather than a
-- decoration: the owner role bypasses every policy, so an app running as owner
-- would pass all the same tests while protecting nothing.
--
-- The consequence to remember when debugging: a query that forgets to set
-- app.tenant_id does not error. It returns ZERO ROWS. An empty dashboard is the
-- symptom of a missing tenant context far more often than of missing data.

-- :APP_PASSWORD: is substituted at apply time from BUILDERHUT_APP_PASSWORD, so
-- no credential is ever committed. Neon's control plane rejects weak passwords
-- outright, which is why this cannot be created with a placeholder and altered
-- afterwards.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builderhut_app') THEN
    CREATE ROLE builderhut_app LOGIN NOBYPASSRLS PASSWORD ':APP_PASSWORD:';
  ELSE
    ALTER ROLE builderhut_app WITH LOGIN NOBYPASSRLS PASSWORD ':APP_PASSWORD:';
  END IF;
END
$$;

-- DML only. No CREATE, no DROP, no schema ownership.
GRANT CONNECT ON DATABASE neondb TO builderhut_app;
GRANT USAGE ON SCHEMA public TO builderhut_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO builderhut_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO builderhut_app;

-- Tables created by future migrations are covered automatically. Without this,
-- every new table silently becomes invisible to the application.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO builderhut_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO builderhut_app;
