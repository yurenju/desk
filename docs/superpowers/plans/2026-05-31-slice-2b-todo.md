# Slice 2b — `/api/todo` 接上 WSPC 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Today mode 的 task 資料從 localStorage 換成真實 WSPC 資料，並在第一次使用時 per-user lazy 建立 Desk project + DeskTask type。

**Architecture:** 厚 BFF / 薄前端。BFF（Cloudflare Worker）用 WSPC 未文件化但已實證的 `cf.scheduled_dates` 做 server 端過濾，把 `Todo` map 成前端 `Task[]`。前端維持 Slice 1 的 `taskOps` 純函式，外包一層樂觀更新 + 失敗回滾，並把每個動作同步成 `/api/todo` 的 create/patch。multi-tenant：bootstrap 結果存 `desk:bootstrap:<user_id>`，每個使用者在自己的 WSPC 帳號各自建 project/type。

**Tech Stack:** Cloudflare Workers、TypeScript、Vitest、Zustand、TanStack Router。WSPC REST `https://api.wspc.ai`。

**設計文件：** [docs/superpowers/specs/2026-05-31-slice-2b-todo-design.md](../specs/2026-05-31-slice-2b-todo-design.md)

---

## 檔案結構

**Worker（新增）**
- `worker/bootstrap.ts` — `ensureBootstrap(kv, accessToken, userId)`：per-user lazy 建 project + type，存 KV。
- `worker/todo-mapper.ts` — `mapTodoToTask(todo)`：WSPC `Todo` → 前端 `Task`。
- `worker/routes/todo.ts` — `handleListTodo` / `handleCreateTodo` / `handlePatchTodo`。

**Worker（修改）**
- `worker/kv.ts` — `SessionData` 加 `userId`；新增 `getBootstrap` / `putBootstrap`。
- `worker/middleware/session.ts` — `SessionHandler` 改收 `{ accessToken, userId }`。
- `worker/routes/auth.ts` — login 成功時取 whoami，把 `userId` 寫進 session。
- `worker/routes/me.ts` — 配合 `withSession` 新簽名。
- `worker/wspc.ts` — 新增 `Todo` 型別與 `listTodos` / `createTodo` / `patchTodo` / `createProject` / `createTodoType`。
- `worker/index.ts` — dispatcher 加 `/api/todo` 三條路由。

**Frontend（新增）**
- `src/lib/api/todo.ts` — 前端 todo API client（list/create/patch）。

**Frontend（修改）**
- `src/store/tasks.ts` — 從 API 載入 + 樂觀更新/回滾 + 真實 today。
- `src/store/auth.ts` — `clear()` 連帶清 tasks 快取。
- `src/routes/today.tsx` — 選擇性 `/today/$date`、掛載時載入。

---

## Task 1: Session 加上 user_id

**Files:**
- Modify: `worker/kv.ts`
- Modify: `worker/wspc.ts`（無，whoami 已存在）
- Modify: `worker/routes/auth.ts:75-89`
- Modify: `worker/middleware/session.ts:11-77`
- Modify: `worker/routes/me.ts`
- Test: `worker/routes/auth.test.ts`、`worker/middleware/session.test.ts`

- [ ] **Step 1: 寫失敗測試 — session 帶 userId**

在 `worker/middleware/session.test.ts` 末尾新增（沿用該檔既有的 import / `makeEnv` 風格）：

```ts
it("passes userId from session to the handler", async () => {
  const env = makeEnv();
  await putSession(env.DESK_KV, "sid-u", {
    accessToken: "at",
    refreshToken: "rt",
    accessExp: Math.floor(Date.now() / 1000) + 600,
    userId: "usr_123",
  });
  const req = new Request("https://desk.yurenju.me/api/x", {
    headers: { Cookie: "__Host-Session=sid-u" },
  });
  let seen: { accessToken: string; userId: string } | null = null;
  await withSession(req, env, async (ctx) => {
    seen = ctx;
    return new Response("ok");
  });
  expect(seen).toEqual({ accessToken: "at", userId: "usr_123" });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run worker/middleware/session.test.ts`
Expected: FAIL（`ctx` 是字串、`userId` undefined，型別 / 斷言不符）

- [ ] **Step 3: 改 `SessionData` 與 `getBootstrap`/`putBootstrap`（`worker/kv.ts`）**

在 `SessionData` interface 加欄位：

```ts
export interface SessionData {
  accessToken: string;
  refreshToken: string;
  accessExp: number; // unix seconds
  userId: string;
}
```

在檔案末尾新增 bootstrap KV 操作：

```ts
export interface BootstrapData {
  projectId: string;
  typeId: string;
}

export async function getBootstrap(
  kv: KVNamespace,
  userId: string,
): Promise<BootstrapData | null> {
  const raw = await kv.get(`desk:bootstrap:${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BootstrapData;
  } catch {
    return null;
  }
}

