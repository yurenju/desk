# Slice 2a — Auth + BFF 骨架 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標**：把 WSPC OAuth 2.1 device flow、`__Host-Session` cookie、KV 上的 session、token 自動刷新中間件接起來，並用 `/api/me` 驗證 token 真的能授權打 WSPC。

**架構**：單一 Cloudflare Worker 同時 serve 前端 assets 與 `/api/*` 路由。Auth 狀態用 KV 上的 `session:<id>`（cookie 只放隨機 id），device flow polling state 也放 KV。前端只動 `/login` 路由、`useAuthStore`、`TopNav` 上的登入狀態顯示，Today / Plan / Backlog 完全不碰。

**技術棧**：Cloudflare Workers、Wrangler、TypeScript、TanStack Router（檔案路由）、Zustand、Vitest（jsdom 環境）、`crypto.getRandomValues`、`openapi-typescript`（純型別產生，不引入 runtime client）。

**設計文件**：[docs/superpowers/specs/2026-05-30-slice-2a-auth-bff-design.md](docs/superpowers/specs/2026-05-30-slice-2a-auth-bff-design.md)

---

## 檔案結構

實作過程會建立 / 修改下列檔案：

### Worker 端

| 檔案 | 動作 | 責任 |
|---|---|---|
| `wrangler.jsonc` | 修改 | 新增 `kv_namespaces` 綁定 `DESK_KV` |
| `worker-configuration.d.ts` | 重生 | `wrangler types` 後自動更新 Env 型別 |
| `spec/wspc-openapi.json` | 新增 | WSPC OpenAPI 的本機 snapshot，由 `npm run wspc:sync` 更新 |
| `scripts/sync-wspc-spec.ts` | 新增 | 從 `https://api.wspc.ai/openapi.json` 拉新版覆寫 snapshot |
| `worker/wspc-types.ts` | 新增（生成） | 由 `openapi-typescript` 從 snapshot 產出的 `paths` / `components` 型別 |
| `package.json` | 修改 | 新增 `openapi-typescript` devDependency、`wspc:sync` / `wspc:generate` scripts |
| `worker/random.ts` | 新增 | 256-bit 隨機字串（base64url），給 session id / polling id 用 |
| `worker/random.test.ts` | 新增 | random.ts 的單元測試 |
| `worker/cookie.ts` | 新增 | `__Host-Session` cookie 解析 / 序列化 / 清除 |
| `worker/cookie.test.ts` | 新增 | cookie.ts 的單元測試 |
| `worker/wspc.ts` | 新增 | WSPC API client（4 個端點：register / device / token / me） |
| `worker/wspc.test.ts` | 新增 | wspc.ts 的單元測試（mocked fetch） |
| `worker/kv.ts` | 新增 | KV 操作（client_id / session / device 三類 key） |
| `worker/kv.test.ts` | 新增 | kv.ts 的單元測試（Map-based KV stub） |
| `worker/middleware/session.ts` | 新增 | Session 中間件（cookie → KV → 自動 refresh） |
| `worker/middleware/session.test.ts` | 新增 | 中間件單元測試 |
| `worker/routes/auth.ts` | 新增 | `/api/auth/login`、`/api/auth/status`、`/api/auth/logout` |
| `worker/routes/auth.test.ts` | 新增 | auth 路由單元測試 |
| `worker/routes/me.ts` | 新增 | `/api/me`（過 session 中間件、呼叫 WSPC `/auth/me`） |
| `worker/routes/me.test.ts` | 新增 | me 路由單元測試 |
| `worker/index.ts` | 修改 | Route dispatcher：路由到對應的 handler |

### Frontend 端

| 檔案 | 動作 | 責任 |
|---|---|---|
| `src/store/auth.ts` | 新增 | Zustand `useAuthStore`：登入狀態、`fetchMe()` 動作 |
| `src/store/auth.test.ts` | 新增 | auth store 單元測試 |
| `src/pages/LoginPage.tsx` | 新增 | Login 頁面元件：呼叫 `/api/auth/login`、顯示 user_code、輪詢 `/api/auth/status` |
| `src/pages/LoginPage.test.tsx` | 新增 | LoginPage 單元測試 |
| `src/routes/login.tsx` | 新增 | TanStack 檔案路由，掛載 `LoginPage` |
| `src/features/shell/AuthMenu.tsx` | 新增 | 未登入：「登入 WSPC」按鈕；已登入：display_name + 登出 |
| `src/features/shell/AuthMenu.test.tsx` | 新增 | AuthMenu 單元測試 |
| `src/features/shell/TopNav.tsx` | 修改 | 把 `AuthMenu` 加進 `.actions` 區 |
| `src/app.tsx`（或 `__root.tsx`） | 修改 | App 啟動時觸發一次 `useAuthStore.fetchMe()` |

### Helper（測試用）

| 檔案 | 動作 | 責任 |
|---|---|---|
| `worker/test-helpers/kv-stub.ts` | 新增 | Map-based `KVNamespace` stub，給 worker 測試共用 |

---

## Task 1：建立 KV namespace 與更新 wrangler.jsonc

**檔案**：
- 修改：`wrangler.jsonc`
- 重生：`worker-configuration.d.ts`（透過 `wrangler types` 指令）

這是 infra 任務，沒有 TDD 對應的單元測試，但要驗證 `wrangler types` 重新產生後 `Env` 介面有 `DESK_KV` 欄位。

- [ ] **Step 1：建立 production KV namespace**

```
wrangler kv namespace create DESK_KV
```

預期輸出含 `id`：

```
🌀 Creating namespace with title "DESK_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
[[kv_namespaces]]
binding = "DESK_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

把這個 `id` 記下來，下一步要填進 `wrangler.jsonc`。

- [ ] **Step 2：建立 preview KV namespace（本機 / preview 環境用）**

```
wrangler kv namespace create DESK_KV --preview
```

把回傳的 `preview_id` 記下來。

- [ ] **Step 3：修改 `wrangler.jsonc`**

把 `kv_namespaces` 區塊加到 root 物件裡，跟現有 `assets` / `routes` 同層：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "desk",
  "compatibility_date": "2026-05-26",
  "main": "./worker/index.ts",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "routes": [
    { "pattern": "desk.yurenju.me", "custom_domain": true }
  ],
  "kv_namespaces": [
    {
      "binding": "DESK_KV",
      "id": "<step 1 拿到的 id>",
      "preview_id": "<step 2 拿到的 preview_id>"
    }
  ]
}
```

- [ ] **Step 4：重新產生 Env 型別**

```
npm run cf-typegen
```

預期 `worker-configuration.d.ts` 重生，內部會出現 `DESK_KV: KVNamespace` 欄位。

- [ ] **Step 5：驗證 type check 通過**

```
npx tsc --noEmit
```

預期：通過。

- [ ] **Step 6：Commit**

```
git add wrangler.jsonc worker-configuration.d.ts
git commit -m "feat(infra): add DESK_KV namespace binding"
```

---

## Task 2：WSPC OpenAPI snapshot 與 TypeScript 型別產生

**檔案**：
- 新增：`spec/wspc-openapi.json`（WSPC OpenAPI 的本機快照）
- 新增：`scripts/sync-wspc-spec.ts`（拉最新 OpenAPI 的 script）
- 新增：`worker/wspc-types.ts`（由 `openapi-typescript` 從 snapshot 產生的型別檔）
- 修改：`package.json`（新增 devDependency 與 npm scripts）

這個 task 把 WSPC OpenAPI snapshot 進 repo 並產生 TypeScript 型別給 `worker/wspc.ts` 使用。採模式 B：純型別 + 手寫 fetch，不引入 runtime client library。Auth 部分仍會手寫狀態機（device flow polling 的錯誤分支 OpenAPI 沒 model，type generation 幫不上）。

- [ ] **Step 1：安裝 `openapi-typescript`**

```
npm install --save-dev openapi-typescript
```

預期：`package.json` 的 `devDependencies` 多一條 `openapi-typescript`。

- [ ] **Step 2：寫 sync script**

`scripts/sync-wspc-spec.ts`：

```ts
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
```

- [ ] **Step 3：在 `package.json` 加入 scripts**

```jsonc
{
  "scripts": {
    "wspc:sync": "tsx scripts/sync-wspc-spec.ts",
    "wspc:generate": "openapi-typescript spec/wspc-openapi.json -o worker/wspc-types.ts"
  }
}
```

