using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLanguageCodeForUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LanguageCode",
                table: "AspNetUsers",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "en-US");

            // Insert initial LanguageCode for existing users
            migrationBuilder.Sql(@"
                UPDATE AspNetUsers
                SET LanguageCode = 'en-US'
                WHERE LanguageCode IS NULL;
            ");

            // Insert in-app notification to inform users that language selection is available in profile options
            migrationBuilder.Sql(@"
                INSERT INTO Notifications
                    (Id, UserId, Type, CodeMessage, Category, IsRead, IsSticky, IsActionRequired, ActionLabelCode, LimitNotificationChannels, CreatedDate, ModifiedAt)
                SELECT
                    NEWID(),
                    u.Id,
                    2, -- Type: Information
                    'LanguagePreferenceNowAvailableMessage',
                    1, -- Category: System
                    0, -- IsRead
                    0, -- IsSticky
                    0, -- IsActionRequired
                    'ButtonMyProfile',
                    8, -- LimitNotificationChannels: InApp
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM AspNetUsers u
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM Notifications n
                    WHERE n.UserId = u.Id
                      AND n.CodeMessage = 'LanguagePreferenceNowAvailableMessage'
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LanguageCode",
                table: "AspNetUsers");
        }
    }
}
