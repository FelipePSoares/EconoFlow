using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EasyFinance.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatorName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseItems_AspNetUsers_CreatedById",
                table: "ExpenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_AspNetUsers_CreatedById",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Incomes_AspNetUsers_CreatedById",
                table: "Incomes");

            migrationBuilder.DropForeignKey(
                name: "FK_UserProjects_Projects_ProjectId",
                table: "UserProjects");

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "Incomes",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "CreatorName",
                table: "Incomes",
                type: "nvarchar(513)",
                maxLength: 513,
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "Expenses",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "CreatorName",
                table: "Expenses",
                type: "nvarchar(513)",
                maxLength: 513,
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "ExpenseItems",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "CreatorName",
                table: "ExpenseItems",
                type: "nvarchar(513)",
                maxLength: 513,
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseItems_AspNetUsers_CreatedById",
                table: "ExpenseItems",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_AspNetUsers_CreatedById",
                table: "Expenses",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Incomes_AspNetUsers_CreatedById",
                table: "Incomes",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserProjects_Projects_ProjectId",
                table: "UserProjects",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseItems_AspNetUsers_CreatedById",
                table: "ExpenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_AspNetUsers_CreatedById",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Incomes_AspNetUsers_CreatedById",
                table: "Incomes");

            migrationBuilder.DropForeignKey(
                name: "FK_UserProjects_Projects_ProjectId",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "CreatorName",
                table: "Incomes");

            migrationBuilder.DropColumn(
                name: "CreatorName",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "CreatorName",
                table: "ExpenseItems");

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "Incomes",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "Expenses",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "ExpenseItems",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseItems_AspNetUsers_CreatedById",
                table: "ExpenseItems",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_AspNetUsers_CreatedById",
                table: "Expenses",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Incomes_AspNetUsers_CreatedById",
                table: "Incomes",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserProjects_Projects_ProjectId",
                table: "UserProjects",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
