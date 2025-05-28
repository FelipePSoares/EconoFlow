using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ContactUsDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "ContactUs");

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedById",
                table: "ContactUs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContactUs_CreatedById",
                table: "ContactUs",
                column: "CreatedById");

            migrationBuilder.AddForeignKey(
                name: "FK_ContactUs_AspNetUsers_CreatedById",
                table: "ContactUs",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContactUs_AspNetUsers_CreatedById",
                table: "ContactUs");

            migrationBuilder.DropIndex(
                name: "IX_ContactUs_CreatedById",
                table: "ContactUs");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "ContactUs");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "ContactUs",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }
    }
}
