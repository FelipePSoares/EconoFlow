using EasyFinance.Domain.AccessControl;
using EasyFinance.Persistence.Mapping.AccessControl;
using EasyFinance.Persistence.Mapping.Account;
using EasyFinance.Persistence.Mapping.Financial;
using EasyFinance.Persistence.Mapping.FinancialProject;
using EasyFinance.Persistence.Mapping.Support;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Persistence.DatabaseContext
{
    public class EasyFinanceDatabaseContext(DbContextOptions<EasyFinanceDatabaseContext> options) :
        IdentityDbContext<User, IdentityRole<Guid>, Guid>(options)
    {
        /// <summary>
        /// A column that must compare case-insensitively for equality, which SQL
        /// Server's default <c>_CI_AS</c> collation provided implicitly and
        /// PostgreSQL's <c>text</c> does not.
        /// </summary>
        /// <param name="Entity">The mapped entity type.</param>
        /// <param name="Property">The property on that type.</param>
        public readonly record struct CaseInsensitiveColumn(Type Entity, string Property);

        /// <summary>
        /// The columns mapped to <c>citext</c> on PostgreSQL.
        ///
        /// <para>
        /// <c>DeductibleGroup.Name</c> is the only one: it is user-supplied, it sits in
        /// a unique index <c>(ProjectId, TaxYearId, Name)</c>, and
        /// <c>TaxYearService.CreateDeductibleGroupAsync</c> looks a group up by name to
        /// make create idempotent. On PostgreSQL without <c>citext</c> that lookup stops
        /// matching and the index stops rejecting, so the user silently gets a duplicate
        /// group differing only in letter case.
        /// </para>
        ///
        /// <para>
        /// This list is what <see cref="ApplyProviderSpecificConfiguration"/> reads, so
        /// adding an entry here is the whole change — it cannot drift from the
        /// configuration the way a documentation-only list would. The entity and property
        /// are resolved by EF itself, so a wrong name fails at model-build time rather
        /// than silently configuring nothing.
        /// </para>
        ///
        /// <para>
        /// Do NOT extend this list casually. <c>citext</c> cannot be combined with
        /// <c>pg_trgm</c> operator classes, so a <c>citext</c> column loses its trigram
        /// search path — the correct choice is per column, not global.
        /// </para>
        /// </summary>
        public static readonly IReadOnlyList<CaseInsensitiveColumn> CaseInsensitiveTextColumns =
        [
            new(typeof(Domain.FinancialProject.DeductibleGroup), nameof(Domain.FinancialProject.DeductibleGroup.Name))
        ];

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Account
            modelBuilder.ApplyConfiguration(new NotificationConfiguration());
            modelBuilder.ApplyConfiguration(new WebPushSubscriptionConfiguration());
            modelBuilder.ApplyConfiguration(new ExpoPushTokenConfiguration());

            // Access Control
            modelBuilder.ApplyConfiguration(new UserConfiguration());
            modelBuilder.ApplyConfiguration(new UserProjectConfiguration());

            // Financial
            modelBuilder.ApplyConfiguration(new AttachmentConfiguration());
            modelBuilder.ApplyConfiguration(new IncomeConfiguration());
            modelBuilder.ApplyConfiguration(new ExpenseConfiguration());
            modelBuilder.ApplyConfiguration(new ExpenseItemConfiguration());
            modelBuilder.ApplyConfiguration(new CategoryConfiguration());

            // FinancialProject
            modelBuilder.ApplyConfiguration(new ProjectConfiguration());
            modelBuilder.ApplyConfiguration(new DeductibleGroupConfiguration());
            modelBuilder.ApplyConfiguration(new DeductibleGroupExpenseConfiguration());
            modelBuilder.ApplyConfiguration(new PlanConfiguration());
            modelBuilder.ApplyConfiguration(new PlanEntryConfiguration());

            //Support
            modelBuilder.ApplyConfiguration(new ContactUsConfiguration());

            base.OnModelCreating(modelBuilder);

            ApplyProviderSpecificConfiguration(modelBuilder);
        }

        /// <summary>
        /// Applies configuration that is only valid on one provider. Kept in one place
        /// so a provider difference is visible rather than scattered through the
        /// per-entity configurations, which are shared by every provider.
        /// </summary>
        private void ApplyProviderSpecificConfiguration(ModelBuilder modelBuilder)
        {
            if (!Database.IsNpgsql())
                return;

            // `citext` is a PostgreSQL extension. Declaring it here — rather than only
            // in an init script — means a fresh database is creatable by EF migrations
            // alone (MIGRATION_TEMPLATE.md §3). EF infers the extension from the column
            // type below, but declaring it explicitly makes the intent readable and the
            // generated migration self-contained.
            modelBuilder.HasPostgresExtension("citext");

            foreach (var column in CaseInsensitiveTextColumns)
            {
                modelBuilder.Entity(column.Entity)
                    .Property(column.Property)
                    .HasColumnType("citext");
            }
        }
    }
}
