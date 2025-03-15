using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MovePreferredCurrencyFromUserToProject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PreferredCurrency",
                table: "AspNetUsers");

            migrationBuilder.AddColumn<string>(
                name: "PreferredCurrency",
                table: "Projects",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "EUR");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PreferredCurrency",
                table: "Projects");

            migrationBuilder.AddColumn<string>(
                name: "PreferredCurrency",
                table: "AspNetUsers",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: true);
        }
    }
}
