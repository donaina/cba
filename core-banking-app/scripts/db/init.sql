-- PostgreSQL initialisation script
-- Runs once when the Postgres container starts for the first time.

-- Ensure the application database exists (Docker image creates it from POSTGRES_DB,
-- but this file is safe to re-run).
SELECT 'CREATE DATABASE cba'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'cba'
)\gexec

-- Extensions
\c cba
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Application role (used by the NestJS service)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cba_app') THEN
    CREATE ROLE cba_app WITH LOGIN PASSWORD 'changeme_in_prod';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE cba TO cba_app;
GRANT USAGE ON SCHEMA public TO cba_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cba_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO cba_app;
