#!/usr/bin/env node
// Live WSPC API verification tool.
//
// Purpose: empirically confirm behaviour that the snapshotted OpenAPI spec
// (spec/wspc-openapi.json) does NOT document but that llms.txt and the MCP
// tool schema claim exists — primarily the `?cf.<field>=<value>` custom-field
// filter on GET /todo/items (Slice 2b depends on "scheduled_dates contains today").
//
// It also exercises the lazy bootstrap path Slice 2b will use: register an
// OAuth client, run the device flow, create a "Desk (verify)" project, register
// a DeskTask type with custom fields, seed test todos, then probe the filter.
//
// Zero dependencies: built-in fetch only. Run with plain `node`:
//   node scripts/verify-wspc.mjs            # reuse cached client/token/bootstrap
//   node scripts/verify-wspc.mjs --reset    # wipe cache, start fresh
//   node scripts/verify-wspc.mjs --keep     # don't soft-delete seeded test todos
//
// Auth/bootstrap state is cached in .wspc-verify-cache.json (gitignored) so you
// only complete the device flow once. Reference: https://wspc.ai/llms.txt

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://api.wspc.ai";
const CACHE_PATH = join(import.meta.dirname, "../.wspc-verify-cache.json");
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

const args = new Set(process.argv.slice(2));
const RESET = args.has("--reset");
const KEEP = args.has("--keep");

// ── tiny logging helpers ──────────────────────────────────────────────
const c = (n, s) => `\x1b[${n}m${s}\x1b[0m`;
const step = (s) => console.log(`\n${c(36, "▶")} ${s}`);
const info = (s) => console.log(`  ${s}`);
const pass = (s) => console.log(c(32, `  ✓ PASS  ${s}`));
const fail = (s) => console.log(c(31, `  ✗ FAIL  ${s}`));
const warn = (s) => console.log(c(33, `  ! WARN  ${s}`));

// ── cache ─────────────────────────────────────────────────────────────
function loadCache() {
  if (RESET && existsSync(CACHE_PATH)) rmSync(CACHE_PATH);
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}
function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");
}
const cache = loadCache();

// ── HTTP helper ───────────────────────────────────────────────────────
async function api(method, path, { token, json, form, query } = {}) {
  let url = `${BASE}${path}`;
  if (query) {
    // Build query manually so dotted keys like `cf.scheduled_dates` survive.
    const qs = query.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    url += `?${qs}`;
  }
  const headers = {};
  let body;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form);
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, url };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── auth ──────────────────────────────────────────────────────────────
async function ensureClientId() {
  if (cache.client_id) return cache.client_id;
  step("Registering OAuth client");
  const res = await api("POST", "/auth/oauth/register", {
    json: {
      client_name: "desk-verify-tool",
      redirect_uris: ["http://localhost/verify"],
      token_endpoint_auth_method: "none",
      grant_types: ["refresh_token", DEVICE_GRANT],
    },
  });
  if (!res.ok || !res.data?.client_id) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  cache.client_id = res.data.client_id;
  saveCache(cache);
  info(`client_id = ${cache.client_id}`);
  return cache.client_id;
}

async function refreshToken(clientId) {
  if (!cache.refresh_token) return null;
  const res = await api("POST", "/auth/oauth/token", {
    form: {
      grant_type: "refresh_token",
      refresh_token: cache.refresh_token,
      client_id: clientId,
    },
  });
  if (!res.ok) return null;
  cache.access_token = res.data.access_token;
  cache.refresh_token = res.data.refresh_token;
  cache.token_expiry = Date.now() + res.data.expires_in * 1000;
  saveCache(cache);
  return cache.access_token;
}

async function deviceFlow(clientId) {
  step("Device authorization (one-time login)");
  const dev = await api("POST", "/auth/oauth/device", {
    form: { client_id: clientId },
  });
  if (!dev.ok) throw new Error(`device auth failed: ${dev.status} ${JSON.stringify(dev.data)}`);
  const { device_code, user_code, verification_uri, verification_uri_complete, interval } = dev.data;
  console.log("");
  console.log(c(35, "  ┌─────────────────────────────────────────────┐"));
  console.log(c(35, `  │  Open:  ${verification_uri}`));
  console.log(c(35, `  │  Code:  ${c(1, user_code)}`));
  console.log(c(35, `  │  Or:    ${verification_uri_complete}`));
  console.log(c(35, "  └─────────────────────────────────────────────┘"));
  info("Waiting for you to approve in the browser…");

  let wait = (interval || 5) * 1000;
  for (;;) {
    await sleep(wait);
    const tok = await api("POST", "/auth/oauth/token", {
      form: { grant_type: DEVICE_GRANT, device_code, client_id: clientId },
    });
    if (tok.ok) {
      cache.access_token = tok.data.access_token;
      cache.refresh_token = tok.data.refresh_token;
      cache.token_expiry = Date.now() + tok.data.expires_in * 1000;
      saveCache(cache);
      pass("authorized");
      return cache.access_token;
    }
    const code = (typeof tok.data?.error === "string" ? tok.data.error : tok.data?.error?.code || "").toLowerCase();
    if (code === "authorization_pending") continue;
    if (code === "slow_down") { wait += 5000; continue; }
    throw new Error(`token exchange failed: ${tok.status} ${JSON.stringify(tok.data)}`);
  }
}

