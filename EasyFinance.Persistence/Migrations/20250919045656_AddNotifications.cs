using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    CodeMessage = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<int>(type: "int", nullable: false),
                    IsRead = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsSent = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsSticky = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsActionRequired = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    LimitNotificationChannels = table.Column<int>(type: "int", nullable: false),
                    ExpiresAt = table.Column<DateOnly>(type: "date", nullable: true),
                    ActionLabelCode = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Metadata = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications",
                column: "UserId");

            // 🔥 Insert initial confirm-email notification for users without confirmed email
            migrationBuilder.Sql(@"
                INSERT INTO Notifications
                    (Id, UserId, Type, CodeMessage, Category, IsRead, IsSent, IsSticky, IsActionRequired, ActionLabelCode, CreatedDate, ModifiedAt)
                SELECT
                    NEWID(),
                    u.Id,
                    1, -- Type
                    'ConfirmEmailMessage',
                    3, -- Category
                    0, -- IsRead
                    1, -- IsSent
                    1, -- IsSticky
                    1, -- IsActionRequired
                    'ButtonConfirmEmail',
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM AspNetUsers u
                WHERE u.EmailConfirmed = 0
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");
        }
    }
}
