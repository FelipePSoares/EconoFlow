-- ============================================================================
-- EconoFlow — SQL Server READ-ONLY login for the PostgreSQL migration
-- ============================================================================
--
-- Run ONCE against the shared SQL Server, as a sysadmin (e.g. `sa`), BEFORE the
-- migration rehearsal or the cutover window.
--
--   sqlcmd -S <mssql-host>,1433 -U sa -P '<...>' -C -i sqlserver-readonly-login.sql
--
-- WHY A SEPARATE LOGIN
--
-- The migration tool only ever issues SELECT against the source. It should
-- therefore hold no more privilege than that. Connecting as `sa` would work, and
-- would also mean a bug in the tool could modify the system of record during the
-- cutover — exactly when a mistake is most expensive. This login cannot.
--
-- WHAT IT CREATES
--
--   econoflow_migrator  server login + user in EconoFlowRehearsal (and EconoFlow,
--                       if that database exists on the same instance), mapped to
--                       db_datareader only.
--
-- IMPORTANT — READ THIS BEFORE RUNNING
--
--   1. `CREATE LOGIN ... WITH PASSWORD` respects the server's password policy.
--      If CHECK_POLICY is on and the password is weak, CREATE LOGIN FAILS — and
--      because SQL Server continues to the next batch, the following GRANTs
--      "succeed" against a login that does not exist. You then get
--      "Login failed for user" at cutover time and the script looks like it
--      worked. The verification block at the end exists specifically to catch
--      this: ALWAYS confirm it returns a row.
--
--   2. Change the password before running. Do not commit a real password.
--
--   3. This GRANTS read on the whole database. It does not remove any existing
--      access, and it does not make the database read-only — that is a separate,
--      deliberate act at cutover time.
-- ============================================================================

SET NOCOUNT ON;
GO

-- ---------------------------------------------------------------------------
-- 1. Server-level login.
--
--    CHECK_POLICY = OFF is deliberate for a service account whose password is
--    generated and stored in a secret: the Windows password policy is not
--    meaningful for it, and leaving it ON is the most common cause of the silent
--    failure described above. Set it to ON if your policy requires it, and use a
--    password that satisfies the policy.
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'econoflow_migrator')
BEGIN
    CREATE LOGIN econoflow_migrator
        WITH PASSWORD = N'CHANGE-ME-Before-Running!2026',
             CHECK_POLICY = OFF,
             CHECK_EXPIRATION = OFF,
             DEFAULT_DATABASE = [master];
END
GO

-- ---------------------------------------------------------------------------
-- 2. Database user + read-only membership, in every EconoFlow database on this
--    instance. Written as a loop over sys.databases so the same script works for
--    the rehearsal database and for production without editing.
-- ---------------------------------------------------------------------------
DECLARE @db sysname;
DECLARE @sql nvarchar(max);

DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT name
    FROM sys.databases
    WHERE name IN ('EconoFlow', 'EconoFlowRehearsal')
      AND state_desc = 'ONLINE';

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @db;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Create the user if absent.
    SET @sql = N'
        USE ' + QUOTENAME(@db) + N';
        IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ''econoflow_migrator'')
        BEGIN
            CREATE USER econoflow_migrator FOR LOGIN econoflow_migrator;
        END';
    EXEC sp_executesql @sql;

    -- Read-only membership. db_datareader grants SELECT on every table and view.
    SET @sql = N'
        USE ' + QUOTENAME(@db) + N';
        IF NOT EXISTS (
            SELECT 1
            FROM sys.database_role_members drm
            JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id
            JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
            WHERE r.name = ''db_datareader'' AND m.name = ''econoflow_migrator''
        )
        BEGIN
            ALTER ROLE db_datareader ADD MEMBER econoflow_migrator;
        END';
    EXEC sp_executesql @sql;

    -- Belt and braces: explicitly deny the write path. db_datareader already
    -- excludes it, but a DENY survives someone later adding the user to a
    -- broader role, which is how a read-only account quietly stops being one.
    SET @sql = N'
        USE ' + QUOTENAME(@db) + N';
        DENY INSERT, UPDATE, DELETE ON SCHEMA::dbo TO econoflow_migrator;';
    EXEC sp_executesql @sql;

    FETCH NEXT FROM db_cursor INTO @db;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;
GO

-- ---------------------------------------------------------------------------
-- 3. VERIFICATION — do not skip this.
--
--    Confirm the login EXISTS (the silent-failure guard) and that it is
--    read-only. The first query returning zero rows means CREATE LOGIN failed and
--    every GRANT above was applied to nothing.
-- ---------------------------------------------------------------------------

-- (a) The login exists at server level.
SELECT
    'LOGIN EXISTS' AS check_name,
    name,
    type_desc,
    is_disabled,
    create_date
FROM sys.server_principals
WHERE name = 'econoflow_migrator';

-- (b) Its database memberships, per database.
SELECT
    DB_NAME() AS database_name,
    p.name AS principal,
    r.name AS role_name
FROM sys.database_role_members drm
JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id
JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
CROSS JOIN (SELECT 'econoflow_migrator' AS name) x
JOIN sys.database_principals p ON p.name = x.name
WHERE m.name = 'econoflow_migrator';
GO

PRINT '';
PRINT '============================================================';
PRINT ' If (a) returned NO ROWS, CREATE LOGIN failed silently.';
PRINT ' Check the server password policy and re-run with a';
PRINT ' stronger password, or with CHECK_POLICY = OFF.';
PRINT '============================================================';
PRINT '';
PRINT ' Connection string for the migration tool:';
PRINT '   MIGRATION_SOURCE="Server=<host>,1433;Database=EconoFlow;';
PRINT '     User Id=econoflow_migrator;Password=<...>;';
PRINT '     TrustServerCertificate=true;ApplicationIntent=ReadOnly"';
PRINT '';
PRINT ' ApplicationIntent=ReadOnly is a hint only. The DENY above is what';
PRINT ' actually enforces it.';
PRINT '';
GO
