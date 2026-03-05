using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseItemTargetToDeductibleGroupExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DeductibleGroupExpenses_GroupId_ExpenseId",
                table: "DeductibleGroupExpenses");

            migrationBuilder.AlterColumn<Guid>(
                name: "ExpenseId",
                table: "DeductibleGroupExpenses",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "ExpenseItemId",
                table: "DeductibleGroupExpenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeductibleGroupExpenses_ExpenseItemId",
                table: "DeductibleGroupExpenses",
                column: "ExpenseItemId");

            migrationBuilder.CreateIndex(
                name: "IX_DeductibleGroupExpenses_GroupId_ExpenseId",
                table: "DeductibleGroupExpenses",
                columns: new[] { "GroupId", "ExpenseId" },
                unique: true,
                filter: "[ExpenseId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_DeductibleGroupExpenses_GroupId_ExpenseItemId",
                table: "DeductibleGroupExpenses",
                columns: new[] { "GroupId", "ExpenseItemId" },
                unique: true,
                filter: "[ExpenseItemId] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_DeductibleGroupExpenses_ExactlyOneTarget",
                table: "DeductibleGroupExpenses",
                sql: "(([ExpenseId] IS NOT NULL AND [ExpenseItemId] IS NULL) OR ([ExpenseId] IS NULL AND [ExpenseItemId] IS NOT NULL))");

            migrationBuilder.AddForeignKey(
                name: "FK_DeductibleGroupExpenses_ExpenseItems_ExpenseItemId",
                table: "DeductibleGroupExpenses",
                column: "ExpenseItemId",
                principalTable: "ExpenseItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeductibleGroupExpenses_ExpenseItems_ExpenseItemId",
                table: "DeductibleGroupExpenses");

            migrationBuilder.DropIndex(
                name: "IX_DeductibleGroupExpenses_ExpenseItemId",
                table: "DeductibleGroupExpenses");

            migrationBuilder.DropIndex(
                name: "IX_DeductibleGroupExpenses_GroupId_ExpenseId",
                table: "DeductibleGroupExpenses");

            migrationBuilder.DropIndex(
                name: "IX_DeductibleGroupExpenses_GroupId_ExpenseItemId",
                table: "DeductibleGroupExpenses");

            migrationBuilder.DropCheckConstraint(
                name: "CK_DeductibleGroupExpenses_ExactlyOneTarget",
                table: "DeductibleGroupExpenses");

            migrationBuilder.DropColumn(
                name: "ExpenseItemId",
                table: "DeductibleGroupExpenses");

            migrationBuilder.AlterColumn<Guid>(
                name: "ExpenseId",
                table: "DeductibleGroupExpenses",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeductibleGroupExpenses_GroupId_ExpenseId",
                table: "DeductibleGroupExpenses",
                columns: new[] { "GroupId", "ExpenseId" },
                unique: true);
        }
    }
}
