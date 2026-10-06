import { test, expect } from "./fixtures";

// First launch (2026-10-06): tutorial → sign-in → "Continuar como invitado".
// Inside guest mode, anything that needs an account opens a modal instead of
// redirecting to sign-in. These start with no `tempo.onboarding.v1`, unlike
// every other spec.

const SEARCH = "Buscar sala, cabina, piso…";
const MODAL_TITLE = "Para acceder a esta función tienes que iniciar sesión";

test.use({ skipOnboarding: false });

test.describe("first launch + guest mode", () => {
  test("tutorial → sign-in → guest Explore, with the sign-in modal", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome/, { timeout: 20_000 });
    await expect(page.getByText("Antes de empezar")).toBeVisible();

    await page.getByRole("button", { name: "Omitir el tutorial" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByRole("button", { name: "Continuar como invitado" }).click();
    await expect(page.getByPlaceholder(SEARCH)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Explorando sin cuenta")).toBeVisible();

    // Booking needs an account → modal, and "Ahora no" leaves you in place.
    await page.getByRole("button", { name: /^Apartar/ }).first().click();
    await expect(page.getByText(MODAL_TITLE)).toBeVisible();
    await page.getByRole("button", { name: "Ahora no" }).click();
    await expect(page.getByText(MODAL_TITLE)).toBeHidden();
    await expect(page).not.toHaveURL(/\/sign-in/);

    // Reservas is gated the same way — no navigation. (Desktop Chrome's
    // viewport is wide, so it's the NavRail item, not the bottom tab.)
    await page.getByRole("link", { name: "Reservas", exact: true }).click();
    await expect(page.getByText(MODAL_TITLE)).toBeVisible();
    await expect(page).not.toHaveURL(/\/bookings/);

    // Signing in is the user's choice from the modal.
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // Guest mode survives a reload (no sign-in wall).
    await page.goto("/");
    await expect(page.getByText("Explorando sin cuenta")).toBeVisible({ timeout: 20_000 });
  });

  test("a deep link to /privacy skips the tutorial", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText("Política de privacidad")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/privacy/);
  });
});
