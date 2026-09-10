import { API_URL, seed } from "./helpers";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8081";

async function waitFor(name: string, url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404) return; // 404 is fine — the port answers
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`${name} (${url}) never came up`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/** Runs once before the suite: wait for API + web, then seed. */
export default async function globalSetup() {
  await waitFor("API", `${API_URL}/health`, 60_000);
  await waitFor("web", BASE_URL, 180_000); // Metro's first bundle is slow
  await seed();
}
