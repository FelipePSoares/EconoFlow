using System.Collections.Generic;
using FpsSoftware.DataMigration;
using NpgsqlTypes;

namespace EconoFlow.DataMigration;

/// <summary>
/// EconoFlow's reviewed table/column map for the SQL Server to PostgreSQL copy.
///
/// <para>
/// <b>Provenance.</b> Drafted with
/// <c>dotnet run --project tools/EconoFlow.DataMigration -- --generate-plan</c>
/// against the live SQL Server catalog (24 tables, 193 columns), then reviewed by
/// hand and validated with <c>--check-schema</c>, which must pass before any copy.
/// </para>
///
/// <para><b>The generator prints five things it cannot know. Each is resolved:</b></para>
/// <list type="number">
///   <item>
///     <b>Table order.</b> The draft was alphabetical; this list is in foreign-key
///     dependency order, parents before children. PostgreSQL enforces foreign keys
///     immediately, so an alphabetical copy fails on the first child row.
///   </item>
///   <item>
///     <b>Key columns.</b> Tables with an <c>Id</c> use <c>["Id"]</c>. Three tables
///     have no <c>Id</c> and state their key explicitly (below). The generator emitted
///     a NOTE for each, because a table with no declarable key makes the verification
///     digest order-dependent and therefore meaningless.
///   </item>
///   <item>
///     <b>Timestamps.</b> All 38 <c>datetime2</c>/<c>datetimeoffset</c> columns map to
///     <c>TimestampTz</c>. The engine normalises to UTC on write, which is what a
///     <c>timestamptz</c> column stores. <c>AspNetUsers.LockoutEnd</c> is the only
///     <c>datetimeoffset</c> column, and it maps the same way.
///   </item>
///   <item>
///     <b>Unmapped types.</b> None. All nine distinct source types are mapped.
///   </item>
///   <item>
///     <b>Excluded tables.</b> Two, both deliberate - see the EXCLUDED block below.
///   </item>
/// </list>
///
/// <para>
/// <b>Naming.</b> The source side keeps its <c>dbo.</c> prefix, because that is the
/// SQL Server schema. The target side is the bare table name: the PostgreSQL schema is
/// <c>public</c> and has no <c>dbo</c>, so emitting <c>dbo.</c> on both sides (as the
/// generator does) would fail to find the target tables.
/// </para>
///
/// <para>
/// <b>Sizes.</b> Longest source value determines nothing here - the engine streams -
/// but the largest tables for sizing the cutover window are <c>ExpenseItems</c> (2,469
/// rows in rehearsal), <c>Expenses</c> (1,495) and <c>Notifications</c> (441).
/// </para>
/// </summary>
internal static class MigrationPlan
{
    /// <summary>
    /// Tables to copy, in foreign-key dependency order.
    /// </summary>
    public static IReadOnlyList<TablePlan> Tables { get; } =
    [
        new("dbo.AspNetRoles", "AspNetRoles",
        [
            new("ConcurrencyStamp", "ConcurrencyStamp", NpgsqlDbType.Text),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("Name", "Name", NpgsqlDbType.Text),
            new("NormalizedName", "NormalizedName", NpgsqlDbType.Text),
        ], ["Id"]),
        new("dbo.Projects", "Projects",
        [
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IsArchived", "IsArchived", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
            new("PreferredCurrency", "PreferredCurrency", NpgsqlDbType.Text),
            new("TaxYearLabeling", "TaxYearLabeling", NpgsqlDbType.Integer),
            new("TaxYearStartDay", "TaxYearStartDay", NpgsqlDbType.Integer),
            new("TaxYearStartMonth", "TaxYearStartMonth", NpgsqlDbType.Integer),
            new("TaxYearType", "TaxYearType", NpgsqlDbType.Integer),
        ], ["Id"]),
        new("dbo.AspNetUsers", "AspNetUsers",
        [
            new("AccessFailedCount", "AccessFailedCount", NpgsqlDbType.Integer),
            new("ConcurrencyStamp", "ConcurrencyStamp", NpgsqlDbType.Text),
            new("DefaultProjectId", "DefaultProjectId", NpgsqlDbType.Uuid),
            new("Email", "Email", NpgsqlDbType.Text),
            new("EmailConfirmed", "EmailConfirmed", NpgsqlDbType.Boolean),
            new("Enabled", "Enabled", NpgsqlDbType.Boolean),
            new("FirstName", "FirstName", NpgsqlDbType.Text),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("LanguageCode", "LanguageCode", NpgsqlDbType.Text),
            new("LastName", "LastName", NpgsqlDbType.Text),
            new("LockoutEnabled", "LockoutEnabled", NpgsqlDbType.Boolean),
            new("LockoutEnd", "LockoutEnd", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("NormalizedEmail", "NormalizedEmail", NpgsqlDbType.Text),
            new("NormalizedUserName", "NormalizedUserName", NpgsqlDbType.Text),
            new("NotificationChannels", "NotificationChannels", NpgsqlDbType.Integer),
            new("PasswordHash", "PasswordHash", NpgsqlDbType.Text),
            new("PhoneNumber", "PhoneNumber", NpgsqlDbType.Text),
            new("PhoneNumberConfirmed", "PhoneNumberConfirmed", NpgsqlDbType.Boolean),
            new("SecurityStamp", "SecurityStamp", NpgsqlDbType.Text),
            new("TwoFactorEnabled", "TwoFactorEnabled", NpgsqlDbType.Boolean),
            new("UserName", "UserName", NpgsqlDbType.Text),
        ], ["Id"]),
        new("dbo.AspNetRoleClaims", "AspNetRoleClaims",
        [
            new("ClaimType", "ClaimType", NpgsqlDbType.Text),
            new("ClaimValue", "ClaimValue", NpgsqlDbType.Text),
            new("Id", "Id", NpgsqlDbType.Integer),
            new("RoleId", "RoleId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.AspNetUserClaims", "AspNetUserClaims",
        [
            new("ClaimType", "ClaimType", NpgsqlDbType.Text),
            new("ClaimValue", "ClaimValue", NpgsqlDbType.Text),
            new("Id", "Id", NpgsqlDbType.Integer),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.AspNetUserLogins", "AspNetUserLogins",
        [
            new("LoginProvider", "LoginProvider", NpgsqlDbType.Text),
            new("ProviderDisplayName", "ProviderDisplayName", NpgsqlDbType.Text),
            new("ProviderKey", "ProviderKey", NpgsqlDbType.Text),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
        ], ["LoginProvider", "ProviderKey"]),
        new("dbo.AspNetUserRoles", "AspNetUserRoles",
        [
            new("RoleId", "RoleId", NpgsqlDbType.Uuid),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
        ], ["UserId", "RoleId"]),
        new("dbo.AspNetUserTokens", "AspNetUserTokens",
        [
            new("LoginProvider", "LoginProvider", NpgsqlDbType.Text),
            new("Name", "Name", NpgsqlDbType.Text),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
            new("Value", "Value", NpgsqlDbType.Text),
        ], ["UserId", "LoginProvider", "Name"]),
        new("dbo.Categories", "Categories",
        [
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("DisplayOrder", "DisplayOrder", NpgsqlDbType.Integer),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IsArchived", "IsArchived", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
            new("ProjectId", "ProjectId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.DeductibleGroups", "DeductibleGroups",
        [
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
            new("ProjectId", "ProjectId", NpgsqlDbType.Uuid),
            new("TaxYearId", "TaxYearId", NpgsqlDbType.Text),
        ], ["Id"]),
        new("dbo.Plans", "Plans",
        [
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("CurrentBalance", "CurrentBalance", NpgsqlDbType.Numeric),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IsArchived", "IsArchived", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
            new("ProjectId", "ProjectId", NpgsqlDbType.Uuid),
            new("TargetAmount", "TargetAmount", NpgsqlDbType.Numeric),
            new("Type", "Type", NpgsqlDbType.Integer),
        ], ["Id"]),
        new("dbo.UserProjects", "UserProjects",
        [
            new("Accepted", "Accepted", NpgsqlDbType.Boolean),
            new("AcceptedAt", "AcceptedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Email", "Email", NpgsqlDbType.Text),
            new("ExpiryDate", "ExpiryDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("InvitationEmailSent", "InvitationEmailSent", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("ProjectId", "ProjectId", NpgsqlDbType.Uuid),
            new("Role", "Role", NpgsqlDbType.Integer),
            new("SentAt", "SentAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Token", "Token", NpgsqlDbType.Uuid),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.ExpoPushTokens", "ExpoPushTokens",
        [
            new("CreatedAt", "CreatedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("DeviceName", "DeviceName", NpgsqlDbType.Text),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("RevokedAt", "RevokedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Token", "Token", NpgsqlDbType.Text),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.WebPushSubscriptions", "WebPushSubscriptions",
        [
            new("Auth", "Auth", NpgsqlDbType.Text),
            new("CreatedAt", "CreatedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("DeviceType", "DeviceType", NpgsqlDbType.Integer),
            new("Endpoint", "Endpoint", NpgsqlDbType.Text),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("LastUsedAt", "LastUsedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("P256dh", "P256dh", NpgsqlDbType.Text),
            new("RevokedAt", "RevokedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("UserAgent", "UserAgent", NpgsqlDbType.Text),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.Expenses", "Expenses",
        [
            new("Amount", "Amount", NpgsqlDbType.Numeric),
            new("Budget", "Budget", NpgsqlDbType.Integer),
            new("CategoryId", "CategoryId", NpgsqlDbType.Uuid),
            new("CreatedById", "CreatedById", NpgsqlDbType.Uuid),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("CreatorName", "CreatorName", NpgsqlDbType.Text),
            new("Date", "Date", NpgsqlDbType.Date),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IsDeductible", "IsDeductible", NpgsqlDbType.Boolean),
            new("IsDeleted", "IsDeleted", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
        ], ["Id"]),
        new("dbo.Incomes", "Incomes",
        [
            new("Amount", "Amount", NpgsqlDbType.Numeric),
            new("CreatedById", "CreatedById", NpgsqlDbType.Uuid),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("CreatorName", "CreatorName", NpgsqlDbType.Text),
            new("Date", "Date", NpgsqlDbType.Date),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IsDeleted", "IsDeleted", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
            new("ProjectId", "ProjectId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.PlanEntries", "PlanEntries",
        [
            new("AmountSigned", "AmountSigned", NpgsqlDbType.Numeric),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Date", "Date", NpgsqlDbType.Date),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Note", "Note", NpgsqlDbType.Text),
            new("PlanId", "PlanId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.ExpenseItems", "ExpenseItems",
        [
            new("Amount", "Amount", NpgsqlDbType.Numeric),
            new("CreatedById", "CreatedById", NpgsqlDbType.Uuid),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("CreatorName", "CreatorName", NpgsqlDbType.Text),
            new("Date", "Date", NpgsqlDbType.Date),
            new("ExpenseId", "ExpenseId", NpgsqlDbType.Uuid),
            new("ExpenseItemId", "ExpenseItemId", NpgsqlDbType.Uuid),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IsDeductible", "IsDeductible", NpgsqlDbType.Boolean),
            new("IsDeleted", "IsDeleted", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
        ], ["Id"]),
        new("dbo.Attachments", "Attachments",
        [
            new("AttachmentType", "AttachmentType", NpgsqlDbType.Integer),
            new("ContentType", "ContentType", NpgsqlDbType.Text),
            new("CreatedById", "CreatedById", NpgsqlDbType.Uuid),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("ExpenseId", "ExpenseId", NpgsqlDbType.Uuid),
            new("ExpenseItemId", "ExpenseItemId", NpgsqlDbType.Uuid),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IncomeId", "IncomeId", NpgsqlDbType.Uuid),
            new("IsTemporary", "IsTemporary", NpgsqlDbType.Boolean),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
            new("Size", "Size", NpgsqlDbType.Bigint),
            new("StorageKey", "StorageKey", NpgsqlDbType.Text),
        ], ["Id"]),
        new("dbo.DeductibleGroupExpenses", "DeductibleGroupExpenses",
        [
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("ExpenseId", "ExpenseId", NpgsqlDbType.Uuid),
            new("ExpenseItemId", "ExpenseItemId", NpgsqlDbType.Uuid),
            new("GroupId", "GroupId", NpgsqlDbType.Uuid),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
        ], ["Id"]),
        new("dbo.Notifications", "Notifications",
        [
            new("ActionLabelCode", "ActionLabelCode", NpgsqlDbType.Text),
            new("Category", "Category", NpgsqlDbType.Integer),
            new("CodeMessage", "CodeMessage", NpgsqlDbType.Text),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("EmailLockedUntil", "EmailLockedUntil", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("EmailStatus", "EmailStatus", NpgsqlDbType.Integer),
            new("ExpiresAt", "ExpiresAt", NpgsqlDbType.Date),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("IsActionRequired", "IsActionRequired", NpgsqlDbType.Boolean),
            new("IsRead", "IsRead", NpgsqlDbType.Boolean),
            new("IsSticky", "IsSticky", NpgsqlDbType.Boolean),
            new("LimitNotificationChannels", "LimitNotificationChannels", NpgsqlDbType.Integer),
            new("Metadata", "Metadata", NpgsqlDbType.Text),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Type", "Type", NpgsqlDbType.Integer),
            new("UserId", "UserId", NpgsqlDbType.Uuid),
        ], ["Id"]),
        new("dbo.ContactUs", "ContactUs",
        [
            new("CreatedById", "CreatedById", NpgsqlDbType.Uuid),
            new("CreatedDate", "CreatedDate", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Email", "Email", NpgsqlDbType.Text),
            new("Id", "Id", NpgsqlDbType.Uuid),
            new("Message", "Message", NpgsqlDbType.Text),
            new("ModifiedAt", "ModifiedAt", NpgsqlDbType.TimestampTz, UtcTimestamp),
            new("Name", "Name", NpgsqlDbType.Text),
            new("Subject", "Subject", NpgsqlDbType.Text),
        ], ["Id"]),

        // EXCLUDED TABLES
        //
        // dbo.__EFMigrationsHistory - EF Core bookkeeping, not application data. The
        //   PostgreSQL history table is created when --migrate applies the baseline.
        //   Copying the SQL Server rows would assert that the PostgreSQL migrations
        //   are already applied when they are not, and EF would then skip creating
        //   the application schema entirely.
        //
        // dbo.DataProtectionKeys - key material, not application data, and
        //   deployment-specific: it may be DPAPI-encrypted (EconoFlow_KEY_ENCRYPT_ACTIVE),
        //   in which case a new host cannot unprotect it anyway. The application
        //   generates its own keys on first run. Excluding it also removes the third
        //   integer identity column, so there is no sequence to collide with.
    ];

    /// <summary>
    /// Integer identity columns needing a sequence resync after the copy, as
    /// <c>table to column</c>.
    ///
    /// <para>
    /// A binary COPY inserts explicit values and never advances the backing sequence,
    /// so without this the application's next INSERT collides with an existing primary
    /// key. Verified against the live catalog: these two are the only integer identity
    /// columns among the copied tables. Every other key is a UUID, which has no
    /// sequence and needs no entry.
    /// </para>
    ///
    /// <para>
    /// <c>DataProtectionKeys</c> also has an identity column, but the table is excluded
    /// from the copy, so it needs no resync.
    /// </para>
    /// </summary>
    public static IReadOnlyDictionary<string, string> SequencesToResync { get; } = new Dictionary<string, string>
    {
        ["AspNetRoleClaims"] = "Id",
        ["AspNetUserClaims"] = "Id"
    };

    /// <summary>
    /// Normalises a legacy timestamp to <see cref="DateTimeKind.Utc"/> on the way
    /// across.
    ///
    /// <para>
    /// <b>This is required, and it is the first thing that fails without it.</b>
    /// Npgsql 6+ maps <c>DateTime</c> to <c>timestamp with time zone</c>, which accepts
    /// <b>only</b> <c>Kind=Utc</c>. SQL Server's <c>datetime2</c> carries no offset, so
    /// <c>Microsoft.Data.SqlClient</c> materialises those values as
    /// <c>Kind=Unspecified</c> and the copy dies with:
    /// </para>
    ///
    /// <code>
    /// ArgumentException: Cannot write DateTime with Kind=Unspecified to PostgreSQL
    /// type 'timestamp with time zone', only UTC is supported.
    /// </code>
    ///
    /// <para>
    /// Reproduced on the rehearsal: the copy failed on the fourth table
    /// (<c>Projects</c>) with exactly that message.
    /// </para>
    ///
    /// <para>
    /// <b>Why <c>SpecifyKind</c> and never <c>ToUniversalTime</c>:</b> these values are
    /// already UTC � the application wrote them through <c>SystemClock</c>, which
    /// returns <c>kind=Utc</c> � but the Kind was lost in transit through SQL Server's
    /// offset-less type. <c>SpecifyKind</c> relabels the value without touching it,
    /// which is correct. <c>ToUniversalTime</c> would <i>shift</i> the value by the
    /// host's offset, silently changing every timestamp in the database. That is the
    /// distinction <c>DATETIME_KIND_TRAP.md</c> �4 draws between a loud failure and
    /// quiet data corruption.
    /// </para>
    ///
    /// <para>
    /// <c>DateTimeOffset</c> (only <c>AspNetUsers.LockoutEnd</c>) is converted via
    /// <c>UtcDateTime</c> rather than relabelled, because it carries a real offset
    /// that must be respected.
    /// </para>
    /// </summary>
    private static object? UtcTimestamp(object? value) => value switch
    {
        null => null,
        DateTime dateTime => DateTime.SpecifyKind(dateTime, DateTimeKind.Utc),
        DateTimeOffset offset => offset.UtcDateTime,
        _ => value
    };
}