`tsx` 通常已在 devDependencies；若沒有，這步順手 `npm install --save-dev tsx`。兩個 script 故意分開：`sync` 才會打 wspc.ai，`generate` 只讀本機 snapshot。

- [ ] **Step 4：建立 spec 目錄並拉 OpenAPI、產型別**

```
mkdir -p spec
npm run wspc:sync
npm run wspc:generate
```

預期：
- `spec/wspc-openapi.json` 出現（約 280KB，內容是 WSPC OpenAPI）
- `worker/wspc-types.ts` 出現（含 `paths` 與 `components` 兩個 exported types）

- [ ] **Step 5：驗證型別檔合法 + schema name 確認**

```
npx tsc --noEmit
```

預期：通過。

接著開 `worker/wspc-types.ts`，確認以下 schema name 存在（後續 task 會引用）：

- `components["schemas"]["OAuthRegisterResponse"]`
- `components["schemas"]["OAuthDeviceResponse"]`
- `components["schemas"]["OAuthTokenResponse"]`
- `components["schemas"]["GetMeResponse"]`

若 WSPC 把名字改了（例如 `OAuthTokenResponse` 變成 `TokenResponse`），記下實際 name，後續 task 的 import 要對應修正。

- [ ] **Step 6：Commit**

```
git add spec/wspc-openapi.json worker/wspc-types.ts scripts/sync-wspc-spec.ts package.json package-lock.json
git commit -m "feat: snapshot WSPC OpenAPI and generate TypeScript types"
```

---

## Task 3：Random id 工具

**檔案**：
- 新增：`worker/random.ts`
- 新增：`worker/random.test.ts`

提供 256-bit 隨機字串（base64url 編碼），用來產生 session id 與 device polling id。

- [ ] **Step 1：寫失敗的測試**

`worker/random.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { randomBase64UrlId } from "./random";

describe("randomBase64UrlId", () => {
  it("returns a 43-character base64url string for 32 bytes input", () => {
    const id = randomBase64UrlId(32);
    expect(id).toHaveLength(43);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces different values across calls", () => {
    const a = randomBase64UrlId(32);
    const b = randomBase64UrlId(32);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/random.test.ts
```

預期：FAIL，`randomBase64UrlId is not a function`。

- [ ] **Step 3：最小實作**

`worker/random.ts`：

```ts
export function randomBase64UrlId(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/random.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/random.ts worker/random.test.ts
git commit -m "feat(worker): add base64url random id utility"
```

---

## Task 4：Cookie 工具

**檔案**：
- 新增：`worker/cookie.ts`
- 新增：`worker/cookie.test.ts`

提供 `__Host-Session` cookie 的解析、序列化、清除。

- [ ] **Step 1：寫失敗的測試**

`worker/cookie.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { parseSessionId, serializeSessionCookie, clearSessionCookie } from "./cookie";

describe("parseSessionId", () => {
  it("returns the session id when cookie is present", () => {
    const headers = new Headers({ Cookie: "__Host-Session=abc123; theme=light" });
    expect(parseSessionId(headers)).toBe("abc123");
  });

  it("returns null when Cookie header is missing", () => {
    const headers = new Headers();
    expect(parseSessionId(headers)).toBeNull();
  });

  it("returns null when __Host-Session is not present", () => {
    const headers = new Headers({ Cookie: "theme=light" });
    expect(parseSessionId(headers)).toBeNull();
  });
});

describe("serializeSessionCookie", () => {
  it("includes all required attributes", () => {
    const cookie = serializeSessionCookie("abc123");
    expect(cookie).toContain("__Host-Session=abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
  });
});

describe("clearSessionCookie", () => {
  it("sets Max-Age=0 to clear the cookie", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("__Host-Session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/cookie.test.ts
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`worker/cookie.ts`：

```ts
const COOKIE_NAME = "__Host-Session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function parseSessionId(headers: Headers): string | null {
  const raw = headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

export function serializeSessionCookie(id: string): string {
  return [
    `${COOKIE_NAME}=${id}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/cookie.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/cookie.ts worker/cookie.test.ts
git commit -m "feat(worker): add session cookie utilities"
```

---

## Task 5：WSPC client — Dynamic Client Registration

**檔案**：
- 新增：`worker/wspc.ts`
- 新增：`worker/wspc.test.ts`

實作對 WSPC `POST /auth/oauth/register` 的呼叫，從回傳取 `client_id`。Register 用 JSON body（RFC 7591），request 與 response 形狀都從 `worker/wspc-types.ts`（Task 2 產生）取型別。

**關鍵欄位**：必須顯式帶 `grant_types`（含 device_code grant）與 `token_endpoint_auth_method: "none"`。WSPC OpenAPI 的預設 `grant_types` 不含 device_code，不帶會讓後續 device flow 被拒絕。

- [ ] **Step 1：寫失敗的測試**

`worker/wspc.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerClient } from "./wspc";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerClient", () => {
  it("POSTs to /auth/oauth/register with required fields and returns client_id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          client_id: "test-client-id",
          client_name: "desk.yurenju.me",
          redirect_uris: ["https://desk.yurenju.me/login"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const clientId = await registerClient({
      clientName: "desk.yurenju.me",
      redirectUris: ["https://desk.yurenju.me/login"],
    });

    expect(clientId).toBe("test-client-id");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.wspc.ai/auth/oauth/register",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      client_name: "desk.yurenju.me",
      redirect_uris: ["https://desk.yurenju.me/login"],
      token_endpoint_auth_method: "none",
      grant_types: [
        "refresh_token",
        "urn:ietf:params:oauth:grant-type:device_code",
      ],
    });
  });

  it("throws when WSPC responds non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("internal error", { status: 500 }),
    );
    await expect(
      registerClient({ clientName: "x", redirectUris: ["https://x"] }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/wspc.test.ts
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`worker/wspc.ts`：

```ts
import type { components } from "./wspc-types";

const WSPC_BASE = "https://api.wspc.ai";

type RegisterResponse = components["schemas"]["OAuthRegisterResponse"];

export interface RegisterClientInput {
  clientName: string;
  redirectUris: string[];
}

export async function registerClient(input: RegisterClientInput): Promise<string> {
  const res = await fetch(`${WSPC_BASE}/auth/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: input.clientName,
      redirect_uris: input.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: [
        "refresh_token",
        "urn:ietf:params:oauth:grant-type:device_code",
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`WSPC register failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as RegisterResponse;
  return data.client_id;
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/wspc.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/wspc.ts worker/wspc.test.ts
git commit -m "feat(worker): add WSPC client registration"
```

---

## Task 6：WSPC client — Device Authorization

**檔案**：
- 修改：`worker/wspc.ts`
- 修改：`worker/wspc.test.ts`

實作 `POST /auth/oauth/device`，回傳 device_code、user_code、verification_uri_complete 等。

**Request encoding**：`application/x-www-form-urlencoded`（RFC 8628），body 用 `URLSearchParams` 構造。Response 仍是 JSON。

- [ ] **Step 1：在 `worker/wspc.test.ts` 加入新測試**

```ts
import { requestDeviceAuthorization } from "./wspc";

describe("requestDeviceAuthorization", () => {
  it("POSTs to /auth/oauth/device with form-urlencoded client_id and returns device flow info", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          device_code: "dev-code",
          user_code: "ABCD-1234",
          verification_uri: "https://app.wspc.ai/device",
          verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD-1234",
          expires_in: 600,
          interval: 5,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await requestDeviceAuthorization("client-123");

    expect(result).toEqual({
      deviceCode: "dev-code",
      userCode: "ABCD-1234",
      verificationUri: "https://app.wspc.ai/device",
      verificationUriComplete: "https://app.wspc.ai/device?user_code=ABCD-1234",
      expiresIn: 600,
      interval: 5,
    });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("client_id")).toBe("client-123");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/wspc.test.ts
```

預期：新增的測試 FAIL，舊測試仍 PASS。

- [ ] **Step 3：在 `worker/wspc.ts` 加入實作**

```ts
type DeviceResponse = components["schemas"]["OAuthDeviceResponse"];

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export async function requestDeviceAuthorization(clientId: string): Promise<DeviceAuthorization> {
  const res = await fetch(`${WSPC_BASE}/auth/oauth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId }),
  });
  if (!res.ok) {
    throw new Error(`WSPC device authorization failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as DeviceResponse;
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    verificationUriComplete: data.verification_uri_complete,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/wspc.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/wspc.ts worker/wspc.test.ts
git commit -m "feat(worker): add WSPC device authorization"
```

---

## Task 7：WSPC client — Token Exchange（device flow + refresh）

**檔案**：
- 修改：`worker/wspc.ts`
- 修改：`worker/wspc.test.ts`

實作 `POST /auth/oauth/token` 的兩種 grant：device_code grant 跟 refresh_token grant。

**Request encoding**：`application/x-www-form-urlencoded`（RFC 6749），用 `URLSearchParams`。

**錯誤處理**：Device flow polling 期間 WSPC 可能回 `authorization_pending`、`slow_down`、`access_denied`、`expired_token`。**WSPC error response 形狀有兩種**：

```
# 形狀 A — RFC 8628 字串
{ "error": "authorization_pending" }

# 形狀 B — WSPC envelope（uppercase code）
{ "error": { "code": "AUTHORIZATION_PENDING", "message": "..." } }
```

實作要兩種都接：判斷 `error` 欄位型別、取出 code、`toLowerCase()` 再比對。這個邏輯抽成 helper 共用。

- [ ] **Step 1：在 `worker/wspc.test.ts` 加入新測試**

```ts
import { exchangeDeviceCode, refreshAccessToken } from "./wspc";

describe("exchangeDeviceCode", () => {
  it("returns { status: 'success', tokens } when WSPC issues tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at-1",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token: "rt-1",
          scope: "wspc:full",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({
      status: "success",
      tokens: {
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiresIn: 900,
      },
    });
  });

  it("sends form-urlencoded body with device_code grant", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 }),
    );
    await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
    expect(body.get("device_code")).toBe("dc-1");
    expect(body.get("client_id")).toBe("c1");
  });

  it("returns { status: 'pending' } on RFC 8628 string error authorization_pending", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "pending" });
  });

  it("returns { status: 'pending' } on WSPC envelope { error: { code: 'AUTHORIZATION_PENDING' } }", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTHORIZATION_PENDING", message: "wait" } }),
        { status: 400 },
      ),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "pending" });
  });

  it("returns { status: 'slow_down' } on slow_down (string form)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "slow_down" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "slow_down" });
  });

  it("returns { status: 'slow_down' } on envelope form SLOW_DOWN", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "SLOW_DOWN" } }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "slow_down" });
  });

  it("returns { status: 'denied' } on access_denied", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "access_denied" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "denied" });
  });

  it("returns { status: 'expired' } on expired_token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "expired_token" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "expired" });
  });

  it("throws on unknown error code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "weird_error" }), { status: 400 }),
    );
    await expect(
      exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" }),
    ).rejects.toThrow();
  });
});

