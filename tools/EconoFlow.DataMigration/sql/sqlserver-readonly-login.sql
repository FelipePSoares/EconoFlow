-- EconoFlow — SQL Server read-only login for the migration.
--
-- Run once on the shared SQL Server, as sa:
--
--   kubectl -n shared-services exec deploy/mssql -- \
--     /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P '<sa-password>' \
--     -i sqlserver-readonly-login.sql
--
-- Change the password below first. Then use:
--
--   Server=mssql.shared-services.svc.cluster.local,1433;Database=EconoFlow;
--   User Id=econoflow_migrator;Password=<same>;TrustServerCertificate=true
--
-- Read-only on purpose: the migration tool only ever SELECTs from the source, so
-- it should not be able to change the system of record.

CREATE LOGIN econoflow_migrator
    WITH PASSWORD = 'CHANGE-ME!2026', CHECK_POLICY = OFF;
GO

USE EconoFlow;
GO

CREATE USER econoflow_migrator FOR LOGIN econoflow_migrator;
ALTER ROLE db_datareader ADD MEMBER econoflow_migrator;
GO

-- Belt and braces: survive someone later adding the user to a broader role.
DENY INSERT, UPDATE, DELETE ON SCHEMA::dbo TO econoflow_migrator;
GO

-- Verify. Both must return a row. If the first is empty, CREATE LOGIN failed
-- (usually the password policy) and everything after it applied to nothing.
SELECT name, type_desc, is_disabled FROM sys.server_principals WHERE name = 'econoflow_migrator';

SELECT member.name AS principal, role.name AS role_name
FROM sys.database_role_members drm
JOIN sys.database_principals role ON role.principal_id = drm.role_principal_id
JOIN sys.database_principals member ON member.principal_id = drm.member_principal_id
WHERE member.name = 'econoflow_migrator';
GO
