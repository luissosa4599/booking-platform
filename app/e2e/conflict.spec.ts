import { test, expect } from "./fixtures";
import { availability, createBooking, devSession } from "./helpers";

test.describe("explore — booking conflict", () => {
  test("a stale tap shows 'Alguien se adelantó' with alternatives", async ({
    authedPage: page,
    session,
  }) => {
    await page.goto("/");
    // A random row in the "now" group (its Apartar label is
    // "... ahora, hasta HH:MM") — random so parallel specs don't all pick row 0.
    const allApartar = page.getByRole("button", {
      name: /^Apartar .+ ahora, hasta/,
    });
    await expect(allApartar.first()).toBeVisible({ timeout: 20_000 });
    const n = await allApartar.count();
    const apartar = allApartar.nth(Math.floor(Math.random() * n));

    const label = (await apartar.getAttribute("aria-label")) ?? "";
    const resourceName = label.match(/^Apartar (.+?) ahora, hasta/)?.[1];
    expect(resourceName, `parsed name from "${label}"`).toBeTruthy();

    // Someone else takes every near-term seat on that resource — the page's
    // cached rowVersion for the row it's about to tap is now stale.
    const other = await devSession(`e2e-other-${Date.now()}@tempo.demo`);
    const soon = Date.now() + 60 * 60 * 1000;
    const bumped = (await availability(session.accessToken)).filter(
      (s) =>
        s.resourceName === resourceName &&
        s.capacityRemaining > 0 &&
        new Date(s.startsAt).getTime() <= soon,
    );
    expect(bumped.length).toBeGreaterThan(0);
    for (const s of bumped) await createBooking(other.accessToken, s.id);

    await apartar.click();

    await expect(page.getByText("Alguien se adelantó")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("No guardamos nada.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Anotarme para las/ }),
    ).toBeVisible();
  });
});
