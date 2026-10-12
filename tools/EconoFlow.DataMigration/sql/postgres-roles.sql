-- ============================================================================
-- EconoFlow — PostgreSQL roles for the SQL Server -> PostgreSQL migration
-- ============================================================================
--
-- Run this ONCE against the EconoFlow database on the target PostgreSQL server,
-- as a superuser (or a role with CREATEROLE + the ability to grant on the DB).
--
--   psql "host=<pg-host> port=5432 dbname=econoflow user=<admin>" \
--        -v dbname=econoflow -f postgres-roles.sql
--
-- The `-v dbname=` argument matters when the database is not literally named
-- `econoflow` — for example the rehearsal database `econoflow_rehearsal`. It
-- defaults to `econoflow`, so the production command above works as written.
--
-- WHAT THIS CREATES
--
--   econoflow_owner     owns the schema and holds the application's rights.
--                       The APPLICATION connects as this role (via EasyFinanceDB).
--
--   econoflow_migrator  the role the data-migration tool connects as for its
--                       TARGET connection. Its rights were determined by running
--                       the tool against a real PostgreSQL and granting only what
--                       it actually needed, one refusal at a time:
--
--                         SELECT    read the target to compute verification digests
--                         INSERT    binary COPY FROM into each table
--                         TRUNCATE  the copy is truncate-and-reload (idempotent)
--                         UPDATE    ONLY on MigrationState, the completion marker
--                         CREATE    on the schema, to create that marker table
--
--                       It is deliberately NOT granted UPDATE or DELETE on any
--                       application table. A copy that can rewrite its own target
--                       can mask a bad copy and still report success.
--
--   econoflow_reader    read-only, for reporting/inspection. Optional.
--
-- WHY THE MIGRATOR IS SEPARATE FROM THE OWNER
--
-- The tool verifies by re-reading the target and comparing per-table digests. If it
-- connected as the owner it could also rewrite rows, so a bug in the copy could be
-- hidden by the same connection that wrote it. Keeping INSERT (needed) and UPDATE
-- (not needed) apart is what makes "the copy is faithfully verified" a meaningful
-- claim rather than a tautology.
--
-- WHAT THIS SCRIPT DOES NOT DO
--
--   * It does not create the database. Create it first:
--       CREATE DATABASE econoflow WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'
--         TEMPLATE template0;
--     (`C` collation is deliberate: it makes ordering deterministic and independent
--      of the server's locale, so a digest computed on one host matches another.)
--
--   * It does not set passwords, so none can be committed. See the end of the file.
-- ============================================================================

\set ON_ERROR_STOP on

-- Default the target database name so the script is a no-op without -v dbname=.
\if :{?dbname}
\else
    \set dbname econoflow
\endif

\echo 'Configuring roles for database:' :dbname

-- ---------------------------------------------------------------------------
-- 0. Extensions. Must exist before the EF migrations run, because the schema
--    declares them: DeductibleGroups.Name is citext.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- 1. Roles. Idempotent, so this file is safe to re-run.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'econoflow_owner') THEN
        CREATE ROLE econoflow_owner LOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'econoflow_migrator') THEN
        CREATE ROLE econoflow_migrator LOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'econoflow_reader') THEN
        CREATE ROLE econoflow_reader LOGIN;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Connect rights.
-- ---------------------------------------------------------------------------
GRANT CONNECT ON DATABASE :"dbname" TO econoflow_owner;
GRANT CONNECT ON DATABASE :"dbname" TO econoflow_migrator;
GRANT CONNECT ON DATABASE :"dbname" TO econoflow_reader;

-- ---------------------------------------------------------------------------
-- 3. The owner owns the schema and everything created in it.
-- ---------------------------------------------------------------------------
GRANT USAGE, CREATE ON SCHEMA public TO econoflow_owner;

ALTER DEFAULT PRIVILEGES FOR ROLE econoflow_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO econoflow_owner;

ALTER DEFAULT PRIVILEGES FOR ROLE econoflow_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO econoflow_owner;

-- ---------------------------------------------------------------------------
-- 4. The migrator — the least privilege the tool actually needs.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO econoflow_migrator;
GRANT USAGE ON SCHEMA public TO econoflow_reader;

-- CREATE is needed only to create the MigrationState completion-marker table.
-- It is the broadest right this role holds, and it is why the migrator should be
-- used only during a cutover window, not left connected day to day.
GRANT CREATE ON SCHEMA public TO econoflow_migrator;

-- SELECT to verify, INSERT for COPY, TRUNCATE to make the copy idempotent.
GRANT SELECT, INSERT, TRUNCATE ON ALL TABLES IN SCHEMA public TO econoflow_migrator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO econoflow_reader;

-- Sequences: COPY inserts explicit values and never advances them, so the tool
-- resets each identity sequence afterwards or the app's next INSERT collides.
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO econoflow_migrator;

-- Applies to tables the owner creates later (i.e. after this script runs).
ALTER DEFAULT PRIVILEGES FOR ROLE econoflow_owner IN SCHEMA public
    GRANT SELECT, INSERT, TRUNCATE ON TABLES TO econoflow_migrator;