export async function putBootstrap(
  kv: KVNamespace,
  userId: string,
  data: BootstrapData,
): Promise<void> {
  await kv.put(`desk:bootstrap:${userId}`, JSON.stringify(data));
}
```

- [ ] **Step 4: login 成功時寫 userId（`worker/routes/auth.ts`）**

在檔頭 import 補 `getWhoami`：

```ts
import { requestDeviceAuthorization, exchangeDeviceCode, getWhoami } from "../wspc";
```

把 `handleStatus` 的 `case "success"` 區塊改成先取 whoami 再寫 session：

```ts
case "success": {
  const sessionId = randomBase64UrlId(32);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const me = await getWhoami(result.tokens.accessToken);
  await putSession(env.DESK_KV, sessionId, {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    accessExp: nowSeconds + result.tokens.expiresIn - 5,
    userId: me.userId,
  });
  await deleteDevice(env.DESK_KV, pollingId);
  return jsonResponse(
    { state: "authenticated" },
    { headers: { "Set-Cookie": serializeSessionCookie(sessionId) } },
  );
}
```

- [ ] **Step 5: `withSession` 交出 `{ accessToken, userId }`（`worker/middleware/session.ts`）**

改 handler 型別與兩處呼叫：

```ts
export interface SessionContext {
  accessToken: string;
  userId: string;
}

export type SessionHandler = (ctx: SessionContext) => Promise<Response>;
```

refresh 成功後 `putSession` 要保留 `userId`（從原 session 帶過來），最後 `return handler({ accessToken, userId: session.userId })`。完整改法：

- refresh 區塊的 `putSession` 改為帶 `userId: session.userId`：
  ```ts
  await putSession(env.DESK_KV, sessionId, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExp: newAccessExp,
    userId: session.userId,
  });
  ```
- 函式結尾改為：
  ```ts
  return handler({ accessToken, userId: session.userId });
  ```

- [ ] **Step 6: 配合 `me.ts` 新簽名（`worker/routes/me.ts`）**

```ts
export async function handleMe(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken }) => {
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

- [ ] **Step 7: 修既有測試的 session fixture**

`worker/routes/me.test.ts`、`worker/routes/auth.test.ts`、`worker/middleware/session.test.ts` 中每個 `putSession(...)` 的 fixture 都補 `userId: "usr_test"`（TypeScript 會在 compile 時抓出缺漏）。`auth.test.ts` 的 success 案例需 `vi.spyOn(wspc, "getWhoami").mockResolvedValue({ userId: "usr_test", email: "t@e.co" })`。

- [ ] **Step 8: 跑全部 worker 測試確認通過**

Run: `npx vitest run worker/`
Expected: PASS（含新 userId 測試）

- [ ] **Step 9: Commit**

```bash
git add worker/kv.ts worker/routes/auth.ts worker/middleware/session.ts worker/routes/me.ts worker/routes/me.test.ts worker/routes/auth.test.ts worker/middleware/session.test.ts
git commit -m "feat(worker): carry user_id in session + add bootstrap KV ops"
```

---

## Task 2: WSPC todo client 函式

**Files:**
- Modify: `worker/wspc.ts`
- Test: `worker/wspc.test.ts`

- [ ] **Step 1: 寫失敗測試 — listTodos 組出 cf query**

在 `worker/wspc.test.ts` 末尾新增：

```ts
import { listTodos, createTodo, patchTodo } from "./wspc";

describe("listTodos", () => {
  it("builds project_id + cf.scheduled_dates + status query", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ todos: [] }), { status: 200 }),
    );
    await listTodos("at", { projectId: "prj_1", date: "2026-05-31" });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/todo/items");
    expect(url.searchParams.get("project_id")).toBe("prj_1");
    expect(url.searchParams.get("cf.scheduled_dates")).toBe("2026-05-31");
    expect(url.searchParams.getAll("status")).toEqual([
      "open",
      "in_progress",
      "done",
    ]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run worker/wspc.test.ts`
Expected: FAIL（`listTodos` is not a function）

- [ ] **Step 3: 實作 todo client（`worker/wspc.ts`）**

在檔案末尾新增（`WSPC_BASE` 已於檔頭定義）：

```ts
export interface Todo {
  id: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  title: string;
  created_at: number;
  updated_at: number;
  custom_fields?: Record<string, string | string[]>;
}

const CF_SCHEDULED_DATES = "cf.scheduled_dates"; // 鎖死 key，防靜默回整包

export async function listTodos(
  accessToken: string,
  opts: { projectId: string; date: string },
): Promise<Todo[]> {
  const params = new URLSearchParams();
  params.set("project_id", opts.projectId);
  params.set(CF_SCHEDULED_DATES, opts.date);
  for (const s of ["open", "in_progress", "done"]) params.append("status", s);
  const res = await fetch(`${WSPC_BASE}/todo/items?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`WSPC listTodos failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { todos?: Todo[] };
  return data.todos ?? [];
}

export async function createTodo(
  accessToken: string,
  body: {
    title: string;
    projectId: string;
    typeId: string;
    customFields: Record<string, string | string[]>;
  },
): Promise<Todo> {
  const res = await fetch(`${WSPC_BASE}/todo/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: body.title,
      project_id: body.projectId,
      type_id: body.typeId,
      custom_fields: body.customFields,
    }),
  });
  if (!res.ok) {
    throw new Error(`WSPC createTodo failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Todo;
}

export async function patchTodo(
  accessToken: string,
  id: string,
  body: {
    status?: Todo["status"];
    customFields?: Record<string, string | null>;
  },
): Promise<Todo> {
  const payload: Record<string, unknown> = {};
  if (body.status) payload.status = body.status;
  if (body.customFields) payload.custom_fields = body.customFields;
  const res = await fetch(`${WSPC_BASE}/todo/items/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`WSPC patchTodo failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Todo;
}

export async function createProject(
  accessToken: string,
  name: string,
): Promise<{ id: string }> {
  const res = await fetch(`${WSPC_BASE}/todo/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`WSPC createProject failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("WSPC createProject response missing id");
  return { id: data.id };
}

export interface CustomFieldDecl {
  key: string;
  type: "string" | "string_array";
}

export async function createTodoType(
  accessToken: string,
  body: { label: string; projectId: string; customFields: CustomFieldDecl[] },
): Promise<{ id: string }> {
  const res = await fetch(`${WSPC_BASE}/todo/types`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      label: body.label,
      project_id: body.projectId,
      custom_fields: body.customFields,
    }),
  });
  if (!res.ok) {
    throw new Error(`WSPC createTodoType failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("WSPC createTodoType response missing id");
  return { id: data.id };
}
```

- [ ] **Step 4: 補 create / patch 的測試**

在 `worker/wspc.test.ts` 加：

```ts
describe("patchTodo", () => {
  it("maps status + customFields and supports null clear", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "tod_1", status: "open" }), { status: 200 }),
    );
    await patchTodo("at", "tod_1", { customFields: { daily_priority: null } });
    const init = fetchSpy.mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual({
      custom_fields: { daily_priority: null },
    });
    expect(init.method).toBe("PATCH");
  });
});
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run worker/wspc.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add worker/wspc.ts worker/wspc.test.ts
git commit -m "feat(worker): add WSPC todo/project/type client functions"
```

---

## Task 3: Per-user bootstrap

**Files:**
- Create: `worker/bootstrap.ts`
- Test: `worker/bootstrap.test.ts`

- [ ] **Step 1: 寫失敗測試**

`worker/bootstrap.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "./test-helpers/kv-stub";
import { ensureBootstrap } from "./bootstrap";
import * as wspc from "./wspc";

