// WCAG contrast sweep (2026-09-29 audit) — a Claude-in-session verification
// tool, deliberately NOT in CI (same call as screenshot checks, see CLAUDE.md).
//
// Drives the real dev app with Playwright across every main screen + the
// common sheets, both color schemes, and for each visible text node computes
// the real contrast ratio: computed color x accumulated opacity, composited
// over whatever is actually painted under it (elementsFromPoint stack), vs
// WCAG AA (4.5:1, or 3:1 for large text). Also flags pure-black text, the
// usual symptom of a NativeWind className that silently generated no CSS.
//
// Needs the API (:5190, Development — uses the dev magic link + /bookings to
// build a realistic account) and Expo web running. Usage, from app/:
//   node scripts/contrast-audit.cjs                      # phone, 390px
//   VP='{"width":1280,"height":1000}' node scripts/contrast-audit.cjs
// Env: AUDIT_API, AUDIT_WEB, AUDIT_OUT. Disabled-button text is held to 4.5:1
// too since 2026-10-06 (WCAG exempts it, the user wanted it readable). Known
// non-issue left: white text over photos (the script can't read image pixels
// -- eyeball those). Dark mode's inverted pills are filtered out below.
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = (process.env.AUDIT_OUT || path.join(__dirname, "..", "contrast-audit")) + "/";
const API = process.env.AUDIT_API || "http://localhost:5190";
const WEB = process.env.AUDIT_WEB || "http://localhost:8081";
const VIEWPORT = JSON.parse(process.env.VP || '{"width":390,"height":1600}');

async function post(path, body, token, extra = {}) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function get(path, token) {
  const r = await fetch(API + path, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}
async function devSession(email) {
  const { token } = await post("/auth/request-link", { email });
  return post("/auth/verify", { token });
}
const storageValue = (s) =>
  JSON.stringify({
    userId: s.user.id, email: s.user.email, displayName: s.user.displayName ?? "Luis Prueba",
    avatarUrl: null, role: s.user.role === "host" ? "host" : "guest",
    accessToken: s.accessToken, refreshToken: s.refreshToken,
  });

function analyze() {
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (fg, a, bg) => ({ r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) });
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const opacityChain = (el) => {
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity || "1");
    return o;
  };
  const hasImg = (e) => {
    const cs = getComputedStyle(e);
    return e.tagName === "IMG" || e.tagName === "CANVAS" || e.tagName === "VIDEO" || (cs.backgroundImage && cs.backgroundImage !== "none");
  };
  const results = [];
  const all = document.querySelectorAll("body *");
  for (const el of all) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
    const op = opacityChain(el);
    if (op < 0.05) continue; // faded out / closing sheet
    const fg = parse(cs.color);
    if (!fg) continue;
    const cx = Math.min(innerWidth - 1, Math.max(0, rect.left + Math.min(rect.width / 2, 12)));
    const cy = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const stack = document.elementsFromPoint(cx, cy);
    let idx = stack.indexOf(el);
    if (idx < 0) idx = stack.findIndex((s) => el.contains(s) || s.contains(el));
    let covered = false;
    let below = stack;
    if (idx >= 0) {
      for (let i = 0; i < idx; i++) {
        const s = stack[i];
        if (el.contains(s)) continue;
        const b = parse(getComputedStyle(s).backgroundColor);
        if ((b && b.a * opacityChain(s) > 0.3) || hasImg(s)) { covered = true; break; }
      }
      below = stack.slice(idx);
    } else {
      below = [];
      for (let e = el; e; e = e.parentElement) below.push(e);
    }
    if (covered) continue;
    const layers = [];
    let img = false;
    for (const s of below) {
      if (hasImg(s) && s !== el) img = true;
      const b = parse(getComputedStyle(s).backgroundColor);
      if (b && b.a > 0) {
        const a = b.a * opacityChain(s);
        layers.push({ c: b, a });
        if (a >= 0.99) break;
      }
    }
    let bg = { r: 255, g: 255, b: 255 };
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i].c, layers[i].a, bg);
    const eff = over(fg, fg.a * op, bg);
    const l1 = lum(eff), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    results.push({
      text: text.slice(0, 60), ratio: Math.round(ratio * 100) / 100, need,
      fg: hex(fg), fgAlpha: Math.round(fg.a * op * 100) / 100, bg: hex(bg), size, img,
      pureBlack: fg.r === 0 && fg.g === 0 && fg.b === 0,
      cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 80),
    });
  }
  return results;
}