ALTER DEFAULT PRIVILEGES FOR ROLE econoflow_owner IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO econoflow_migrator;

ALTER DEFAULT PRIVILEGES FOR ROLE econoflow_owner IN SCHEMA public
    GRANT SELECT ON TABLES TO econoflow_reader;

-- ---------------------------------------------------------------------------
-- 5. The completion marker.
--
--    The tool creates this table itself (hence CREATE above) and reads/writes one
--    row per verified migration, so `--auto` can skip a re-run. If it already
--    exists, grant on it now; if it does not, the ALTER DEFAULT PRIVILEGES above
--    will not cover it either, because the tool creates it — so it is granted
--    explicitly when present, and the block is a no-op on a first run.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'MigrationState'
    ) THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public."MigrationState" TO econoflow_migrator';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 6. Remove the rights the migrator must never hold.
--
--    Grants are additive, so if the role is ever added to a broader group these
--    REVOKEs are what stop it becoming a writer. PostgreSQL table privileges are
--    per-table, so this is expressed as a loop.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        -- Never allow the migrator to rewrite or delete application data.
        -- MigrationState is excluded because the tool legitimately updates it.
        IF obj.tablename <> 'MigrationState' THEN
            EXECUTE format(
                'REVOKE UPDATE, DELETE ON public.%I FROM econoflow_migrator',
                obj.tablename);
        END IF;
    END LOOP;
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 7. Ownership handover.
--    If the schema was created by an admin (how the tool applies the EF
--    migrations when run as a superuser), reassign it so the application owns its
--    own objects and the defaults above keep applying.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO econoflow_owner', obj.tablename);
    END LOOP;

    FOR obj IN
        SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO econoflow_owner', obj.sequence_name);
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 8. VERIFICATION — these must match, or the roles are wrong.
-- ---------------------------------------------------------------------------
\echo ''
\echo '--- migrator: may copy, must not rewrite. Expect INSERT=t UPDATE=f DELETE=f TRUNCATE=t ---'
SELECT
    has_table_privilege('econoflow_migrator', 'public."Expenses"', 'SELECT')   AS "SELECT",
    has_table_privilege('econoflow_migrator', 'public."Expenses"', 'INSERT')   AS "INSERT",
    has_table_privilege('econoflow_migrator', 'public."Expenses"', 'UPDATE')   AS "UPDATE",
    has_table_privilege('econoflow_migrator', 'public."Expenses"', 'DELETE')   AS "DELETE",
    has_table_privilege('econoflow_migrator', 'public."Expenses"', 'TRUNCATE') AS "TRUNCATE";

\echo '--- owner: full rights. Expect SELECT=t INSERT=t UPDATE=t DELETE=t ---'
SELECT
    has_table_privilege('econoflow_owner', 'public."Expenses"', 'SELECT') AS "SELECT",
    has_table_privilege('econoflow_owner', 'public."Expenses"', 'INSERT') AS "INSERT",
    has_table_privilege('econoflow_owner', 'public."Expenses"', 'UPDATE') AS "UPDATE",
    has_table_privilege('econoflow_owner', 'public."Expenses"', 'DELETE') AS "DELETE";

\echo '--- reader: SELECT only. Expect SELECT=t INSERT=f UPDATE=f DELETE=f ---'
SELECT
    has_table_privilege('econoflow_reader', 'public."Expenses"', 'SELECT') AS "SELECT",
    has_table_privilege('econoflow_reader', 'public."Expenses"', 'INSERT') AS "INSERT",
    has_table_privilege('econoflow_reader', 'public."Expenses"', 'UPDATE') AS "UPDATE",
    has_table_privilege('econoflow_reader', 'public."Expenses"', 'DELETE') AS "DELETE";

\echo '--- citext installed? Expect 1 row ---'
SELECT extname FROM pg_extension WHERE extname = 'citext';

-- ---------------------------------------------------------------------------
-- 9. Passwords.
--
--    A role created here has NO password. Set them interactively so they never
--    reach shell history, this file, or git:
--
--      \password econoflow_owner
--      \password econoflow_migrator
--      \password econoflow_reader
--
--    The application's connection string (EasyFinanceDB):
--
--      Host=<pg-host>;Port=5432;Database=econoflow;Username=econoflow_owner;
--      Password=<...>;SSL Mode=Require;Trust Server Certificate=false
--
--    The migration tool's TARGET connection (MIGRATION_TARGET), least privilege:
--
--      Host=<pg-host>;Port=5432;Database=econoflow;Username=econoflow_migrator;
--      Password=<...>;SSL Mode=Require
--
--    SSL Mode=Require matters whenever PostgreSQL is reached across the network
--    rather than over a unix socket.
--
--    AFTER THE CUTOVER: revoke the migrator's CREATE and TRUNCATE. They exist
--    only for the copy, and leaving them granted means a routine restart of the
--    tool could truncate live data:
--
--      REVOKE CREATE ON SCHEMA public FROM econoflow_migrator;
--      REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM econoflow_migrator;
-- ---------------------------------------------------------------------------
