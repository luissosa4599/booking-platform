using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookingEngine.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationFeedFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRead",
                table: "SentNotifications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ResourceName",
                table: "SentNotifications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SlotStartsAt",
                table: "SentNotifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SentNotifications_UserId_SentAt",
                table: "SentNotifications",
                columns: new[] { "UserId", "SentAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SentNotifications_UserId_SentAt",
                table: "SentNotifications");

            migrationBuilder.DropColumn(
                name: "IsRead",
                table: "SentNotifications");

            migrationBuilder.DropColumn(
                name: "ResourceName",
                table: "SentNotifications");

            migrationBuilder.DropColumn(
                name: "SlotStartsAt",
                table: "SentNotifications");
        }
    }
}
