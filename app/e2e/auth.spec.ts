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
    await page.getByPlaceholder("Correo (solo dev)").fill(guestEmail);
    await page.getByRole("button", { name: "Entrar con enlace de dev" }).click();

    await expect(
      page.getByRole("heading", { name: "Ahora" }).or(page.getByText("Ahora", { exact: true })),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/sign-in/);
  });

  test("session survives a reload", async ({ authedPage }) => {
    await authedPage.goto("/");
    await expect(authedPage.getByText("Ahora", { exact: true })).toBeVisible();

    await authedPage.reload();
    await expect(authedPage.getByText("Ahora", { exact: true })).toBeVisible();
    await expect(authedPage).not.toHaveURL(/\/sign-in/);
  });
});