beforeEach(() => vi.restoreAllMocks());

describe("ensureBootstrap", () => {
  it("creates project + type on KV miss and caches per user", async () => {
    const kv = makeKvStub();
    const projectSpy = vi
      .spyOn(wspc, "createProject")
      .mockResolvedValue({ id: "prj_1" });
    const typeSpy = vi
      .spyOn(wspc, "createTodoType")
      .mockResolvedValue({ id: "typ_1" });

    const out = await ensureBootstrap(kv, "at", "usr_a");
    expect(out).toEqual({ projectId: "prj_1", typeId: "typ_1" });
    expect(await kv.get("desk:bootstrap:usr_a")).toContain("prj_1");

    // second call reuses, no new create
    const out2 = await ensureBootstrap(kv, "at", "usr_a");
    expect(out2).toEqual({ projectId: "prj_1", typeId: "typ_1" });
    expect(projectSpy).toHaveBeenCalledTimes(1);
    expect(typeSpy).toHaveBeenCalledTimes(1);
  });

  it("bootstraps a different user independently", async () => {
    const kv = makeKvStub();
    vi.spyOn(wspc, "createProject").mockResolvedValue({ id: "prj_b" });
    vi.spyOn(wspc, "createTodoType").mockResolvedValue({ id: "typ_b" });
    const out = await ensureBootstrap(kv, "at", "usr_b");
    expect(out).toEqual({ projectId: "prj_b", typeId: "typ_b" });
    expect(await kv.get("desk:bootstrap:usr_a")).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run worker/bootstrap.test.ts`
Expected: FAIL（`ensureBootstrap` 不存在）

- [ ] **Step 3: 實作 `worker/bootstrap.ts`**

```ts
import { getBootstrap, putBootstrap, type BootstrapData } from "./kv";
import { createProject, createTodoType, type CustomFieldDecl } from "./wspc";

const DESK_TASK_FIELDS: CustomFieldDecl[] = [
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

export async function ensureBootstrap(
  kv: KVNamespace,
  accessToken: string,
  userId: string,
): Promise<BootstrapData> {
  const existing = await getBootstrap(kv, userId);
  if (existing) return existing;

  const project = await createProject(accessToken, "Desk");
  const type = await createTodoType(accessToken, {
    label: "DeskTask",
    projectId: project.id,
    customFields: DESK_TASK_FIELDS,
  });
  const data: BootstrapData = { projectId: project.id, typeId: type.id };
  await putBootstrap(kv, userId, data);
  return data;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run worker/bootstrap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worker/bootstrap.ts worker/bootstrap.test.ts
git commit -m "feat(worker): per-user lazy bootstrap for Desk project + DeskTask type"
```

---

## Task 4: Todo → Task mapper

**Files:**
- Create: `worker/todo-mapper.ts`
- Test: `worker/todo-mapper.test.ts`

- [ ] **Step 1: 寫失敗測試**

`worker/todo-mapper.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { mapTodoToTask } from "./todo-mapper";

describe("mapTodoToTask", () => {
  it("converts epoch-ms timestamps to ISO and flattens custom_fields", () => {
    const task = mapTodoToTask({
      id: "tod_1",
      status: "open",
      title: "Buy milk",
      created_at: 1748736000000,
      updated_at: 1748736000000,
      custom_fields: {
        scheduled_dates: ["2026-05-31"],
        daily_priority: "1",
        is_adhoc: "true",
      },
    });
    expect(task).toEqual({
      id: "tod_1",
      title: "Buy milk",
      status: "open",
      parent_id: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
      custom_fields: {
        scheduled_dates: ["2026-05-31"],
        daily_priority: "1",
        is_adhoc: "true",
      },
    });
  });

  it("defaults missing custom_fields to empty object", () => {
    const task = mapTodoToTask({
      id: "tod_2",
      status: "done",
      title: "x",
      created_at: 0,
      updated_at: 0,
    });
    expect(task.custom_fields).toEqual({});
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run worker/todo-mapper.test.ts`
Expected: FAIL（`mapTodoToTask` 不存在）

- [ ] **Step 3: 實作 `worker/todo-mapper.ts`**

```ts
import type { Todo } from "./wspc";
import type { Task, TaskCustomFields } from "../src/lib/types";

export function mapTodoToTask(todo: Todo): Task {
  return {
    id: todo.id,
    title: todo.title,
    status: todo.status,
    parent_id: null,
    created_at: new Date(todo.created_at).toISOString(),
    updated_at: new Date(todo.updated_at).toISOString(),
    custom_fields: (todo.custom_fields ?? {}) as TaskCustomFields,
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run worker/todo-mapper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worker/todo-mapper.ts worker/todo-mapper.test.ts
git commit -m "feat(worker): add Todo to Task mapper"
```

---

## Task 5: `/api/todo` 路由 + dispatcher

**Files:**
- Create: `worker/routes/todo.ts`
- Modify: `worker/index.ts`
- Test: `worker/routes/todo.test.ts`

- [ ] **Step 1: 寫失敗測試**

`worker/routes/todo.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { putSession, putBootstrap } from "../kv";
import { handleListTodo, handleCreateTodo, handlePatchTodo } from "./todo";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: KVNamespace };
}

async function seedSession(env: { DESK_KV: KVNamespace }) {
  await putSession(env.DESK_KV, "sid", {
    accessToken: "at",
    refreshToken: "rt",
    accessExp: Math.floor(Date.now() / 1000) + 600,
    userId: "usr_a",
  });
  await putBootstrap(env.DESK_KV, "usr_a", { projectId: "prj_1", typeId: "typ_1" });
}

const cookie = { Cookie: "__Host-Session=sid" };

beforeEach(() => vi.restoreAllMocks());

describe("GET /api/todo", () => {
  it("400 when date missing", async () => {
    const env = makeEnv();
    await seedSession(env);
    const req = new Request("https://d/api/todo", { headers: cookie });
    const res = await handleListTodo(req, env);
    expect(res.status).toBe(400);
  });

  it("returns mapped tasks filtered by date", async () => {
    const env = makeEnv();
    await seedSession(env);
    vi.spyOn(wspc, "listTodos").mockResolvedValue([
      {
        id: "tod_1",
        status: "open",
        title: "A",
        created_at: 0,
        updated_at: 0,
        custom_fields: { scheduled_dates: ["2026-05-31"] },
      },
    ]);
    const req = new Request("https://d/api/todo?date=2026-05-31", { headers: cookie });
    const res = await handleListTodo(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: { id: string }[] };
    expect(body.tasks[0].id).toBe("tod_1");
  });
});

describe("POST /api/todo", () => {
  it("creates a today adhoc task", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "createTodo").mockResolvedValue({
      id: "tod_new",
      status: "open",
      title: "New",
      created_at: 0,
      updated_at: 0,
      custom_fields: { scheduled_dates: ["2026-05-31"], is_adhoc: "true" },
    });
    const req = new Request("https://d/api/todo", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", date: "2026-05-31" }),
    });
    const res = await handleCreateTodo(req, env);
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][1].customFields).toEqual({
      scheduled_dates: ["2026-05-31"],
      is_adhoc: "true",
    });
  });
});

describe("PATCH /api/todo/:id", () => {
  it("translates semantic body to WSPC patch", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1",
      status: "done",
      title: "A",
      created_at: 0,
      updated_at: 0,
      custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", done_on: "2026-05-31T00:00:00Z" }),
    });
    const res = await handlePatchTodo(req, env, "tod_1");
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][2]).toEqual({
      status: "done",
      customFields: { done_on: "2026-05-31T00:00:00Z" },
    });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run worker/routes/todo.test.ts`
Expected: FAIL（handler 不存在）

- [ ] **Step 3: 實作 `worker/routes/todo.ts`**

```ts
import { withSession } from "../middleware/session";
import { ensureBootstrap } from "../bootstrap";
import { listTodos, createTodo, patchTodo } from "../wspc";
import { mapTodoToTask } from "../todo-mapper";

interface Env {
  DESK_KV: KVNamespace;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleListTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    const date = new URL(request.url).searchParams.get("date");
    if (!date) return json({ error: "date_required" }, 400);
    const { projectId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todos = await listTodos(accessToken, { projectId, date });
    return json({ tasks: todos.map(mapTodoToTask) });
  });
}

export async function handleCreateTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    const body = (await request.json()) as { title?: string; date?: string };
    if (!body.title || !body.date) return json({ error: "title_and_date_required" }, 400);
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todo = await createTodo(accessToken, {
      title: body.title,
      projectId,
      typeId,
      customFields: { scheduled_dates: [body.date], is_adhoc: "true" },
    });
    return json({ task: mapTodoToTask(todo) }, 201);
  });
}