describe("refreshAccessToken", () => {
  it("POSTs form-urlencoded body with refresh_token grant and returns new tokens", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at-2",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token: "rt-2",
          scope: "wspc:full",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const tokens = await refreshAccessToken({ clientId: "c1", refreshToken: "rt-1" });
    expect(tokens).toEqual({ accessToken: "at-2", refreshToken: "rt-2", expiresIn: 900 });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-1");
    expect(body.get("client_id")).toBe("c1");
  });

  it("throws when refresh fails (e.g. refresh_token expired)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    await expect(
      refreshAccessToken({ clientId: "c1", refreshToken: "rt-bad" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/wspc.test.ts
```

預期：新增測試 FAIL。

- [ ] **Step 3：在 `worker/wspc.ts` 加入實作**

```ts
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

type TokenResponse = components["schemas"]["OAuthTokenResponse"];

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type ExchangeDeviceCodeResult =
  | { status: "success"; tokens: TokenBundle }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "denied" }
  | { status: "expired" };

// WSPC may return either RFC 8628 string form { error: "authorization_pending" }
// or wspc envelope form { error: { code: "AUTHORIZATION_PENDING", message } }.
// Normalize both into a lowercase code.
function extractOAuthErrorCode(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string") return err.toLowerCase();
  if (typeof err === "object" && err !== null) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code.toLowerCase();
  }
  return "";
}

export async function exchangeDeviceCode(input: {
  clientId: string;
  deviceCode: string;
}): Promise<ExchangeDeviceCodeResult> {
  const res = await fetch(`${WSPC_BASE}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: DEVICE_CODE_GRANT,
      device_code: input.deviceCode,
      client_id: input.clientId,
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as TokenResponse;
    return {
      status: "success",
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      },
    };
  }

  const body = await res.json().catch(() => ({}));
  const code = extractOAuthErrorCode(body);
  switch (code) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "slow_down" };
    case "access_denied":
      return { status: "denied" };
    case "expired_token":
      return { status: "expired" };
    default:
      throw new Error(
        `WSPC token exchange failed: ${res.status} ${JSON.stringify(body)}`,
      );
  }
}

export async function refreshAccessToken(input: {
  clientId: string;
  refreshToken: string;
}): Promise<TokenBundle> {
  const res = await fetch(`${WSPC_BASE}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    }),
  });
  if (!res.ok) {
    throw new Error(`WSPC token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/wspc.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/wspc.ts worker/wspc.test.ts
git commit -m "feat(worker): add WSPC token exchange (device + refresh grants)"
```

---

## Task 8：WSPC client — Whoami

**檔案**：
- 修改：`worker/wspc.ts`
- 修改：`worker/wspc.test.ts`

實作 `GET /auth/me`，帶 `Bearer` access token，回傳 `{ user_id, email, display_name }`。

- [ ] **Step 1：在 `worker/wspc.test.ts` 加入新測試**

```ts
import { getWhoami } from "./wspc";

describe("getWhoami", () => {
  it("GETs /auth/me with Bearer token and returns user info", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "u-1",
          email: "test@example.com",
          display_name: "Test User",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const me = await getWhoami("at-1");
    expect(me).toEqual({
      userId: "u-1",
      email: "test@example.com",
      displayName: "Test User",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.wspc.ai/auth/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer at-1" }),
      }),
    );
  });

  it("handles missing display_name (undefined)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ user_id: "u-1", email: "test@example.com" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const me = await getWhoami("at-1");
    expect(me.displayName).toBeUndefined();
  });

  it("throws on 401 (caller decides what to do)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 }),
    );
    await expect(getWhoami("at-bad")).rejects.toThrow();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/wspc.test.ts
```

預期：新增測試 FAIL。

- [ ] **Step 3：在 `worker/wspc.ts` 加入實作**

```ts
type WhoamiResponse = components["schemas"]["GetMeResponse"];

export interface Whoami {
  userId: string;
  email: string;
  displayName?: string;
}

export async function getWhoami(accessToken: string): Promise<Whoami> {
  const res = await fetch(`${WSPC_BASE}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`WSPC whoami failed: ${res.status}`);
  }
  const data = (await res.json()) as WhoamiResponse;
  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
  };
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/wspc.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/wspc.ts worker/wspc.test.ts
git commit -m "feat(worker): add WSPC whoami"
```

---

## Task 9：KV stub 與 client_id 操作

**檔案**：
- 新增：`worker/test-helpers/kv-stub.ts`
- 新增：`worker/kv.ts`
- 新增：`worker/kv.test.ts`

先把 KV stub 寫出來（後續所有 KV 測試都用），再實作 client_id 的 get / set / `ensureClientId`（lazy 註冊）。

- [ ] **Step 1：寫 KV stub**

`worker/test-helpers/kv-stub.ts`：

```ts
import type { KVNamespace } from "@cloudflare/workers-types";

interface Entry {
  value: string;
  expiresAt?: number;
}

export function makeKvStub(): KVNamespace {
  const store = new Map<string, Entry>();

  const stub = {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ): Promise<void> {
      const expiresAt =
        options?.expirationTtl !== undefined
          ? Date.now() + options.expirationTtl * 1000
          : undefined;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };

  return stub as unknown as KVNamespace;
}
```

- [ ] **Step 2：寫失敗的測試**

`worker/kv.test.ts`：

```ts
import { describe, it, expect, vi } from "vitest";
import { makeKvStub } from "./test-helpers/kv-stub";
import { getClientId, ensureClientId } from "./kv";
import * as wspc from "./wspc";

