// Fetch the latest WSPC OpenAPI spec and overwrite the local snapshot.
// Run explicitly via `npm run wspc:sync` — not part of build / install.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SPEC_URL = "https://api.wspc.ai/openapi.json";
const OUT_PATH = join(process.cwd(), "spec", "wspc-openapi.json");

const res = await fetch(SPEC_URL);
if (!res.ok) {
  console.error(`Failed to fetch ${SPEC_URL}: ${res.status}`);
  process.exit(1);
}
const json = await res.json();
writeFileSync(OUT_PATH, JSON.stringify(json, null, 2) + "\n");
console.log(`Wrote ${OUT_PATH}`);
