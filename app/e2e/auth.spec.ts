import { test, expect } from "./fixtures";
import { API_URL, devSession } from "./helpers";

// Sign-in redesign (2026-10-06): Google / correo doors → one email form →
// the server says which case it is. An unknown email gets a "create your
// account" step (never a silent sign-up), a password-less account the Google
// step, a wrong password an inline error.

const SEARCH = "Buscar sala, cabina, piso…";

async function openEmailForm(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continuar con correo" }).click();
}

async function fillAndEnter(page: import("@playwright/test").Page, email: string, password: string) {
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test.describe("auth", () => {
  test("cold load with no session redirects to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Aparta tu lugar.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("empty form: both errors on Entrar, nothing sent", async ({ page }) => {
    await openEmailForm(page);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Escribe tu correo.")).toBeVisible();
    await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
  });

  test("unknown email → confirm step with a name → signed in", async ({ page, guestEmail }) => {
    await openEmailForm(page);
    await fillAndEnter(page, guestEmail, "short");

    await expect(page.getByText("Crea tu cuenta")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(guestEmail)).toBeVisible();

    // Name required, password ≥ 8 — checked on tap.
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Escribe tu nombre.")).toBeVisible();
    await expect(page.getByText("Usa al menos 8 caracteres. Llevas 5.")).toBeVisible();

    await page.getByLabel("Nombre", { exact: true }).fill("Ana Prueba");
    await page.getByLabel("Contraseña", { exact: true }).fill("long-enough-1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByPlaceholder(SEARCH)).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/sign-in/);
  });

  test("wrong password on an existing account → inline error", async ({ page, guestEmail }) => {
    const register = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: guestEmail, password: "right-pass-1", name: "Ya Existe" }),
    });
    expect(register.ok).toBe(true);

    await openEmailForm(page);
    await fillAndEnter(page, guestEmail, "wrong-pass-1");
    await expect(
      page.getByText("La contraseña no es correcta. Inténtalo de nuevo o recupérala."),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByLabel("Contraseña", { exact: true }).fill("right-pass-1");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByPlaceholder(SEARCH)).toBeVisible({ timeout: 20_000 });
  });

  test("account without a password → the Google step", async ({ page, guestEmail }) => {
    await devSession(guestEmail); // magic-link sign-up: no password, like a Google account
    await openEmailForm(page);
    await fillAndEnter(page, guestEmail, "whatever-1");
    await expect(page.getByText("Esta cuenta entra con Google")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Crear una contraseña" })).toBeVisible();
  });

  test("session survives a reload", async ({ authedPage }) => {
    await authedPage.goto("/");
    await expect(authedPage.getByPlaceholder(SEARCH)).toBeVisible();

    await authedPage.reload();
    await expect(authedPage.getByPlaceholder(SEARCH)).toBeVisible();
    await expect(authedPage).not.toHaveURL(/\/sign-in/);
  });
});