describe("getClientId", () => {
  it("returns the value from KV when present", async () => {
    const kv = makeKvStub();
    await kv.put("wspc:client_id", "cached-id");
    expect(await getClientId(kv)).toBe("cached-id");
  });

  it("returns null when KV is empty", async () => {
    const kv = makeKvStub();
    expect(await getClientId(kv)).toBeNull();
  });
});

describe("ensureClientId", () => {
  it("returns cached id without calling register", async () => {
    const kv = makeKvStub();
    await kv.put("wspc:client_id", "cached-id");
    const spy = vi.spyOn(wspc, "registerClient");
    expect(await ensureClientId(kv)).toBe("cached-id");
    expect(spy).not.toHaveBeenCalled();
  });

  it("registers a new client and caches it when KV is empty", async () => {
    const kv = makeKvStub();
    const spy = vi.spyOn(wspc, "registerClient").mockResolvedValue("new-id");
    const result = await ensureClientId(kv);
    expect(result).toBe("new-id");
    expect(await kv.get("wspc:client_id")).toBe("new-id");
    expect(spy).toHaveBeenCalledWith({
      clientName: "desk.yurenju.me",
      redirectUris: ["https://desk.yurenju.me/login"],
    });
  });
});
```

- [ ] **Step 3：跑測試確認失敗**

```
npx vitest run worker/kv.test.ts
```

預期：FAIL。

- [ ] **Step 4：最小實作**

`worker/kv.ts`：

```ts
import type { KVNamespace } from "@cloudflare/workers-types";
import { registerClient } from "./wspc";

const CLIENT_ID_KEY = "wspc:client_id";

export async function getClientId(kv: KVNamespace): Promise<string | null> {
  return kv.get(CLIENT_ID_KEY);
}

export async function ensureClientId(kv: KVNamespace): Promise<string> {
  const existing = await kv.get(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = await registerClient({
    clientName: "desk.yurenju.me",
    redirectUris: ["https://desk.yurenju.me/login"],
  });
  await kv.put(CLIENT_ID_KEY, id);
  return id;
}
```

- [ ] **Step 5：跑測試確認通過**

```
npx vitest run worker/kv.test.ts
```

預期：PASS。

- [ ] **Step 6：Commit**

```
git add worker/test-helpers/kv-stub.ts worker/kv.ts worker/kv.test.ts
git commit -m "feat(worker): add KV stub and client_id operations"
```

---

## Task 10：KV session 操作

**檔案**：
- 修改：`worker/kv.ts`
- 修改：`worker/kv.test.ts`

實作 session 的 get / put / delete。Value 是 JSON `{ accessToken, refreshToken, accessExp }`，TTL 30 天。

- [ ] **Step 1：在 `worker/kv.test.ts` 加入新測試**

```ts
import { getSession, putSession, deleteSession } from "./kv";

describe("session operations", () => {
  it("putSession writes JSON with 30-day TTL, getSession reads it back", async () => {
    const kv = makeKvStub();
    const session = {
      accessToken: "at-1",
      refreshToken: "rt-1",
      accessExp: 1234567890,
    };
    await putSession(kv, "sid-1", session);

    const raw = await kv.get("session:sid-1");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(session);

    expect(await getSession(kv, "sid-1")).toEqual(session);
  });

  it("getSession returns null when not present", async () => {
    const kv = makeKvStub();
    expect(await getSession(kv, "missing")).toBeNull();
  });

  it("getSession returns null when JSON parse fails", async () => {
    const kv = makeKvStub();
    await kv.put("session:bad", "not-json{");
    expect(await getSession(kv, "bad")).toBeNull();
  });

  it("deleteSession removes the entry", async () => {
    const kv = makeKvStub();
    await putSession(kv, "sid-1", {
      accessToken: "at",
      refreshToken: "rt",
      accessExp: 1,
    });
    await deleteSession(kv, "sid-1");
    expect(await getSession(kv, "sid-1")).toBeNull();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/kv.test.ts
```

預期：FAIL。

- [ ] **Step 3：在 `worker/kv.ts` 加入實作**

```ts
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  accessExp: number; // unix seconds
}

export async function getSession(
  kv: KVNamespace,
  id: string,
): Promise<SessionData | null> {
  const raw = await kv.get(`session:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function putSession(
  kv: KVNamespace,
  id: string,
  data: SessionData,
): Promise<void> {
  await kv.put(`session:${id}`, JSON.stringify(data), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(kv: KVNamespace, id: string): Promise<void> {
  await kv.delete(`session:${id}`);
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/kv.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/kv.ts worker/kv.test.ts
git commit -m "feat(worker): add KV session operations"
```

---

## Task 11：KV device polling 操作

**檔案**：
- 修改：`worker/kv.ts`
- 修改：`worker/kv.test.ts`

實作 device polling state 的 get / put（含 TTL）/ delete。

- [ ] **Step 1：在 `worker/kv.test.ts` 加入新測試**

```ts
import { getDevice, putDevice, deleteDevice } from "./kv";

describe("device polling operations", () => {
  it("putDevice writes JSON with custom TTL", async () => {
    const kv = makeKvStub();
    await putDevice(
      kv,
      "pid-1",
      { deviceCode: "dc-1", interval: 5 },
      600,
    );
    expect(await getDevice(kv, "pid-1")).toEqual({
      deviceCode: "dc-1",
      interval: 5,
    });
  });

  it("getDevice returns null when missing", async () => {
    const kv = makeKvStub();
    expect(await getDevice(kv, "missing")).toBeNull();
  });

  it("deleteDevice removes the entry", async () => {
    const kv = makeKvStub();
    await putDevice(kv, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    await deleteDevice(kv, "pid-1");
    expect(await getDevice(kv, "pid-1")).toBeNull();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/kv.test.ts
```

預期：FAIL。

- [ ] **Step 3：在 `worker/kv.ts` 加入實作**

```ts
export interface DeviceData {
  deviceCode: string;
  interval: number;
}

export async function getDevice(
  kv: KVNamespace,
  pollingId: string,
): Promise<DeviceData | null> {
  const raw = await kv.get(`device:${pollingId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceData;
  } catch {
    return null;
  }
}

export async function putDevice(
  kv: KVNamespace,
  pollingId: string,
  data: DeviceData,
  ttlSeconds: number,
): Promise<void> {
  await kv.put(`device:${pollingId}`, JSON.stringify(data), {
    expirationTtl: ttlSeconds,
  });
}

export async function deleteDevice(kv: KVNamespace, pollingId: string): Promise<void> {
  await kv.delete(`device:${pollingId}`);
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/kv.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/kv.ts worker/kv.test.ts
git commit -m "feat(worker): add KV device polling operations"
```

---

## Task 12：Session 中間件

**檔案**：
- 新增：`worker/middleware/session.ts`
- 新增：`worker/middleware/session.test.ts`

`withSession(request, env, handler)`：

- 讀 cookie → 沒有就 401
- 查 KV `session:<id>` → 沒有就清 cookie + 401
- 檢查 `accessExp - now`：足夠就直接呼叫 handler；不足或 < 30 秒就 refresh
- Refresh 成功：寫回 KV，呼叫 handler
- Refresh 失敗：刪 session + 清 cookie + 401

Handler 介面：`(accessToken: string) => Promise<Response>`。

- [ ] **Step 1：寫失敗的測試**

`worker/middleware/session.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { putSession, getSession } from "../kv";
import { withSession } from "./session";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: import("@cloudflare/workers-types").KVNamespace };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("withSession", () => {
  it("returns 401 when cookie is missing", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/me");
    const res = await withSession(req, env, async () => new Response("ok"));
    expect(res.status).toBe(401);
  });

  it("returns 401 and clears cookie when KV has no matching session", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=ghost" },
    });
    const res = await withSession(req, env, async () => new Response("ok"));
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("calls handler with access_token when session is valid and not near expiry", async () => {
    const env = makeEnv();
    const futureExp = Math.floor(Date.now() / 1000) + 600;
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-1",
      refreshToken: "rt-1",
      accessExp: futureExp,
    });
    vi.spyOn(env.DESK_KV, "put"); // ensure we don't refresh

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const handler = vi.fn(async (token: string) => new Response(token));
    const res = await withSession(req, env, handler);

    expect(handler).toHaveBeenCalledWith("at-1");
    expect(await res.text()).toBe("at-1");
  });

  it("refreshes when access token is close to expiry, writes back, calls handler", async () => {
    const env = makeEnv();
    const nearExp = Math.floor(Date.now() / 1000) + 10; // 10s left
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-old",
      refreshToken: "rt-old",
      accessExp: nearExp,
    });
    await env.DESK_KV.put("wspc:client_id", "client-1");
    vi.spyOn(wspc, "refreshAccessToken").mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 900,
    });

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const handler = vi.fn(async (token: string) => new Response(token));
    const res = await withSession(req, env, handler);

    expect(handler).toHaveBeenCalledWith("at-new");
    expect(await res.text()).toBe("at-new");
    const stored = await getSession(env.DESK_KV, "sid-1");
    expect(stored?.accessToken).toBe("at-new");
    expect(stored?.refreshToken).toBe("rt-new");
  });

  it("returns 401 and deletes session when refresh fails", async () => {
    const env = makeEnv();
    const nearExp = Math.floor(Date.now() / 1000) + 10;
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-old",
      refreshToken: "rt-bad",
      accessExp: nearExp,
    });
    await env.DESK_KV.put("wspc:client_id", "client-1");
    vi.spyOn(wspc, "refreshAccessToken").mockRejectedValue(new Error("invalid_grant"));

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const handler = vi.fn();
    const res = await withSession(req, env, handler);

    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(handler).not.toHaveBeenCalled();
    expect(await getSession(env.DESK_KV, "sid-1")).toBeNull();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/middleware/session.test.ts
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`worker/middleware/session.ts`：

