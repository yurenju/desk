import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SPEC_URL = "https://api.wspc.ai/openapi.json";
const OUT_PATH = join(import.meta.dirname, "../spec/wspc-openapi.json");

try {
  console.log(`Fetching WSPC OpenAPI spec from ${SPEC_URL}...`);
  const res = await fetch(SPEC_URL);
  if (!res.ok) {
    console.error(`Failed to fetch ${SPEC_URL}: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const json = await res.json();
  writeFileSync(OUT_PATH, JSON.stringify(json, null, 2) + "\n");
  console.log(`Wrote snapshot to ${OUT_PATH}`);
} catch (error) {
  console.error("Error syncing WSPC spec:", error instanceof Error ? error.message : error);
  process.exit(1);
}
