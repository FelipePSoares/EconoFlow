using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOverviewAnnouncementNotification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO Notifications
                    (Id, UserId, Type, CodeMessage, Category, IsRead, IsSticky, IsActionRequired, ActionLabelCode, LimitNotificationChannels, CreatedDate, ModifiedAt)
                SELECT
                    NEWID(),
                    u.Id,
                    2, -- Information
                    'MonthlyAndAnnualOverviewNowAvailableMessage',
                    1, -- System
                    0, -- IsRead
                    0, -- IsSticky
                    0, -- IsActionRequired
                    null,
                    0, -- None (respects user channels for email/push and keeps in-app row)
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM AspNetUsers u
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM Notifications n
                    WHERE n.UserId = u.Id
                      AND n.CodeMessage = 'MonthlyAndAnnualOverviewNowAvailableMessage'
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM Notifications
                WHERE CodeMessage = 'MonthlyAndAnnualOverviewNowAvailableMessage';
            ");
        }
    }
}