```ts
import type { KVNamespace } from "@cloudflare/workers-types";
import { parseSessionId, clearSessionCookie } from "../cookie";
import { getSession, putSession, deleteSession, getClientId } from "../kv";
import { refreshAccessToken } from "../wspc";

const REFRESH_THRESHOLD_SECONDS = 30;

interface Env {
  DESK_KV: KVNamespace;
}

export type SessionHandler = (accessToken: string) => Promise<Response>;

export async function withSession(
  request: Request,
  env: Env,
  handler: SessionHandler,
): Promise<Response> {
  const sessionId = parseSessionId(request.headers);
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await getSession(env.DESK_KV, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "session_invalid" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
      },
    });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  let accessToken = session.accessToken;

  if (session.accessExp - nowSeconds < REFRESH_THRESHOLD_SECONDS) {
    const clientId = await getClientId(env.DESK_KV);
    if (!clientId) {
      await deleteSession(env.DESK_KV, sessionId);
      return new Response(JSON.stringify({ error: "client_missing" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie(),
        },
      });
    }
    try {
      const tokens = await refreshAccessToken({
        clientId,
        refreshToken: session.refreshToken,
      });
      const newAccessExp = nowSeconds + tokens.expiresIn - 5;
      await putSession(env.DESK_KV, sessionId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExp: newAccessExp,
      });
      accessToken = tokens.accessToken;
    } catch {
      await deleteSession(env.DESK_KV, sessionId);
      return new Response(JSON.stringify({ error: "refresh_failed" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie(),
        },
      });
    }
  }

  return handler(accessToken);
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/middleware/session.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/middleware/session.ts worker/middleware/session.test.ts
git commit -m "feat(worker): add session middleware with auto-refresh"
```

---

## Task 13：`POST /api/auth/login` 路由

**檔案**：
- 新增：`worker/routes/auth.ts`
- 新增：`worker/routes/auth.test.ts`

確保 `client_id` 在手 → 打 WSPC device 端點 → 產 `polling_id` 寫 KV → 回傳給前端。

- [ ] **Step 1：寫失敗的測試**

`worker/routes/auth.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { handleLogin } from "./auth";
import { getDevice } from "../kv";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: import("@cloudflare/workers-types").KVNamespace };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/login", () => {
  it("ensures client_id, requests device authorization, stores polling state, returns info", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    vi.spyOn(wspc, "requestDeviceAuthorization").mockResolvedValue({
      deviceCode: "dc-1",
      userCode: "ABCD-1234",
      verificationUri: "https://app.wspc.ai/device",
      verificationUriComplete: "https://app.wspc.ai/device?user_code=ABCD-1234",
      expiresIn: 600,
      interval: 5,
    });

    const res = await handleLogin(env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verification_uri_complete: string;
      user_code: string;
      polling_id: string;
      interval: number;
      expires_in: number;
    };

    expect(body.verification_uri_complete).toBe(
      "https://app.wspc.ai/device?user_code=ABCD-1234",
    );
    expect(body.user_code).toBe("ABCD-1234");
    expect(body.interval).toBe(5);
    expect(body.expires_in).toBe(600);
    expect(body.polling_id).toMatch(/^[A-Za-z0-9_-]+$/);

    const stored = await getDevice(env.DESK_KV, body.polling_id);
    expect(stored).toEqual({ deviceCode: "dc-1", interval: 5 });
  });

  it("registers a client lazily when KV has none", async () => {
    const env = makeEnv();
    vi.spyOn(wspc, "registerClient").mockResolvedValue("fresh-client");
    vi.spyOn(wspc, "requestDeviceAuthorization").mockResolvedValue({
      deviceCode: "dc-1",
      userCode: "ABCD",
      verificationUri: "https://app.wspc.ai/device",
      verificationUriComplete: "https://app.wspc.ai/device?user_code=ABCD",
      expiresIn: 600,
      interval: 5,
    });
    await handleLogin(env);
    expect(await env.DESK_KV.get("wspc:client_id")).toBe("fresh-client");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/routes/auth.test.ts
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`worker/routes/auth.ts`：

```ts
import type { KVNamespace } from "@cloudflare/workers-types";
import { ensureClientId, putDevice } from "../kv";
import { requestDeviceAuthorization } from "../wspc";
import { randomBase64UrlId } from "../random";

interface Env {
  DESK_KV: KVNamespace;
}

export async function handleLogin(env: Env): Promise<Response> {
  const clientId = await ensureClientId(env.DESK_KV);
  const device = await requestDeviceAuthorization(clientId);
  const pollingId = randomBase64UrlId(32);
  await putDevice(
    env.DESK_KV,
    pollingId,
    { deviceCode: device.deviceCode, interval: device.interval },
    device.expiresIn,
  );

  return new Response(
    JSON.stringify({
      verification_uri_complete: device.verificationUriComplete,
      user_code: device.userCode,
      polling_id: pollingId,
      interval: device.interval,
      expires_in: device.expiresIn,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/routes/auth.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/routes/auth.ts worker/routes/auth.test.ts
git commit -m "feat(worker): add POST /api/auth/login"
```

---

## Task 14：`GET /api/auth/status` 路由

**檔案**：
- 修改：`worker/routes/auth.ts`
- 修改：`worker/routes/auth.test.ts`

依 `polling_id` 嘗試一次 token exchange，依 WSPC 回應 branch 出五種狀態：`authenticated` / `pending` / `slow_down` / `denied` / `expired`。

- [ ] **Step 1：在 `worker/routes/auth.test.ts` 加入新測試**

```ts
import { handleStatus } from "./auth";
import { putDevice, getSession, getDevice } from "../kv";

describe("GET /api/auth/status", () => {
  it("returns 'expired' when polling_id is not found in KV", async () => {
    const env = makeEnv();
    const res = await handleStatus(env, "ghost-id");
    const body = (await res.json()) as { state: string };
    expect(body.state).toBe("expired");
  });

  it("returns 'pending' when WSPC says authorization_pending", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "pending" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "pending" });
  });

  it("returns 'pending' + slow_down hint", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "slow_down" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "pending", slow_down: true });
  });

  it("returns 'authenticated', creates session, sets cookie, deletes device entry", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({
      status: "success",
      tokens: { accessToken: "at-1", refreshToken: "rt-1", expiresIn: 900 },
    });

    const res = await handleStatus(env, "pid-1");
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ state: "authenticated" });

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("__Host-Session=");
    expect(setCookie).toContain("HttpOnly");

    const cookieMatch = setCookie!.match(/__Host-Session=([^;]+)/);
    const sessionId = cookieMatch![1];
    const session = await getSession(env.DESK_KV, sessionId);
    expect(session?.accessToken).toBe("at-1");
    expect(session?.refreshToken).toBe("rt-1");

    expect(await getDevice(env.DESK_KV, "pid-1")).toBeNull();
  });

  it("returns 'denied' and deletes device entry", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "denied" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "denied" });
    expect(await getDevice(env.DESK_KV, "pid-1")).toBeNull();
  });

  it("returns 'expired' and deletes device entry when WSPC says expired_token", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "expired" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "expired" });
    expect(await getDevice(env.DESK_KV, "pid-1")).toBeNull();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/routes/auth.test.ts