async function ensureToken() {
  const clientId = await ensureClientId();
  if (cache.access_token && cache.token_expiry && Date.now() < cache.token_expiry - 30_000) {
    return cache.access_token;
  }
  const refreshed = await refreshToken(clientId);
  if (refreshed) {
    info("token refreshed");
    return refreshed;
  }
  return deviceFlow(clientId);
}

// ── bootstrap: project + DeskTask type ────────────────────────────────
const CUSTOM_FIELDS = [
  { key: "scheduled_months", type: "string_array" },
  { key: "scheduled_dates", type: "string_array" },
  { key: "unscheduled_month", type: "string" },
  { key: "unscheduled_at", type: "string" },
  { key: "monthly_priority", type: "string" },
  { key: "daily_priority", type: "string" },
  { key: "is_adhoc", type: "string" },
  { key: "done_on", type: "string" },
  { key: "position", type: "string" },
];

async function ensureProjectAndType(token) {
  if (cache.project_id && cache.type_id) {
    info(`reusing project_id=${cache.project_id} type_id=${cache.type_id}`);
    return;
  }
  step("Bootstrapping Desk project + DeskTask type");
  const proj = await api("POST", "/todo/projects", {
    token,
    json: { name: "Desk (verify)" },
  });
  if (!proj.ok || !proj.data?.id) {
    throw new Error(`project create failed: ${proj.status} ${JSON.stringify(proj.data)}`);
  }
  cache.project_id = proj.data.id;
  info(`project_id = ${cache.project_id}`);

  const type = await api("POST", "/todo/types", {
    token,
    json: { label: "DeskTask", project_id: cache.project_id, custom_fields: CUSTOM_FIELDS },
  });
  if (!type.ok || !type.data?.id) {
    throw new Error(`type create failed: ${type.status} ${JSON.stringify(type.data)}`);
  }
  cache.type_id = type.data.id;
  info(`type_id = ${cache.type_id}`);
  saveCache(cache);
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function seedTodo(token, title, scheduledDates, dailyPriority) {
  const res = await api("POST", "/todo/items", {
    token,
    json: {
      title,
      project_id: cache.project_id,
      type_id: cache.type_id,
      custom_fields: {
        scheduled_dates: scheduledDates,
        ...(dailyPriority ? { daily_priority: dailyPriority } : {}),
        is_adhoc: "false",
      },
    },
  });
  if (!res.ok || !res.data?.id) {
    throw new Error(`seed "${title}" failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.id;
}

// ── the actual probes ─────────────────────────────────────────────────
async function run() {
  console.log(c(1, "WSPC live API verification"));
  info(`base = ${BASE}`);
  const token = await ensureToken();

  // whoami sanity check
  step("GET /auth/me (token works)");
  const me = await api("GET", "/auth/me", { token });
  if (me.ok) pass(`logged in as ${me.data.email || me.data.user_id}`);
  else { fail(`/auth/me ${me.status}`); return; }

  await ensureProjectAndType(token);

  const today = isoDate(0);
  const yesterday = isoDate(-1);
  step(`Seeding test todos (today=${today}, yesterday=${yesterday})`);
  const idToday = await seedTodo(token, `verify-today ${today}`, [today], "1");
  const idYesterday = await seedTodo(token, `verify-yesterday ${yesterday}`, [yesterday], "2");
  const idBoth = await seedTodo(token, `verify-both`, [yesterday, today], "3");
  const seeded = [idToday, idYesterday, idBoth];
  info(`seeded ${seeded.length} todos`);

  const results = [];

  // PROBE 1: dotted cf filter — the syntax llms.txt documents
  step(`PROBE 1 — GET /todo/items?cf.scheduled_dates=${today} (dotted, contains-match)`);
  const p1 = await api("GET", "/todo/items", {
    token,
    query: [["project_id", cache.project_id], ["cf.scheduled_dates", today]],
  });
  if (p1.ok) {
    const ids = (p1.data.todos || []).map((t) => t.id);
    const hasToday = ids.includes(idToday);
    const hasBoth = ids.includes(idBoth);
    const hasYesterday = ids.includes(idYesterday);
    info(`returned ${ids.length} todos`);
    if (hasToday && hasBoth && !hasYesterday) {
      pass("cf.scheduled_dates does a real array-contains filter (today + both, excludes yesterday)");
      results.push(["cf dotted contains-filter", "WORKS"]);
    } else if (ids.length === seeded.length || (hasYesterday && hasToday)) {
      warn("filter returned everything — cf may be IGNORED (treated as unknown param)");
      results.push(["cf dotted contains-filter", "IGNORED (returns all)"]);
    } else {
      warn(`unexpected set: today=${hasToday} both=${hasBoth} yesterday=${hasYesterday}`);
      results.push(["cf dotted contains-filter", "UNEXPECTED"]);
    }
  } else {
    fail(`HTTP ${p1.status}: ${JSON.stringify(p1.data)}`);
    results.push(["cf dotted contains-filter", `HTTP ${p1.status}`]);
  }

  // PROBE 2: bracket cf syntax fallback
  step(`PROBE 2 — bracket syntax cf[scheduled_dates]=${today}`);
  const p2 = await api("GET", "/todo/items", {
    token,
    query: [["project_id", cache.project_id], ["cf[scheduled_dates]", today]],
  });
  if (p2.ok) {
    const ids = (p2.data.todos || []).map((t) => t.id);
    const exact = ids.includes(idToday) && ids.includes(idBoth) && !ids.includes(idYesterday);
    info(`returned ${ids.length} todos — ${exact ? "filtered" : "not filtered / different"}`);
    results.push(["cf bracket syntax", exact ? "WORKS" : "ignored/different"]);
  } else {
    info(`HTTP ${p2.status}`);
    results.push(["cf bracket syntax", `HTTP ${p2.status}`]);
  }

  // PROBE 3: undeclared cf field should 422
  step("PROBE 3 — cf.not_a_field=x (expect 422 for undeclared field)");
  const p3 = await api("GET", "/todo/items", {
    token,
    query: [["project_id", cache.project_id], ["cf.not_a_field", "x"]],
  });
  info(`HTTP ${p3.status} ${p3.ok ? "(accepted)" : JSON.stringify(p3.data)?.slice(0, 120)}`);
  results.push(["undeclared cf → 422", p3.status === 422 ? "YES (validated)" : `no (${p3.status})`]);

  // PROBE 4: sort_by cf.<string-key>
  step("PROBE 4 — sort_by=cf.daily_priority&order=asc (string cf sort)");
  const p4 = await api("GET", "/todo/items", {
    token,
    query: [["project_id", cache.project_id], ["sort_by", "cf.daily_priority"], ["order", "asc"]],
  });
  if (p4.ok) {
    const prio = (p4.data.todos || []).map((t) => t.custom_fields?.daily_priority);
    info(`order = [${prio.join(", ")}]`);
    results.push(["sort_by cf.daily_priority", "WORKS"]);
  } else {
    info(`HTTP ${p4.status}: ${JSON.stringify(p4.data)?.slice(0, 120)}`);
    results.push(["sort_by cf.daily_priority", `HTTP ${p4.status}`]);
  }

  // PROBE 5: sort_by a string_array cf should 422
  step("PROBE 5 — sort_by=cf.scheduled_dates (string_array, expect 422)");
  const p5 = await api("GET", "/todo/items", {
    token,
    query: [["project_id", cache.project_id], ["sort_by", "cf.scheduled_dates"]],
  });
  info(`HTTP ${p5.status}`);
  results.push(["sort_by string_array cf → 422", p5.status === 422 ? "YES" : `no (${p5.status})`]);

  // cleanup
  if (!KEEP) {
    step("Cleanup — soft-deleting seeded test todos");
    for (const id of seeded) {
      const d = await api("DELETE", `/todo/items/${id}`, { token });
      info(`delete ${id}: ${d.status}`);
    }
  } else {
    warn("--keep set: leaving seeded todos in place");
  }

  // summary
  console.log(c(1, "\n══ SUMMARY ══"));
  for (const [k, v] of results) {
    const good = /WORKS|YES/.test(v);
    console.log(`  ${good ? c(32, "✓") : c(33, "•")} ${k.padEnd(34)} ${v}`);
  }
  console.log("");
  info("Decision input: if PROBE 1 = WORKS, the BFF can push `scheduled_dates contains today`");
  info("filtering to WSPC (thick-BFF design B). If IGNORED, fall back to client-side filtering.");
}

run().catch((e) => {
  fail(e.message);
  process.exit(1);
});
