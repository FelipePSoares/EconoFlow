using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationEmailDeliveryState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailLockedUntil",
                table: "Notifications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmailStatus",
                table: "Notifications",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_EmailStatus_EmailLockedUntil",
                table: "Notifications",
                columns: new[] { "EmailStatus", "EmailLockedUntil" });

            migrationBuilder.Sql(@"UPDATE Notifications SET EmailStatus = 2;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_EmailStatus_EmailLockedUntil",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "EmailLockedUntil",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "EmailStatus",
                table: "Notifications");
        }
    }
}