```

預期：新增測試 FAIL。

- [ ] **Step 3：在 `worker/routes/auth.ts` 加入實作**

```ts
import { getClientId, getDevice, deleteDevice, putSession } from "../kv";
import { exchangeDeviceCode } from "../wspc";
import { serializeSessionCookie } from "../cookie";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

export async function handleStatus(env: Env, pollingId: string): Promise<Response> {
  const device = await getDevice(env.DESK_KV, pollingId);
  if (!device) {
    return jsonResponse({ state: "expired" });
  }

  const clientId = await getClientId(env.DESK_KV);
  if (!clientId) {
    await deleteDevice(env.DESK_KV, pollingId);
    return jsonResponse({ state: "expired" });
  }

  const result = await exchangeDeviceCode({
    clientId,
    deviceCode: device.deviceCode,
  });

  switch (result.status) {
    case "success": {
      const sessionId = randomBase64UrlId(32);
      const nowSeconds = Math.floor(Date.now() / 1000);
      await putSession(env.DESK_KV, sessionId, {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        accessExp: nowSeconds + result.tokens.expiresIn - 5,
      });
      await deleteDevice(env.DESK_KV, pollingId);
      return jsonResponse(
        { state: "authenticated" },
        { headers: { "Set-Cookie": serializeSessionCookie(sessionId) } },
      );
    }
    case "pending":
      return jsonResponse({ state: "pending" });
    case "slow_down":
      return jsonResponse({ state: "pending", slow_down: true });
    case "denied":
      await deleteDevice(env.DESK_KV, pollingId);
      return jsonResponse({ state: "denied" });
    case "expired":
      await deleteDevice(env.DESK_KV, pollingId);
      return jsonResponse({ state: "expired" });
  }
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/routes/auth.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/routes/auth.ts worker/routes/auth.test.ts
git commit -m "feat(worker): add GET /api/auth/status"
```

---

## Task 15：`POST /api/auth/logout` 路由

**檔案**：
- 修改：`worker/routes/auth.ts`
- 修改：`worker/routes/auth.test.ts`

從 cookie 取 session id → 刪 KV → 清 cookie。

- [ ] **Step 1：在 `worker/routes/auth.test.ts` 加入新測試**

```ts
import { handleLogout } from "./auth";
import { putSession, getSession } from "../kv";

describe("POST /api/auth/logout", () => {
  it("deletes session from KV and clears cookie", async () => {
    const env = makeEnv();
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at",
      refreshToken: "rt",
      accessExp: 999999,
    });

    const req = new Request("https://desk.yurenju.me/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "__Host-Session=sid-1" },
    });

    const res = await handleLogout(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await getSession(env.DESK_KV, "sid-1")).toBeNull();
  });

  it("clears cookie even when no session existed (idempotent)", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "__Host-Session=ghost" },
    });
    const res = await handleLogout(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("returns 204 and clears cookie when no cookie present", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/auth/logout", {
      method: "POST",
    });
    const res = await handleLogout(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/routes/auth.test.ts
```

預期：新增測試 FAIL。

- [ ] **Step 3：在 `worker/routes/auth.ts` 加入實作**

```ts
import { parseSessionId, clearSessionCookie } from "../cookie";
import { deleteSession } from "../kv";

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const sessionId = parseSessionId(request.headers);
  if (sessionId) {
    await deleteSession(env.DESK_KV, sessionId);
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/routes/auth.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/routes/auth.ts worker/routes/auth.test.ts
git commit -m "feat(worker): add POST /api/auth/logout"
```

---

## Task 16：`GET /api/me` 路由

**檔案**：
- 新增：`worker/routes/me.ts`
- 新增：`worker/routes/me.test.ts`

過 session 中間件 → 用 access token 打 WSPC `/auth/me` → 回傳轉成 snake_case 給前端（前端慣用 `user_id` / `display_name` 這種 WSPC 原樣命名）。

- [ ] **Step 1：寫失敗的測試**

`worker/routes/me.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { putSession } from "../kv";
import { handleMe } from "./me";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: import("@cloudflare/workers-types").KVNamespace };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/me", () => {
  it("returns 401 when no session cookie", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/me");
    const res = await handleMe(req, env);
    expect(res.status).toBe(401);
  });

  it("returns whoami passthrough when session is valid", async () => {
    const env = makeEnv();
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-1",
      refreshToken: "rt-1",
      accessExp: Math.floor(Date.now() / 1000) + 600,
    });
    vi.spyOn(wspc, "getWhoami").mockResolvedValue({
      userId: "u-1",
      email: "test@example.com",
      displayName: "Test User",
    });

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const res = await handleMe(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      user_id: "u-1",
      email: "test@example.com",
      display_name: "Test User",
    });
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run worker/routes/me.test.ts
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`worker/routes/me.ts`：

```ts
import type { KVNamespace } from "@cloudflare/workers-types";
import { withSession } from "../middleware/session";
import { getWhoami } from "../wspc";

interface Env {
  DESK_KV: KVNamespace;
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (accessToken) => {
    const me = await getWhoami(accessToken);
    return new Response(
      JSON.stringify({
        user_id: me.userId,
        email: me.email,
        display_name: me.displayName,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run worker/routes/me.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add worker/routes/me.ts worker/routes/me.test.ts
git commit -m "feat(worker): add GET /api/me"
```

---

## Task 17：Worker entry dispatcher

**檔案**：
- 修改：`worker/index.ts`

依路徑與 method 路由到對應 handler。其餘 `/api/*` 回 404。非 `/api/*` 由 assets handler 處理（`run_worker_first` 設定已生效，不在這份 Worker 程式碼範圍）。

- [ ] **Step 1：改寫 `worker/index.ts`**

```ts
import type { KVNamespace } from "@cloudflare/workers-types";
import { handleLogin, handleStatus, handleLogout } from "./routes/auth";
import { handleMe } from "./routes/me";

interface Env {
  DESK_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (!path.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }

    if (path === "/api/auth/login" && method === "POST") {
      return handleLogin(env);
    }

    if (path === "/api/auth/status" && method === "GET") {
      const pollingId = url.searchParams.get("polling_id");
      if (!pollingId) {
        return new Response(
          JSON.stringify({ error: "polling_id required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return handleStatus(env, pollingId);
    }

    if (path === "/api/auth/logout" && method === "POST") {
      return handleLogout(request, env);
    }

    if (path === "/api/me" && method === "GET") {
      return handleMe(request, env);
    }

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 2：跑整個 worker 測試套件**

```
npx vitest run worker
```

預期：全部 PASS（之前各個 handler 的測試都還在跑）。

- [ ] **Step 3：跑 type check**

```
npx tsc --noEmit
```

預期：通過。

- [ ] **Step 4：Commit**

```
git add worker/index.ts
git commit -m "feat(worker): wire up /api/* dispatcher"
```

---

## Task 18：`useAuthStore` zustand

**檔案**：
- 新增：`src/store/auth.ts`
- 新增：`src/store/auth.test.ts`

State 形狀：

```
{
  me: { userId, email, displayName } | null,
  status: "loading" | "authenticated" | "unauthenticated",
  fetchMe(): Promise<void>,
  setMe(me): void,
  clear(): void,
}
```

- [ ] **Step 1：寫失敗的測試**

`src/store/auth.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "./auth";

beforeEach(() => {
  useAuthStore.setState({ me: null, status: "loading" });
  vi.restoreAllMocks();
});

