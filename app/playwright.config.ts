import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite (roadmap §2). Drives the real Expo **web dev server**
 * against a real API + Postgres — the same "real browser, real backend"
 * verification the throwaway `.mjs` scripts did, now permanent and in CI.
 *
 * The dev server (not a static export) on purpose: the sign-in screen's
 * magic-link field is `__DEV__`-gated, and `__DEV__` is false in an export.
 *
 * Before `playwright test`, both must be up (CI wires them as steps, see
 * `.github/workflows/ci.yml` `e2e`; locally: `dotnet run` + `npm run web`):
 *  - API on `E2E_API_URL` (default :5190)
 *  - Expo web on `E2E_BASE_URL` (default :8081 — the only origin `Program.cs`
 *    CORS allows)
 *
 * `global-setup.ts` blocks until both answer, then calls `POST /dev/seed`.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8081";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: process.env.CI ? "retain-on-failure" : "off",
  },

  projects: [
    {
      name: "chromium-light",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "chromium-dark",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
  ],
});