(async () => {
  const guestEmail = `audit-${Date.now()}@tempo.demo`;
  const guest = await devSession(guestEmail);
  const slots = (await get(`/availability?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 3 * 86400e3).toISOString())}`, guest.accessToken)).slots;
  const bookable = slots.filter((s) => s.capacityRemaining >= 1);
  const booked = [];
  for (const s of [bookable[0], bookable[5], bookable[12], bookable[30]]) {
    const b = await post("/bookings", { availabilitySlotId: s.id, seats: 1 }, guest.accessToken, { "idempotency-key": `audit-${s.id}-${Date.now()}` });
    booked.push({ ...b, resourceId: s.resourceId });
  }
  // one cancelled -> shows up in Anteriores
  await fetch(`${API}/bookings/${booked[3].id}`, { method: "DELETE", headers: { authorization: `Bearer ${guest.accessToken}` } });
  // a waitlist entry on a full slot
  const full = slots.find((s) => s.capacityRemaining === 0);
  if (full) await post("/waitlist", { availabilitySlotId: full.id }, guest.accessToken).catch(() => {});

  const host = await devSession("host@tempo.demo");
  const hostSpaces = await get("/owner/spaces", host.accessToken);
  const spaceId = (hostSpaces[0] || hostSpaces.spaces?.[0])?.id;

  const resourceId = booked[0].resourceId;
  const guestRoutes = [
    { name: "explore", path: "/" },
    { name: "explore-filter-sheet", path: "/", act: async (p) => { await p.getByLabel("Filtros").first().click(); } },
    { name: "explore-map", path: "/", act: async (p) => { await p.getByText("Mapa", { exact: true }).first().click(); await p.waitForTimeout(3500); } },
    { name: "bookings", path: "/bookings" },
    { name: "bookings-pass-sheet", path: "/bookings", act: async (p) => { await p.getByText("Ver pase", { exact: true }).first().click(); } },
    { name: "bookings-cancel-sheet", path: "/bookings", act: async (p) => { await p.getByText("Cancelar", { exact: true }).first().click(); } },
    { name: "bookings-past", path: "/bookings", act: async (p) => { await p.getByText("Anteriores", { exact: true }).first().click(); } },
    { name: "profile", path: "/profile" },
    { name: "profile-signout-sheet", path: "/profile", act: async (p) => { await p.getByText("Cerrar sesión", { exact: true }).first().click(); } },
    { name: "notifications", path: "/notifications" },
    { name: "resource", path: `/resource/${resourceId}` },
    { name: "become-host", path: "/become-host" },
    { name: "privacy", path: "/privacy" },
  ];
  const publicRoutes = [
    { name: "welcome", path: "/welcome" },
    { name: "welcome-permissions", path: "/welcome", act: async (p) => { for (let i = 0; i < 3; i++) { await p.getByText("Siguiente", { exact: true }).click(); await p.waitForTimeout(500); } } },
    { name: "sign-in", path: "/sign-in" },
    { name: "sign-in-register", path: "/sign-in", act: async (p) => { await p.getByText("Crear una").click(); } },
    { name: "forgot-password", path: "/forgot-password" },
  ];
  // Guest mode (2026-10-06): no session, "Continuar como invitado" chosen.
  const guestModeRoutes = [
    { name: "guest-explore", path: "/" },
    { name: "guest-signin-modal", path: "/", act: async (p) => { await p.getByRole("button", { name: /^Apartar/ }).first().click(); } },
    { name: "guest-bookings", path: "/bookings" },
    { name: "guest-profile", path: "/profile" },
    { name: "about", path: "/about" },
    { name: "permissions", path: "/permissions" },
  ];
  const hostRoutes = spaceId
    ? [
        { name: "host-spaces", path: "/spaces" },
        { name: "host-account", path: "/account" },
        { name: "host-space", path: `/space/${spaceId}` },
        { name: "host-space-edit", path: `/space/${spaceId}/edit` },
        { name: "host-space-schedule", path: `/space/${spaceId}/schedule` },
        { name: "host-space-new", path: "/space/new" },
      ]
    : [];

  const browser = await chromium.launch();
  const report = [];
  const runSet = async (routes, sessionValue, scheme, { guestMode = false } = {}) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: scheme });
    // Skip the first-run tutorial everywhere (it has its own routes above).
    await ctx.addInitScript((g) => {
      try {
        localStorage.setItem("tempo.onboarding.v1", "1");
        if (g) localStorage.setItem("tempo.guest.v1", "1");
      } catch {}
    }, guestMode);
    if (sessionValue) {
      await ctx.addInitScript((v) => { try { localStorage.setItem("tempo.session.v1", v); } catch {} }, sessionValue);
    }
    for (const r of routes) {
      const page = await ctx.newPage();
      try {
        await page.goto(WEB + r.path);
        await page.waitForTimeout(4500); // splash + data
        if (r.act) { await r.act(page); await page.waitForTimeout(1200); }
        const res = await page.evaluate(analyze);
        await page.screenshot({ path: `${OUT}${r.name}-${scheme}-${VIEWPORT.width}.png` });
        for (const x of res) report.push({ route: r.name, scheme, vp: VIEWPORT.width, ...x });
        process.stdout.write(`${r.name}/${scheme}: ${res.length} texts\n`);
      } catch (e) {
        process.stdout.write(`${r.name}/${scheme}: ERROR ${e.message.split("\n")[0]}\n`);
      }
      await page.close();
    }
    await ctx.close();
  };
  fs.mkdirSync(OUT, { recursive: true });
  for (const scheme of ["light", "dark"]) {
    await runSet(publicRoutes, null, scheme);
    await runSet(guestModeRoutes, null, scheme, { guestMode: true });
    await runSet(guestRoutes, storageValue(guest), scheme);
    if (hostRoutes.length) await runSet(hostRoutes, storageValue(host), scheme);
  }
  await browser.close();
  fs.writeFileSync(`${OUT}report-${VIEWPORT.width}.json`, JSON.stringify(report, null, 1));
  // Pure-black text usually means a color className silently didn't apply
  // (fell back to black). The exception is dark mode's inverted pills
  // (`label-1` bg + `canvas` text = white + #000), which are 21:1 by design.
  const invertedPill = (x) => x.scheme === "dark" && x.bg === "#ffffff";
  const bad = report.filter((x) => x.ratio < x.need || (x.pureBlack && !invertedPill(x)));
  console.log(`\n${report.length} text samples, ${bad.length} failing`);
  for (const x of bad) {
    const over = x.img ? " [over image]" : "";
    console.log(`  ${x.route}/${x.scheme}  ${x.ratio}:1 (need ${x.need})  ${x.fg} on ${x.bg}${over}  "${x.text}"`);
  }
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
