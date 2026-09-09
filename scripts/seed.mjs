// Wipes and reseeds the dev database via the API's dev-only endpoint.
// POST /dev/seed always truncates (FK-safe) then reseeds — see CLAUDE.md.
// Requires the backend (npm run back) to be running first.
const url = process.env.SEED_URL || "http://localhost:5190/dev/seed";

try {
  const res = await fetch(url, { method: "POST" });
  const body = await res.text();
  if (!res.ok) {
    console.error(`seed: ${res.status} ${res.statusText}\n${body}`);
    process.exit(1);
  }
  console.log(`seed: ok (${url})\n${body}`);
} catch (err) {
  console.error(
    `seed: could not reach ${url} — is the backend running? (npm run back)\n${err.message}`,
  );
  process.exit(1);
}
