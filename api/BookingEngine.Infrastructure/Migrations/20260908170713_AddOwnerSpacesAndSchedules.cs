using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookingEngine.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerSpacesAndSchedules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnerUserId",
                table: "Resources",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerUserId",
                table: "Locations",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsBlocked",
                table: "AvailabilitySlots",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Origin",
                table: "AvailabilitySlots",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Adhoc");

            migrationBuilder.CreateTable(
                name: "WeeklySchedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ResourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    SlotDurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeeklySchedules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WeeklySchedules_Resources_ResourceId",
                        column: x => x.ResourceId,
                        principalTable: "Resources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WeeklyScheduleDays",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WeeklyScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Weekday = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    OpenTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CloseTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeeklyScheduleDays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WeeklyScheduleDays_WeeklySchedules_WeeklyScheduleId",
                        column: x => x.WeeklyScheduleId,
                        principalTable: "WeeklySchedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Resources_OwnerUserId",
                table: "Resources",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Locations_OwnerUserId",
                table: "Locations",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_WeeklyScheduleDays_WeeklyScheduleId_Weekday",
                table: "WeeklyScheduleDays",
                columns: new[] { "WeeklyScheduleId", "Weekday" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WeeklySchedules_ResourceId",
                table: "WeeklySchedules",
                column: "ResourceId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WeeklyScheduleDays");

            migrationBuilder.DropTable(
                name: "WeeklySchedules");

            migrationBuilder.DropIndex(
                name: "IX_Resources_OwnerUserId",
                table: "Resources");

            migrationBuilder.DropIndex(
                name: "IX_Locations_OwnerUserId",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                table: "Resources");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "IsBlocked",
                table: "AvailabilitySlots");

            migrationBuilder.DropColumn(
                name: "Origin",
                table: "AvailabilitySlots");
        }
    }
}