export async function handlePatchTodo(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const body = (await request.json()) as {
      status?: "open" | "in_progress" | "done" | "cancelled";
      daily_priority?: string | null;
      done_on?: string | null;
    };
    const customFields: Record<string, string | null> = {};
    if ("daily_priority" in body) customFields.daily_priority = body.daily_priority ?? null;
    if ("done_on" in body) customFields.done_on = body.done_on ?? null;
    const todo = await patchTodo(accessToken, id, {
      status: body.status,
      customFields: Object.keys(customFields).length ? customFields : undefined,
    });
    return json({ task: mapTodoToTask(todo) });
  });
}
```

- [ ] **Step 4: dispatcher 接線（`worker/index.ts`）**

import 補：

```ts
import { handleListTodo, handleCreateTodo, handlePatchTodo } from "./routes/todo";
```

在 `/api/me` 區塊後、最終 404 前插入：

```ts
if (path === "/api/todo" && method === "GET") {
  return handleListTodo(request, env);
}
if (path === "/api/todo" && method === "POST") {
  return handleCreateTodo(request, env);
}
const todoIdMatch = path.match(/^\/api\/todo\/([^/]+)$/);
if (todoIdMatch && method === "PATCH") {
  return handlePatchTodo(request, env, decodeURIComponent(todoIdMatch[1]));
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run worker/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add worker/routes/todo.ts worker/routes/todo.test.ts worker/index.ts
git commit -m "feat(worker): add /api/todo list/create/patch routes"
```

---

## Task 6: 前端 todo API client

**Files:**
- Create: `src/lib/api/todo.ts`
- Test: `src/lib/api/todo.test.ts`

- [ ] **Step 1: 寫失敗測試**

`src/lib/api/todo.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTodos, postTodo, patchTodoApi } from "./todo";

