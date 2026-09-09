using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookingEngine.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleCalendarToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GoogleCalendarRefreshToken",
                table: "Users",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoogleCalendarRefreshToken",
                table: "Users");
        }
    }
}
