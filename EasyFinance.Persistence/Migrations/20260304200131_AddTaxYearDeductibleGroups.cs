using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxYearDeductibleGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TaxYearLabeling",
                table: "Projects",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TaxYearStartDay",
                table: "Projects",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TaxYearStartMonth",
                table: "Projects",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TaxYearType",
                table: "Projects",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DeductibleGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaxYearId = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeductibleGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeductibleGroups_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DeductibleGroupExpenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpenseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeductibleGroupExpenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeductibleGroupExpenses_DeductibleGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "DeductibleGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DeductibleGroupExpenses_Expenses_ExpenseId",
                        column: x => x.ExpenseId,
                        principalTable: "Expenses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DeductibleGroupExpenses_ExpenseId",
                table: "DeductibleGroupExpenses",
                column: "ExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_DeductibleGroupExpenses_GroupId_ExpenseId",
                table: "DeductibleGroupExpenses",
                columns: new[] { "GroupId", "ExpenseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeductibleGroups_ProjectId_TaxYearId_Name",
                table: "DeductibleGroups",
                columns: new[] { "ProjectId", "TaxYearId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeductibleGroupExpenses");

            migrationBuilder.DropTable(
                name: "DeductibleGroups");

            migrationBuilder.DropColumn(
                name: "TaxYearLabeling",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "TaxYearStartDay",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "TaxYearStartMonth",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "TaxYearType",
                table: "Projects");
        }
    }
}
