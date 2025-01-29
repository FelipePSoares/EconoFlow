using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddedDefaultProjectToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DefaultProjectId",
                table: "AspNetUsers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_DefaultProjectId",
                table: "AspNetUsers",
                column: "DefaultProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Projects_DefaultProjectId",
                table: "AspNetUsers",
                column: "DefaultProjectId",
                principalTable: "Projects",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Projects_DefaultProjectId",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_DefaultProjectId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "DefaultProjectId",
                table: "AspNetUsers");
        }
    }
}
