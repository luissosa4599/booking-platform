import { test, expect } from "./fixtures";

test.describe("auth", () => {
  test("cold load with no session redirects to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Aparta tu lugar.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("dev magic link signs in and lands on Explore", async ({
    page,
    guestEmail,
  }) => {
    await page.goto("/sign-in");
    // The email field is shared with the always-visible password login/register
    // form now (PR #20) — no longer a dev-only placeholder.
    await page.getByPlaceholder("Correo").fill(guestEmail);
    await page.getByRole("button", { name: "Entrar con enlace de dev" }).click();

    // "Ahora" (a segmented Ahora/Más tarde control) doesn't exist anymore —
    // removed by the Direction A redesign (2026-09-15) without updating this
    // spec, which then failed silently on every push to `main` since (never
    // caught because nobody was reading the e2e job's result). The search
    // bar's placeholder is a stable, always-present marker of the Explore
    // screen regardless of copy/layout changes elsewhere on it.
    await expect(page.getByPlaceholder("Buscar sala, cabina, piso…")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).not.toHaveURL(/\/sign-in/);
  });

  test("session survives a reload", async ({ authedPage }) => {
    await authedPage.goto("/");
    await expect(authedPage.getByPlaceholder("Buscar sala, cabina, piso…")).toBeVisible();

    await authedPage.reload();
    await expect(authedPage.getByPlaceholder("Buscar sala, cabina, piso…")).toBeVisible();
    await expect(authedPage).not.toHaveURL(/\/sign-in/);
  });
});
