// Deletes every bin/ and obj/ folder under api/ — the fix for the intermittent
// "corrupted nested bin/obj paths" build failure documented in CLAUDE.md
// ("Known environment gotchas"). Pure Node fs so it runs the same on
// Windows / macOS / Linux without rm/find.
import { rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "api");

let removed = 0;
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name === "bin" || entry.name === "obj") {
      // maxRetries/retryDelay: on Windows the persistent MSBuild/Roslyn build
      // server processes briefly hold handles on these folders.
      rmSync(full, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
      removed++;
      console.log("  removed " + full);
    } else if (entry.name !== "node_modules") {
      walk(full);
    }
  }
}

walk(apiDir);
console.log(removed === 0 ? "clean-dotnet: nothing to remove" : `clean-dotnet: removed ${removed} folder(s)`);
