using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateUserProjectForInvitations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Accepted",
                table: "UserProjects",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                table: "UserProjects",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "UserProjects",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Expired",
                table: "UserProjects",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiryDate",
                table: "UserProjects",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "SentAt",
                table: "UserProjects",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<Guid>(
                name: "Token",
                table: "UserProjects",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_UserProjects_Token",
                table: "UserProjects",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserProjects_Token",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "Accepted",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "Expired",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "ExpiryDate",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "SentAt",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "Token",
                table: "UserProjects");
        }
    }
}
