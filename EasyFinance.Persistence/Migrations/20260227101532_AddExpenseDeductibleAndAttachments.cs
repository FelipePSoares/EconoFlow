using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseDeductibleAndAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_ExpenseItems_ExpenseItemId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Expenses_ExpenseId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Incomes_IncomeId",
                table: "Attachments");

            migrationBuilder.DropIndex(
                name: "IX_Attachments_ExpenseId",
                table: "Attachments");

            migrationBuilder.AddColumn<bool>(
                name: "IsDeductible",
                table: "Expenses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeductible",
                table: "ExpenseItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<Guid>(
                name: "IncomeId",
                table: "Attachments",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "ExpenseItemId",
                table: "Attachments",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "ExpenseId",
                table: "Attachments",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<int>(
                name: "AttachmentType",
                table: "Attachments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ContentType",
                table: "Attachments",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsTemporary",
                table: "Attachments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "Size",
                table: "Attachments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "StorageKey",
                table: "Attachments",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_ExpenseId_AttachmentType",
                table: "Attachments",
                columns: new[] { "ExpenseId", "AttachmentType" },
                unique: true,
                filter: "[ExpenseId] IS NOT NULL AND [AttachmentType] = 1");

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_ExpenseItems_ExpenseItemId",
                table: "Attachments",
                column: "ExpenseItemId",
                principalTable: "ExpenseItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Expenses_ExpenseId",
                table: "Attachments",
                column: "ExpenseId",
                principalTable: "Expenses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Incomes_IncomeId",
                table: "Attachments",
                column: "IncomeId",
                principalTable: "Incomes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_ExpenseItems_ExpenseItemId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Expenses_ExpenseId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Incomes_IncomeId",
                table: "Attachments");

            migrationBuilder.DropIndex(
                name: "IX_Attachments_ExpenseId_AttachmentType",
                table: "Attachments");

            migrationBuilder.DropColumn(
                name: "IsDeductible",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "IsDeductible",
                table: "ExpenseItems");

            migrationBuilder.DropColumn(
                name: "AttachmentType",
                table: "Attachments");

            migrationBuilder.DropColumn(
                name: "ContentType",
                table: "Attachments");

            migrationBuilder.DropColumn(
                name: "IsTemporary",
                table: "Attachments");

            migrationBuilder.DropColumn(
                name: "Size",
                table: "Attachments");

            migrationBuilder.DropColumn(
                name: "StorageKey",
                table: "Attachments");

            migrationBuilder.AlterColumn<Guid>(
                name: "IncomeId",
                table: "Attachments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "ExpenseItemId",
                table: "Attachments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "ExpenseId",
                table: "Attachments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_ExpenseId",
                table: "Attachments",
                column: "ExpenseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_ExpenseItems_ExpenseItemId",
                table: "Attachments",
                column: "ExpenseItemId",
                principalTable: "ExpenseItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Expenses_ExpenseId",
                table: "Attachments",
                column: "ExpenseId",
                principalTable: "Expenses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Incomes_IncomeId",
                table: "Attachments",
                column: "IncomeId",
                principalTable: "Incomes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