beforeEach(() => vi.restoreAllMocks());

describe("todo api client", () => {
  it("fetchTodos hits /api/todo?date= and returns tasks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tasks: [{ id: "tod_1" }] }), { status: 200 }),
    );
    const tasks = await fetchTodos("2026-05-31");
    expect(tasks).toEqual([{ id: "tod_1" }]);
  });

  it("patchTodoApi sends semantic body", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ task: { id: "tod_1" } }), { status: 200 }),
    );
    await patchTodoApi("tod_1", { daily_priority: null });
    const init = spy.mock.calls[0][1]!;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ daily_priority: null });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/api/todo.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `src/lib/api/todo.ts`**

```ts
import type { Task, TaskStatus } from "@/lib/types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchTodos(date: string): Promise<Task[]> {
  const res = await fetch(`/api/todo?date=${encodeURIComponent(date)}`, {
    credentials: "same-origin",
  });
  const data = await jsonOrThrow<{ tasks: Task[] }>(res);
  return data.tasks;
}

export async function postTodo(title: string, date: string): Promise<Task> {
  const res = await fetch("/api/todo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, date }),
  });
  const data = await jsonOrThrow<{ task: Task }>(res);
  return data.task;
}

export interface TodoPatch {
  status?: TaskStatus;
  daily_priority?: string | null;
  done_on?: string | null;
}

export async function patchTodoApi(id: string, patch: TodoPatch): Promise<Task> {
  const res = await fetch(`/api/todo/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await jsonOrThrow<{ task: Task }>(res);
  return data.task;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/api/todo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/todo.ts src/lib/api/todo.test.ts
