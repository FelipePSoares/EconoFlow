using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenLookupIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AspNetUserTokens_RefreshTokenLookup'
      AND object_id = OBJECT_ID(N'[dbo].[AspNetUserTokens]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AspNetUserTokens_RefreshTokenLookup]
        ON [dbo].[AspNetUserTokens] ([UserId])
        INCLUDE ([Value])
        WHERE [LoginProvider] = N'REFRESHTOKENPROVIDER'
          AND [Name] = N'RefreshToken';
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AspNetUserTokens_RefreshTokenLookup'
      AND object_id = OBJECT_ID(N'[dbo].[AspNetUserTokens]')
)
BEGIN
    DROP INDEX [IX_AspNetUserTokens_RefreshTokenLookup] ON [dbo].[AspNetUserTokens];
END
");
        }
    }
}
