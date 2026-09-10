import { test, expect } from "./fixtures";
import { availability, pickSlot } from "./helpers";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("explore — one-tap booking", () => {
  test("Apartar confirms and the booking shows in Reservas", async ({
    authedPage: page,
    session,
  }) => {
    const slots = await availability(session.accessToken);
    const target = pickSlot(slots, { minCapacity: 2, withinMinutes: 55 });

    await page.goto("/");
    await expect(page.getByText("LIBRE AHORA MISMO")).toBeVisible({
      timeout: 20_000,
    });

    const apartar = page
      .getByRole("button", {
        name: new RegExp(`^Apartar ${escapeRegExp(target.resourceName)}`),
      })
      .first();
    await expect(apartar).toBeVisible();
    await apartar.click();

    // Handoff flow: pill -> check -> row exits (~400ms) -> toast with a "Ver".
    await expect(
      page.getByRole("button", { name: "Ver", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // It really landed — Reservas shows a next booking with a pass.
    await page.goto("/bookings");
    await expect(page.getByRole("button", { name: "Ver pase" })).toBeVisible({
      timeout: 10_000,
    });
  });
});
