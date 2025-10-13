using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ChangeExpenseItemsDeleteBehaviorToCascade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseItems_Expenses_ExpenseId",
                table: "ExpenseItems");

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseItems_Expenses_ExpenseId",
                table: "ExpenseItems",
                column: "ExpenseId",
                principalTable: "Expenses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseItems_Expenses_ExpenseId",
                table: "ExpenseItems");

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseItems_Expenses_ExpenseId",
                table: "ExpenseItems",
                column: "ExpenseId",
                principalTable: "Expenses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