git commit -m "feat(frontend): add todo api client"
```

---

## Task 7: tasks store 換源 + 樂觀更新/回滾

**Files:**
- Modify: `src/store/tasks.ts`
- Test: `src/store/tasks.test.ts`

說明：保留 Slice 1 的 `taskOps` 純函式做本地變換；新增 `loadTasks(date)` 從 API 載入，並把每個 mutation 包成「樂觀改本地 → 背景發 API → 失敗回滾 + 設 error」。

- [ ] **Step 1: 寫失敗測試 — load + 樂觀回滾**

在 `src/store/tasks.test.ts` 新增（沿用該檔既有 import 風格）：

```ts
import * as api from "@/lib/api/todo";

describe("server-backed tasks store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useTasksStore.setState({ tasks: [], error: null });
  });

  it("loadTasks populates from api", async () => {
    vi.spyOn(api, "fetchTodos").mockResolvedValue([
      { id: "tod_1", title: "A", status: "open", parent_id: null,
        created_at: "x", updated_at: "x", custom_fields: { scheduled_dates: ["2026-05-31"] } },
    ]);
    await useTasksStore.getState().loadTasks("2026-05-31");
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["tod_1"]);
    expect(useTasksStore.getState().status).toBe("ready");
  });

  it("sets status=error when load fails", async () => {
    vi.spyOn(api, "fetchTodos").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().loadTasks("2026-05-31");
    expect(useTasksStore.getState().status).toBe("error");
  });

  it("rolls back toggleDone when patch fails", async () => {
    useTasksStore.setState({
      tasks: [{ id: "tod_1", title: "A", status: "open", parent_id: null,
        created_at: "x", updated_at: "x", custom_fields: { scheduled_dates: ["2026-05-31"] } }],
    });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().toggleDone("tod_1");
    expect(useTasksStore.getState().tasks[0].status).toBe("open"); // rolled back
    expect(useTasksStore.getState().error).not.toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: FAIL（`loadTasks` / `error` 不存在；actions 仍同步）

- [ ] **Step 3: 改寫 `src/store/tasks.ts`**

```ts
import { create } from "zustand";
import type { Priority, Task } from "@/lib/types";
import { fetchTodos, postTodo, patchTodoApi } from "@/lib/api/todo";
import {
  addTodayTask,
  deleteTask,
  editTitle,
  setDailyPriority,
  toggleDone,
} from "./taskOps";

const now = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);

interface TasksState {
  tasks: Task[];
  today: string;
  status: "loading" | "ready" | "error";
  error: string | null;
  loadTasks: (date: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  addTodayTask: (title: string) => Promise<void>;
  editTitle: (id: string, title: string) => void;
  deleteTask: (id: string) => Promise<void>;
  setDailyPriority: (id: string, n: Priority | null) => Promise<void>;
  clearTasks: () => void;
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  today: todayISO(),
  status: "loading",
  error: null,

  async loadTasks(date) {
    set({ status: "loading", error: null });
    try {
      const tasks = await fetchTodos(date);
      set({ tasks, today: date, status: "ready" });
    } catch {
      set({ status: "error", error: "load_failed" });
    }
  },

  // 樂觀更新工具：先改本地，背景發 API，失敗回滾。
  async toggleDone(id) {
    const prev = get().tasks;
    const target = prev.find((t) => t.id === id);
    if (!target) return;
    const willBeDone = target.status !== "done";
    const stamp = now();
    set({ tasks: toggleDone(prev, id, stamp), error: null });
    try {
      await patchTodoApi(id, {
        status: willBeDone ? "done" : "open",
        done_on: willBeDone ? stamp : null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async addTodayTask(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const today = get().today; // capture before await（避免切日 race）
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addTodayTask(prev, trimmed, today, tempId, now()), error: null });
    try {
      const created = await postTodo(trimmed, today);
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  editTitle(id, title) {
    // title 是 WSPC 核心欄位；2b 不打 server 標題 PATCH。純本地樂觀更新，
    // 沒有要 roll back 的請求（不發無意義的空 PATCH，避免假成功 + 下次 load 還原）。
    set({ tasks: editTitle(get().tasks, id, title, now()), error: null });
  },

  async deleteTask(id) {
    const prev = get().tasks;
    const { tasks } = deleteTask(prev, id);
    set({ tasks, error: null });
    try {
      await patchTodoApi(id, { status: "cancelled" });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async setDailyPriority(id, n) {
    const prev = get().tasks;
    const next = setDailyPriority(prev, id, n, get().today);
    set({ tasks: next, error: null });
    // 找出 daily_priority 有變動的 task（含被騰位者），各發一筆 PATCH。
    const changed = next.filter((t) => {
      const before = prev.find((p) => p.id === t.id);
      return before && before.custom_fields.daily_priority !== t.custom_fields.daily_priority;
    });
    try {
      await Promise.all(
        changed.map((t) =>
          patchTodoApi(t.id, { daily_priority: t.custom_fields.daily_priority ?? null }),
        ),
      );
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  clearTasks() {
    set({ tasks: [], error: null });
  },
}));
```

> 註：移除了 `persist`、`recentlyDeleted` / `restoreTask` / `promoteToPriority` 與 mock seed。delete 改 soft-delete（不再做本地 undo buffer，回滾改由 mutation 失敗處理）。`editTitle` 在 2b 不打 server 標題欄位（WSPC `title` 為核心欄位，PATCH 標題的支援可後續加；此步只保留樂觀本地更新與失敗回滾骨架）。

- [ ] **Step 4: 更新既有 store 測試**

`src/store/tasks.test.ts` 既有測試若依賴 `persist` / `recentlyDeleted` / `promoteToPriority` / 同步 action，改為 `await` 並 mock `@/lib/api/todo`。被移除的功能對應測試刪除。

- [ ] **Step 5: 修呼叫端**

`src/features/day/useTaskRow.ts`、`AddTaskInput.tsx`、`DeleteUndoToast.tsx`、`Top3Card`、`DayColumn` 等呼叫 store action 處：action 現在回傳 Promise，呼叫端不需改 await（fire-and-forget 即可），但移除對 `restoreTask` / `recentlyDeleted` / `promoteToPriority` 的引用。`DeleteUndoToast` 若仰賴 undo buffer，本片改為單純「刪除中／失敗提示」或移除（依現有 UI，最小改動是移除 undo 行為、保留刪除）。

- [ ] **Step 6: 跑測試確認通過**

Run: `npx vitest run src/store/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts src/features/day/
git commit -m "feat(frontend): server-backed tasks store with optimistic update + rollback"
```

---

## Task 8: 真實 today + 切換日期

**Files:**
- Modify: `src/routes/today.tsx`
- Test: `src/routes/today.test.tsx`（若無則新增）

- [ ] **Step 1: 寫失敗測試 — 掛載時依日期載入**

`src/routes/today.test.tsx`（用既有測試設定 render route component）：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import * as api from "@/lib/api/todo";
import { TodayView } from "./today";

beforeEach(() => vi.restoreAllMocks());

it("loads tasks for the resolved date on mount", async () => {
  const spy = vi.spyOn(api, "fetchTodos").mockResolvedValue([]);
  render(<TodayView date="2026-05-31" />);
  await waitFor(() => expect(spy).toHaveBeenCalledWith("2026-05-31"));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/routes/today.test.tsx`
Expected: FAIL（`TodayView` 未匯出 / 未依 date 載入）

- [ ] **Step 3: 在 `today.tsx` 抽出 `TodayView` 並依 date 載入**

把 today route 的畫面抽成可測元件，掛載時呼叫 `loadTasks`：

```tsx
import { useEffect } from "react";
import { useTasksStore } from "@/store/tasks";

export function TodayView({ date }: { date: string }) {
  const status = useTasksStore((s) => s.status);
  useEffect(() => {
    useTasksStore.getState().loadTasks(date);
  }, [date]);

  if (status === "loading") return <TodaySkeleton />;
  if (status === "error") {
    return (
      <div role="alert">
        載入失敗
        <button onClick={() => useTasksStore.getState().loadTasks(date)}>重試</button>
      </div>
    );
  }
  // …既有 Today 版型，改讀 store.tasks（status === "ready"，含空狀態）…
  return /* 既有 JSX */;
}
```

`TodaySkeleton` 是簡單的佔位元件（沿用既有 token / 樣式畫幾條灰階列即可，無需動畫）。route component 解析 date（預設真實今天，`/today/$date` 帶該日）後渲染 `<TodayView date={date} />`。新增選擇性 route param 檔 `src/routes/today.$date.tsx`（TanStack Router 慣例），重用 `TodayView`。

bootstrap 的延遲被 `status === "loading"` 的 skeleton 統一吸收，不需要專屬的「初始化中」畫面（見 spec「載入狀態」）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/routes/today.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/today.tsx src/routes/today.\$date.tsx src/routes/today.test.tsx src/routeTree.gen.ts
git commit -m "feat(frontend): load tasks by real/selected date in Today"
```

---

## Task 9: 登出清空 task 快取

**Files:**
- Modify: `src/store/auth.ts`
- Test: `src/store/auth.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/store/auth.test.ts` 加：

```ts
import { useTasksStore } from "./tasks";

it("clear() also empties tasks cache", () => {
  useTasksStore.setState({ tasks: [{ id: "x" } as never] });
  useAuthStore.getState().clear();
  expect(useTasksStore.getState().tasks).toEqual([]);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/auth.test.ts`
Expected: FAIL（tasks 未被清）

- [ ] **Step 3: `clear()` 連帶清 tasks（`src/store/auth.ts`）**

import 並在 `clear` 內呼叫：

```ts
import { useTasksStore } from "./tasks";
// …
clear() {
  useTasksStore.getState().clearTasks();
  set({ me: null, status: "unauthenticated" });
},
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/store/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/auth.ts src/store/auth.test.ts
git commit -m "feat(frontend): clear task cache on logout (multi-tenant)"
```

---

## Task 10: 全量驗證 + lint + 型別

**Files:** 無（驗證關卡）

- [ ] **Step 1: 全測試**

Run: `npx vitest run`
Expected: 全綠。

- [ ] **Step 2: 型別 + lint**

Run: `npm run build && npm run lint`
Expected: 無 TypeScript error、無 eslint error。

- [ ] **Step 3: 線上 cf 行為回歸檢查**

Run: `node scripts/verify-wspc.mjs`
Expected: SUMMARY 中 `cf dotted contains-filter` = WORKS（確認 server 端過濾前提仍成立）。

- [ ] **Step 4: 部署後手動驗收**（對照 spec「驗收標準」1–10）

```
1. 登入 → Today 顯示真實 WSPC 資料。
2. 第一次使用自動建 Desk project + DeskTask type；wrangler kv key list 可見 desk:bootstrap:<user_id>。
3. 新增 / 勾選 / 取消 / 編輯 / 刪除 / 設 priority 後刷新仍在。
4. 設 priority 撞號時 server 端被騰者 daily_priority 被清。
5. 斷網狀態下操作 → UI 回滾 + 錯誤提示。
6. /today/2026-05-30 載入該日資料。
7. 第二帳號登入只看到自己的資料；兩帳號 bootstrap 互不干擾。
8. 登出後再登入他人帳號，看不到前一人資料。
```

- [ ] **Step 5: 回填 ROADMAP**

把 Slice 2b checklist 補一條「lazy 建立 Desk project + KV 存 project_id（per-user）」放在 type 註冊前；2b 完成的項目打勾；標 `cf` 為已實證依賴並指向 `scripts/verify-wspc.mjs`。

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): mark Slice 2b complete, note project bootstrap + cf"
```

---

## Self-Review（規劃者自查結果）

- **Spec coverage：** bootstrap(Task 3) / list-create-patch(Task 5) / cf 過濾(Task 2,5) / Todo→Task(Task 4) / per-user multi-tenant(Task 1,3) / 真實 today + 切日(Task 8) / 載入狀態含首次 bootstrap 吸收(Task 7 store status + Task 8 skeleton) / soft-delete(Task 7) / seed→載入(Task 7) / 騰位兩筆(Task 7) / 樂觀+回滾(Task 7) / 登出清快取(Task 9) / cf key 防呆(Task 2) / 測試與驗收(Task 10) — spec 各段皆有對應 task。
- **Placeholder scan：** 無 TBD/TODO；每個改 code 的 step 都附完整程式碼。`editTitle` 對 server 的標題 PATCH 明確標為本片不做（只保留樂觀本地 + 回滾骨架），非 placeholder 而是範圍決策。
- **Type consistency：** `SessionContext { accessToken, userId }`、`BootstrapData { projectId, typeId }`、`Todo`、`mapTodoToTask`、API client `fetchTodos/postTodo/patchTodoApi`、store action 皆 async 回 Promise，跨 task 命名一致。
- **已知範圍排除（對齊 spec「不做」）：** 軌跡寫入、略過、Monthly、Backlog、carryover、position 排序、Plan 可寫、bootstrap race lock、WSPC 標題 PATCH。
