import { test, expect } from "./fixtures";
import { API_URL, availability, createBooking, pickSlot } from "./helpers";

async function bookingStatus(token: string, id: string): Promise<string> {
  const r = await fetch(`${API_URL}/bookings?scope=upcoming`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const list = (await r.json()) as { id: string }[];
  return list.some((b) => b.id === id) ? "upcoming" : "gone";
}

test.describe("bookings — deferred cancel", () => {
  test("Deshacer keeps the booking (the DELETE never fires)", async ({
    authedPage: page,
    session,
  }) => {
    const slot = pickSlot(await availability(session.accessToken), {
      minCapacity: 2,
    });
    const booking = await createBooking(session.accessToken, slot.id);

    await page.goto("/bookings");
    await expect(page.getByText(slot.resourceName).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /^Cancelar/ }).first().click();
    await expect(page.getByText("Reserva cancelada")).toBeVisible();

    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByText("Reserva cancelada")).toBeHidden();

    // Wait past the 5s toast window, then confirm the booking is still live.
    await page.waitForTimeout(6000);
    expect(await bookingStatus(session.accessToken, booking.id)).toBe("upcoming");
    await expect(page.getByText(slot.resourceName).first()).toBeVisible();
  });

  test("letting the toast expire fires the cancel", async ({
    authedPage: page,
    session,
  }) => {
    const slot = pickSlot(await availability(session.accessToken), {
      minCapacity: 2,
    });
    const booking = await createBooking(session.accessToken, slot.id);

    await page.goto("/bookings");
    await expect(page.getByText(slot.resourceName).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /^Cancelar/ }).first().click();
    await expect(page.getByText("Reserva cancelada")).toBeVisible();

    // Don't touch it — the DELETE fires when the 5s toast auto-dismisses.
    await expect(page.getByText("Reserva cancelada")).toBeHidden({
      timeout: 10_000,
    });
    await expect
      .poll(() => bookingStatus(session.accessToken, booking.id), {
        timeout: 10_000,
      })
      .toBe("gone");
  });
});
