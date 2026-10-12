using System;
using System.Threading.Tasks;
using FpsSoftware.DataMigration;

namespace EconoFlow.DataMigration;

/// <summary>
/// EconoFlow's data-migration host.
///
/// <para>
/// Ten lines, by design: the engine is the shared <c>fpssoftware.datamigration</c>
/// package, and everything project-specific lives on
/// <see cref="EconoFlowMigrationProfile"/> and <see cref="MigrationPlan"/>.
/// </para>
///
/// <para>
/// Usage (rehearsal — note the PostgreSQL port <b>5433</b>, never 5432):
/// </para>
/// <code>
/// $env:MIGRATION_SOURCE = "Server=localhost,14330;Database=EconoFlowRehearsal;User Id=sa;Password=...;TrustServerCertificate=true"
/// $env:MIGRATION_TARGET = "Host=localhost;Port=5433;Database=econoflow_rehearsal;Username=postgres;Password=..."
/// dotnet run --project tools/EconoFlow.DataMigration -- --generate-plan
/// dotnet run --project tools/EconoFlow.DataMigration -- --check-schema
/// dotnet run --project tools/EconoFlow.DataMigration -- --migrate --truncate
/// </code>
/// </summary>
internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        // Must be the first statement: the engine reads MigrationProfile.Current, and
        // Use() deliberately throws if it is never called or called twice. A tool run
        // as a cutover command must not silently fall back to defaults.
        MigrationProfile.Use(new EconoFlowMigrationProfile());

        return await MigrationHost.RunAsync(args);
    }
}
