using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmergencyReserveUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Plans_ProjectId",
                table: "Plans");

            migrationBuilder.CreateIndex(
                name: "IX_Plans_ProjectId_Type",
                table: "Plans",
                columns: new[] { "ProjectId", "Type" },
                unique: true,
                filter: "[Type] = 1 AND [IsArchived] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Plans_ProjectId_Type",
                table: "Plans");

            migrationBuilder.CreateIndex(
                name: "IX_Plans_ProjectId",
                table: "Plans",
                column: "ProjectId");
        }
    }
}