describe("useAuthStore", () => {
  it("starts with status 'loading' and me null", () => {
    expect(useAuthStore.getState().status).toBe("loading");
    expect(useAuthStore.getState().me).toBeNull();
  });

  it("setMe updates me and flips status to authenticated", () => {
    useAuthStore.getState().setMe({
      userId: "u-1",
      email: "a@b",
      displayName: "A",
    });
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().me?.userId).toBe("u-1");
  });

  it("clear resets to unauthenticated", () => {
    useAuthStore.getState().setMe({ userId: "u-1", email: "a@b" });
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().me).toBeNull();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("fetchMe calls /api/me; on 200 sets me", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "u-1",
          email: "a@b",
          display_name: "A",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await useAuthStore.getState().fetchMe();
    expect(fetchSpy).toHaveBeenCalledWith("/api/me", expect.any(Object));
    expect(useAuthStore.getState().me).toEqual({
      userId: "u-1",
      email: "a@b",
      displayName: "A",
    });
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("fetchMe sets status 'unauthenticated' on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    await useAuthStore.getState().fetchMe();
    expect(useAuthStore.getState().me).toBeNull();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run src/store/auth.test.ts
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`src/store/auth.ts`：

```ts
import { create } from "zustand";

export interface AuthMe {
  userId: string;
  email: string;
  displayName?: string;
}

interface AuthState {
  me: AuthMe | null;
  status: "loading" | "authenticated" | "unauthenticated";
  setMe(me: AuthMe): void;
  clear(): void;
  fetchMe(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  me: null,
  status: "loading",
  setMe(me) {
    set({ me, status: "authenticated" });
  },
  clear() {
    set({ me: null, status: "unauthenticated" });
  },
  async fetchMe() {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (res.status === 200) {
      const data = (await res.json()) as {
        user_id: string;
        email: string;
        display_name?: string;
      };
      set({
        me: {
          userId: data.user_id,
          email: data.email,
          displayName: data.display_name,
        },
        status: "authenticated",
      });
    } else {
      set({ me: null, status: "unauthenticated" });
    }
  },
}));
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run src/store/auth.test.ts
```

預期：PASS。

- [ ] **Step 5：Commit**

```
git add src/store/auth.ts src/store/auth.test.ts
git commit -m "feat(store): add useAuthStore"
```

---

## Task 19：`/login` 路由與 `LoginPage`

**檔案**：
- 新增：`src/pages/LoginPage.tsx`
- 新增：`src/pages/LoginPage.test.tsx`
- 新增：`src/routes/login.tsx`

Mount 時 `POST /api/auth/login` → 拿到 user_code、verification_uri_complete、polling_id、interval、expires_in → 顯示 user_code 與「在 WSPC 開啟授權頁」連結 → 每 `interval` 秒對 `/api/auth/status?polling_id=...` 輪詢 → `authenticated` 時 `useAuthStore.fetchMe()` 然後跳回 `/today`。

`LoginPage` 接受 props `{ onAuthenticated: () => void }` 方便測試。Route 檔把它跟導頁邏輯接起來。

- [ ] **Step 1：寫失敗的測試**

`src/pages/LoginPage.test.tsx`：

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LoginPage } from "./LoginPage";

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetchSequence(responses: Array<Response | Promise<Response>>) {
  let i = 0;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return r instanceof Promise ? r : r;
  });
}

describe("LoginPage", () => {
  it("renders user_code and verification link after /api/auth/login resolves", async () => {
    mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD",
          user_code: "ABCD-1234",
          polling_id: "pid-1",
          interval: 5,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    render(<LoginPage onAuthenticated={() => {}} />);

    expect(await screen.findByText("ABCD-1234")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /在 WSPC 開啟授權頁/ }),
    ).toHaveAttribute("href", "https://app.wspc.ai/device?user_code=ABCD");
  });

  it("calls onAuthenticated when polling returns 'authenticated'", async () => {
    vi.useFakeTimers();
    mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD",
          user_code: "ABCD",
          polling_id: "pid-1",
          interval: 1,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "authenticated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    const onAuthenticated = vi.fn();
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await vi.runAllTimersAsync();
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());

    vi.useRealTimers();
  });

  it("shows error message when polling returns 'denied'", async () => {
    vi.useFakeTimers();
    mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device",
          user_code: "ABCD",
          polling_id: "pid-1",
          interval: 1,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "denied" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    render(<LoginPage onAuthenticated={() => {}} />);
    await vi.runAllTimersAsync();
    expect(await screen.findByText(/已拒絕|登入失敗/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run src/pages/LoginPage.test.tsx
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`src/pages/LoginPage.tsx`：

```tsx
import { useEffect, useRef, useState } from "react";

interface LoginInit {
  verificationUriComplete: string;
  userCode: string;
  pollingId: string;
  interval: number;
  expiresIn: number;
}

type PollState = "idle" | "pending" | "authenticated" | "denied" | "expired" | "error";

interface Props {
  onAuthenticated: () => void;
}

export function LoginPage({ onAuthenticated }: Props) {
  const [init, setInit] = useState<LoginInit | null>(null);
  const [state, setState] = useState<PollState>("idle");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/login", { method: "POST" });
      if (!res.ok) {
        if (!cancelled) setState("error");
        return;
      }
      const data = (await res.json()) as {
        verification_uri_complete: string;
        user_code: string;
        polling_id: string;
        interval: number;
        expires_in: number;
      };
      if (cancelled) return;
      setInit({
        verificationUriComplete: data.verification_uri_complete,
        userCode: data.user_code,
        pollingId: data.polling_id,
        interval: data.interval,
        expiresIn: data.expires_in,
      });
      setState("pending");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!init || state !== "pending") return;
    let pollIntervalMs = init.interval * 1000;

    const tick = async () => {
      const res = await fetch(
        `/api/auth/status?polling_id=${encodeURIComponent(init.pollingId)}`,
      );
      const data = (await res.json()) as { state: string; slow_down?: boolean };
      if (data.state === "authenticated") {
        setState("authenticated");
        onAuthenticated();
        return;
      }
      if (data.state === "denied") {
        setState("denied");
        return;
      }
      if (data.state === "expired") {
        setState("expired");
        return;
      }
      if (data.slow_down) {
        // RFC 8628 §3.5: on slow_down, increase polling interval. Follow wspc-cli
        // and add a fixed +5s instead of doubling — keeps cap predictable.
        pollIntervalMs += 5000;
      }
      intervalRef.current = window.setTimeout(tick, pollIntervalMs);
    };

    intervalRef.current = window.setTimeout(tick, pollIntervalMs);

    return () => {
      if (intervalRef.current !== null) window.clearTimeout(intervalRef.current);
    };
  }, [init, state, onAuthenticated]);

  if (!init) {
    return <main>準備登入中⋯</main>;
  }

  return (
    <main>
      <h1>登入 WSPC</h1>
      <p>請點下方按鈕在 WSPC 完成授權，授權完成後本頁會自動進入。</p>
      <a href={init.verificationUriComplete} target="_blank" rel="noopener noreferrer">
        在 WSPC 開啟授權頁
      </a>
      <p>
        驗證碼：<strong>{init.userCode}</strong>
      </p>
      {state === "pending" && <p>等待授權中⋯</p>}
      {state === "denied" && <p>授權已拒絕，登入失敗。</p>}
      {state === "expired" && <p>授權已過期，請重新整理頁面再試。</p>}
      {state === "error" && <p>系統錯誤，請稍後再試。</p>}
    </main>
  );
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run src/pages/LoginPage.test.tsx
```

預期：PASS。

- [ ] **Step 5：建立 `/login` 路由**

`src/routes/login.tsx`：

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";
import { useAuthStore } from "@/store/auth";

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate();
  const fetchMe = useAuthStore((s) => s.fetchMe);

  return (
    <LoginPage
      onAuthenticated={async () => {
        await fetchMe();
        navigate({ to: "/today" });
      }}
    />
  );
}
```

- [ ] **Step 6：重生 TanStack route tree**

```
npm run dev
```

把 dev server 起來幾秒讓 TanStack 重生 `src/routeTree.gen.ts`，然後 Ctrl+C 結束。

或者用 `npx tsx node_modules/@tanstack/router-plugin/dist/cli.js` 之類的命令（依專案 router plugin 版本而定）。若 dev server 法不順手，看 [src/routeTree.gen.ts](src/routeTree.gen.ts) 既有結構手動補一條 `/login` route 條目。

- [ ] **Step 7：跑 type check**

```
npx tsc --noEmit
```

預期：通過。

- [ ] **Step 8：Commit**

```
git add src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx src/routes/login.tsx src/routeTree.gen.ts
git commit -m "feat(frontend): add /login route with polling UI"
```

---

## Task 20：`AuthMenu` 元件 + 整合進 `TopNav` + app 啟動 `fetchMe`

**檔案**：
- 新增：`src/features/shell/AuthMenu.tsx`
- 新增：`src/features/shell/AuthMenu.test.tsx`
- 修改：`src/features/shell/TopNav.tsx`
- 修改：`src/routes/__root.tsx`

`AuthMenu`：

- `status === "loading"`：不顯示任何文字（避免閃爍）
- `status === "unauthenticated"`：顯示「登入 WSPC」按鈕，連到 `/login`
- `status === "authenticated"`：顯示 `displayName ?? email`，旁邊有「登出」按鈕；按下後呼叫 `/api/auth/logout` 並清 store

`__root.tsx` 在 component mount 時呼叫一次 `useAuthStore.getState().fetchMe()`，讓 app 啟動就驗證 cookie。

- [ ] **Step 1：寫失敗的測試**

`src/features/shell/AuthMenu.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, RouterProvider } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth";
import { AuthMenu } from "./AuthMenu";

beforeEach(() => {
  useAuthStore.setState({ me: null, status: "loading" });
  vi.restoreAllMocks();
});

describe("AuthMenu", () => {
  it("shows nothing while loading", () => {
    useAuthStore.setState({ me: null, status: "loading" });
    const { container } = render(<AuthMenu />);
    expect(container.textContent).toBe("");
  });

  it("shows login link when unauthenticated", () => {
    useAuthStore.setState({ me: null, status: "unauthenticated" });
    render(<AuthMenu />);
    expect(screen.getByRole("link", { name: /登入 WSPC/ })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows display name and logout button when authenticated", async () => {
    useAuthStore.setState({
      me: { userId: "u-1", email: "a@b", displayName: "Alice" },
      status: "authenticated",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    render(<AuthMenu />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    const logoutBtn = screen.getByRole("button", { name: /登出/ });
    await userEvent.click(logoutBtn);

    expect(useAuthStore.getState().me).toBeNull();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("falls back to email when displayName is missing", () => {
    useAuthStore.setState({
      me: { userId: "u-1", email: "a@b" },
      status: "authenticated",
    });
    render(<AuthMenu />);
    expect(screen.getByText("a@b")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

```
npx vitest run src/features/shell/AuthMenu.test.tsx
```

預期：FAIL。

- [ ] **Step 3：最小實作**

`src/features/shell/AuthMenu.tsx`：

```tsx
import { Link } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth";

export function AuthMenu() {
  const status = useAuthStore((s) => s.status);
  const me = useAuthStore((s) => s.me);
  const clear = useAuthStore((s) => s.clear);

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return <Link to="/login">登入 WSPC</Link>;
  }

  const label = me?.displayName ?? me?.email ?? "";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clear();
  }

  return (
    <>
      <span>{label}</span>
      <button type="button" onClick={logout}>
        登出
      </button>
    </>
  );
}
```

- [ ] **Step 4：跑測試確認通過**

```
npx vitest run src/features/shell/AuthMenu.test.tsx
```

預期：PASS。

- [ ] **Step 5：把 `AuthMenu` 加進 `TopNav`**

修改 `src/features/shell/TopNav.tsx`，在 `.actions` 區把 `AuthMenu` 加在 `ThemeToggle` 旁邊：

```tsx
import { DeskLogo } from "@/ui/DeskLogo";
import { AuthMenu } from "./AuthMenu";
import { ModeToggle } from "./ModeToggle";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./TopNav.module.css";

export function TopNav() {
  return (
    <header className={styles.root}>
      <div className={styles.brand}>
        <DeskLogo />
        <span className={styles.subdomain}>desk.yurenju.me</span>
      </div>
      <div className={styles.mode}>
        <ModeToggle />
      </div>
      <div className={styles.actions}>
        <AuthMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 6：App 啟動觸發 `fetchMe`**

修改 `src/routes/__root.tsx`：

```tsx
import { useEffect } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TopNav } from "@/features/shell/TopNav";
import { useAuthStore } from "@/store/auth";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    useAuthStore.getState().fetchMe();
  }, []);

  return (
    <>
      <TopNav />
      <Outlet />
    </>
  );
}
```

- [ ] **Step 7：跑全部測試 + type check**

```
npx vitest run
npx tsc --noEmit
```

預期：所有測試 PASS、type check 通過。

- [ ] **Step 8：Commit**

```
git add src/features/shell/AuthMenu.tsx src/features/shell/AuthMenu.test.tsx src/features/shell/TopNav.tsx src/routes/__root.tsx
git commit -m "feat(frontend): add AuthMenu and wire app-level fetchMe"
```

---

## Task 21：部署後手動驗證

**檔案**：無新檔案，僅手動驗證。

把 Slice 2a 部署到 production，跑 spec 裡的驗收標準。

- [ ] **Step 1：部署**

```
npm run deploy
```

預期：build 成功、deploy 成功。

- [ ] **Step 2：跑完整 device flow（手動）**

1. 開無痕視窗到 `https://desk.yurenju.me`。
2. TopNav 應顯示「登入 WSPC」連結。
3. 點連結進 `/login` → 應顯示 user_code 與「在 WSPC 開啟授權頁」按鈕。
4. 點按鈕在新分頁完成 WSPC 授權。
5. 回到 desk 頁面 → 應自動跳到 `/today`，TopNav 顯示自己的 display_name / email。

- [ ] **Step 3：重整保留登入**

重整頁面 → 應仍是登入狀態，TopNav 仍顯示 display_name。

- [ ] **Step 4：refresh 中間件動作**

等 20 分鐘以上（access token 過期）→ 操作頁面（任何會打 `/api/me` 的動作，例如重整）→ 應仍正常顯示登入。

用 `wrangler kv key list --namespace-id <DESK_KV id>` 確認 `session:<id>` 仍存在；`wrangler kv key get session:<id> --namespace-id <id>` 看內容 → `access_token` 應跟登入時不同（已被 refresh 過）。

- [ ] **Step 5：登出**

按登出按鈕 → TopNav 回到「登入 WSPC」狀態。
用 `wrangler kv key list` 確認對應的 `session:<id>` 已被刪除。

- [ ] **Step 6：多瀏覽器隔離**

從另一個瀏覽器（或無痕視窗）登入 → 兩個 session 共存、互不影響。

- [ ] **Step 7：Regression — Today / Plan / Backlog 不變**

從登入狀態切到 `/today` → 勾選任務、新增任務、刪除任務、設 daily_priority 全部跟 Slice 1 行為一模一樣（仍走 localStorage）。

切到 `/plan` → 三欄版型仍正常顯示。

- [ ] **Step 8：把驗收結果記到 commit 訊息或 PR 描述**

不另外 commit code，但記得在 PR 描述裡 checklist 形式列出上述每項通過。

---

## 自我檢視結果

對照 spec 的 12 個區塊：

| Spec 區塊 | 對應 task |
|---|---|
| 範圍與動機 | Task 1-20（整體實作）|
| 系統架構 | Task 1（infra）|
| OpenAPI 型別產生 | Task 2 |
| WSPC 整合點 — register | Task 5 |
| WSPC 整合點 — device | Task 6 |
| WSPC 整合點 — token / refresh | Task 7 |
| WSPC 整合點 — whoami | Task 8 |
| KV 結構 — client_id | Task 9 |
| KV 結構 — session | Task 10 |
| KV 結構 — device | Task 11 |
| Worker 路由 — POST /api/auth/login | Task 13 |
| Worker 路由 — GET /api/auth/status | Task 14 |
| Worker 路由 — POST /api/auth/logout | Task 15 |
| Worker 路由 — GET /api/me | Task 16 |
| Worker 路由 — dispatcher | Task 17 |
| Session 中間件 | Task 12 |
| Device flow polling | Task 13-14（後端）、Task 19（前端） |
| 前端最小範圍 — useAuthStore | Task 18 |
| 前端最小範圍 — /login route | Task 19 |
| 前端最小範圍 — AuthMenu | Task 20 |
| 前端最小範圍 — app 啟動 fetchMe | Task 20 |
| 安全考量 — cookie 屬性 | Task 4 |
| 安全考量 — CSRF / token 不外露 | 由 Task 4 + Task 12 + Task 17 共同保證 |
| 測試策略 | 每個 task 都含 Vitest 單元測試 |
| 驗收標準 | Task 21 |

涵蓋完整、無 spec 漏項。

---

## 執行選項

**Plan 完成、存在 `docs/superpowers/plans/2026-05-30-slice-2a-auth-bff.md`。兩種執行選項：**

**1. Subagent-Driven（推薦）** — 每個 task 派一個全新 subagent，中間有 review checkpoint，迭代快。

**2. Inline Execution** — 在當前 session 連續執行 task，每組 task 做完有檢查點。

**選哪個？**
