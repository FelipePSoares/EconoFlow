using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTwoFactorAnnouncementNotification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO Notifications
                    (Id, UserId, Type, CodeMessage, Category, IsRead, IsSticky, IsActionRequired, ActionLabelCode, LimitNotificationChannels, Metadata, CreatedDate, ModifiedAt)
                SELECT
                    NEWID(),
                    u.Id,
                    2, -- Information
                    'TwoFactorNowAvailableAnnouncementMessage',
                    3, -- Security
                    0, -- IsRead
                    0, -- IsSticky
                    0, -- IsActionRequired
                    'ButtonConfigureTwoFactor',
                    0, -- None (respects user channels for email/push and keeps in-app row)
                    CONCAT('{""firstName"":""', STRING_ESCAPE(COALESCE(NULLIF(u.FirstName, ''), 'there'), 'json'), '""}'),
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM AspNetUsers u
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM Notifications n
                    WHERE n.UserId = u.Id
                      AND n.CodeMessage = 'TwoFactorNowAvailableAnnouncementMessage'
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM Notifications
                WHERE CodeMessage = 'TwoFactorNowAvailableAnnouncementMessage';
            ");
        }
    }
}
