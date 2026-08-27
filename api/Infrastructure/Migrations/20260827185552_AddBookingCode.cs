using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookingEngine.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "Bookings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            // Backfill any pre-existing rows with a unique placeholder so the
            // unique index below can be created (dev DB may already hold
            // bookings from before this column existed).
            migrationBuilder.Sql(
                "UPDATE \"Bookings\" SET \"Code\" = 'LEG-' || upper(substr(replace(\"Id\"::text, '-', ''), 1, 8)) WHERE \"Code\" = '';");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_Code",
                table: "Bookings",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_UserId",
                table: "Bookings",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_Code",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_UserId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "Bookings");
        }
    }
}
