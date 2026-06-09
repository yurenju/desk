// Copy the machine-wide dev-login vars into this worktree's `.dev.vars`.
//
// wrangler / @cloudflare/vite-plugin only loads `.dev.vars` from the project
// root, and `.dev.vars` is gitignored + per-worktree — so a fresh worktree
// starts with no DEV_LOGIN flag and no captured seed, forcing a new WSPC device
// flow every time. This keeps the canonical copy OUTSIDE any worktree (under the
// home dir, so it survives worktree deletion and re-clones) and copies it in.
//
// First run with no canonical file: we create one holding just `DEV_LOGIN=true`
// and print how to backfill the cold-start seed after a one-time device flow.
//
// Run from a worktree root: `npm run setup:dev`

import { homedir } from "node:os";
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const canonicalDir = join(homedir(), ".desk-dev");
const canonical = join(canonicalDir, ".dev.vars");
const target = join(process.cwd(), ".dev.vars");

if (existsSync(target)) {
  console.log(`[setup:dev] ${target} already exists — leaving it untouched.`);
  console.log(`[setup:dev] Delete it first if you want to re-copy from ${canonical}.`);
  process.exit(0);
}

let firstTime = false;
if (!existsSync(canonical)) {
  firstTime = true;
  mkdirSync(canonicalDir, { recursive: true });
  writeFileSync(canonical, "DEV_LOGIN=true\n");
}

copyFileSync(canonical, target);
console.log(`[setup:dev] Wrote ${target} from ${canonical}.`);

if (firstTime) {
  console.log("");
  console.log(`[setup:dev] No cold-start seed yet — ${canonical} only enables DEV_LOGIN.`);
  console.log("[setup:dev] First-time login (once per machine):");
  console.log("[setup:dev]   1. Start the preview and complete the WSPC device flow once (TEST account).");
  console.log("[setup:dev]   2. POST /api/dev-login — it returns refreshToken + userId.");
  console.log(`[setup:dev]   3. Append them to ${canonical} so future worktrees auto-login:`);
  console.log("[setup:dev]        DEV_REFRESH_SEED=<refreshToken>");
  console.log("[setup:dev]        DEV_USER_ID=<userId>");
  console.log("[setup:dev]   4. Re-run `npm run setup:dev` in this worktree to pick up the seed,");
  console.log("[setup:dev]      or just paste the same two lines into this worktree's .dev.vars.");
}
