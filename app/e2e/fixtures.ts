import { test as base, type Page } from "@playwright/test";

import { devSession, sessionStorageValue, type DevSession } from "./helpers";

interface Fixtures {
  /** A fresh, unique guest email per test — bookings/waitlist don't bleed. */
  guestEmail: string;
  /** A real dev session (magic-link redeemed server-side) for `guestEmail`. */
  session: DevSession;
  /** `page` with `tempo.session.v1` pre-seeded, so the app boots authed. */
  authedPage: Page;
}

export const test = base.extend<Fixtures>({
  guestEmail: async ({}, use) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await use(`e2e-${id}@tempo.demo`);
  },

  session: async ({ guestEmail }, use) => {
    await use(await devSession(guestEmail));
  },

  authedPage: async ({ page, session }, use) => {
    await page.addInitScript((value) => {
      try {
        window.localStorage.setItem("tempo.session.v1", value);
      } catch {
        /* private mode — the test will surface it as a redirect to /sign-in */
      }
    }, sessionStorageValue(session));
    await use(page);
  },
});

export { expect } from "@playwright/test";
