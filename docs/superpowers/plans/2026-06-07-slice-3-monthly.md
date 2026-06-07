# Slice 3 — Monthly 欄互動 + promote 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 把 Plan mode 的 Monthly 欄從唯讀變可寫（加入 / `monthly_priority` / promote 到選取日 / 完成・編輯・刪除 / 月份切換），並把資料載入改成「一次載入全部、client 端 derive」。

**架構:** BFF list 改成回該使用者所有非 cancelled task（方案 A），store 改 load-once、`today` = 真實今天；月 / 週 / 日 / backlog 全部用既有 client derivation 拆。Monthly 互動採「選項 1：平行新建」——新增 `useMonthRow` 與月層 store ops、讓 `MonthRow` / `MonthHeroCard` 自己變互動，**完全不動 Today 的 `TaskRow` / `Top3Card`**。

**技術棧:** React 18 + TypeScript、Zustand、TanStack Router（file-based）、Base UI、CSS Modules、Cloudflare Workers（BFF）、vitest + Testing Library、Playwright（e2e）。

**設計來源:** [docs/superpowers/specs/2026-06-07-slice-3-monthly-design.md](../specs/2026-06-07-slice-3-monthly-design.md)

**通用約定:**
- 安裝相依套件需 `npm install --legacy-peer-deps`。
- 每個任務跑 `npx vitest run`（jsdom 單元 / 元件）；動到互動或載入的任務最後另跑 `npm run test:e2e`。
- 型別檢查：app `npx tsc -p tsconfig.json --noEmit`、worker `npx tsc -p tsconfig.worker.json --noEmit`（若專案的 script 名不同，依 `package.json` 為準）。
- `routeTree.gen.ts` 由 `@tanstack/router` 的 Vite plugin 自動產生：**新增 route 檔後跑一次 `npm run dev`（或 build）讓它重生，勿手改**，再一起 commit。

---

## 檔案結構總覽

**修改:**
- `src/lib/types.ts` — 移除 `Task.parent_id`
- `src/mock/data.ts` — 移除 `parent_id`、清掉 `d1` 殘留的對應描述
- `worker/todo-mapper.ts` — 不再寫 `parent_id`
- `src/lib/date.ts` — 加 `isValidMonthParam` / `prevMonth` / `nextMonth`
- `worker/wspc.ts` — `listTodos` 改不帶 `cf.`、可帶 `type_id`；`patchTodo` customFields 型別放寬到含 `string[]`
- `worker/routes/todo.ts` — list 不要求 date、create 泛化、patch 擴充欄位
- `src/lib/api/todo.ts` — `fetchTodos()` 去 date、`postTodo` 泛化、`TodoPatch` 擴充
- `src/store/taskOps.ts` — 加 `promoteToDay` / `setMonthlyPriority` / `addMonthTask`
- `src/store/tasks.ts` — `loadTasks()` load-once + `reload()`、`today` = 真實今天、加月層 actions、create 呼叫點泛化
- `src/routes/today.tsx` — effect 改 load-once、skeleton 含 idle
- `src/routes/plan.tsx` — 改成 layout（`<Outlet/>`）+ 匯出 `PlanView`
- `src/features/month/MonthColumn.tsx` — 月份 stepper、傳 `selectedDate`、互動、空狀態、Monthly +
- `src/features/month/MonthRow.tsx` — 唯讀 → 互動
- `src/features/month/MonthHeroCard.tsx` — 唯讀 → 月層互動 hero
- 多個既有測試檔（移除 `parent_id`、改 loadTasks 合約）

**新增:**
- `src/routes/plan.index.tsx` — `/plan/` → 當月
- `src/routes/plan.$month.tsx` — `/plan/$month` → 指定月
- `src/features/month/useMonthRow.ts` — 月層列互動 hook
- `src/features/month/AddMonthTaskInput.tsx` — Monthly + 加入點
- 對應測試檔

---

## Task 1：淘汰 `parent_id`

把 Slice 1 遺留、與資料模型矛盾的 `parent_id` 從型別 / mock / mapper 全部移除。

**Files:**
- Modify: `src/lib/types.ts`、`src/mock/data.ts`、`worker/todo-mapper.ts`
- Test: `worker/todo-mapper.test.ts`、`src/store/tasks.test.ts`、`src/features/day/*.test.tsx`（移除 literal 中的 `parent_id`）

- [ ] **Step 1：先看清楚 parent_id 散在哪**

Run: `npx grep`（用 Grep 工具）搜 `parent_id`，逐檔處理。預期出現在上列檔案與測試。

- [ ] **Step 2：移除型別欄位**

`src/lib/types.ts` 的 `Task` 介面刪掉這行：

```ts
  parent_id?: string | null;
```

- [ ] **Step 3：mock/data.ts 去 parent_id**

`src/mock/data.ts` 的 `task()` helper 刪掉 `parent_id: o.parent_id ?? null,` 這行；並把 `d1` 那筆的 `parent_id: "m1",` 與殘留描述 `description: "對應月度任務:推出 desk.yurenju.me MVP",` 一併刪掉（`d1` 改為無 description）。

- [ ] **Step 4：mapper 去 parent_id**

`worker/todo-mapper.ts` 刪掉 `parent_id: null,` 這行。

- [ ] **Step 5：清測試 literal**

把所有測試物件 literal 內的 `parent_id: null,`（以及任何 `parent_id: "..."`）刪除——`worker/todo-mapper.test.ts`、`src/store/tasks.test.ts`、`src/features/day/DayColumn.test.tsx`、`src/features/day/AddTaskInput.test.tsx`、`src/features/day/DeleteUndoToast.test.tsx` 等。移除型別欄位後，這些殘留的多餘屬性會觸發 TS2353，逐一刪掉即可。

- [ ] **Step 6：跑測試 + 型別**

Run: `npx vitest run`、app + worker `tsc --noEmit`
Expected: 全 PASS、無 `parent_id` 相關型別錯誤。

- [ ] **Step 7：Commit**

```bash
git add -A
git commit -m "refactor(slice-3): drop parent_id from task model"
```

---

## Task 2：`date.ts` 月份 helper

月份切換要驗證與進位的純函式。

**Files:**
- Modify: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `src/lib/date.test.ts` 末尾加：

```ts
import { isValidMonthParam, prevMonth, nextMonth } from "./date";

describe("month helpers", () => {
  it("isValidMonthParam accepts YYYY-MM, rejects others", () => {
    expect(isValidMonthParam("2026-05")).toBe(true);
    expect(isValidMonthParam("2026-5")).toBe(false);
    expect(isValidMonthParam("2026-05-01")).toBe(false);
    expect(isValidMonthParam("garbage")).toBe(false);
  });

  it("prevMonth / nextMonth step with year rollover", () => {
    expect(prevMonth("2026-05")).toBe("2026-04");
    expect(nextMonth("2026-05")).toBe("2026-06");
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/date.test.ts`
Expected: FAIL（未匯出這些函式）。

- [ ] **Step 3：實作**

在 `src/lib/date.ts` 末尾加：

```ts
/** Returns true if `s` matches the YYYY-MM format. */
export function isValidMonthParam(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s);
}

function shiftMonth(monthISO: string, delta: number): string {
  const [y, m] = monthISO.split("-").map(Number);
  const idx = (y * 12 + (m - 1)) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Previous calendar month, e.g. "2026-01" -> "2025-12". */
export function prevMonth(monthISO: string): string {
  return shiftMonth(monthISO, -1);
}

/** Next calendar month, e.g. "2026-12" -> "2027-01". */
export function nextMonth(monthISO: string): string {
  return shiftMonth(monthISO, 1);
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/date.test.ts`
Expected: PASS。

- [ ] **Step 5：Commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts
git commit -m "feat(slice-3): add month param helpers to date lib"
```

---

## Task 3：BFF list 改成全載（不帶 `cf.`，可帶 `type_id`）

`listTodos` 與 `handleListTodo` 改方案 A：只用 `project_id` + `status`(open/in_progress/done) + 可選 `type_id`，回該使用者所有非 cancelled task。

**Files:**
- Modify: `worker/wspc.ts`、`worker/routes/todo.ts`
- Test: `worker/wspc.test.ts`、`worker/routes/todo.test.ts`

- [ ] **Step 1：改 list 測試（route 層）**

`worker/routes/todo.test.ts` 的 `describe("GET /api/todo")` 整段換成：

```ts
describe("GET /api/todo", () => {
  it("lists all non-cancelled tasks without a date filter", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "listTodos").mockResolvedValue([
      { id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0,
        custom_fields: { scheduled_months: ["2026-05"] } },
    ]);
    const req = new Request("https://d/api/todo", { headers: cookie });
    const res = await handleListTodo(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: { id: string }[] };
    expect(body.tasks[0].id).toBe("tod_1");
    // scopes to the bootstrapped project + type, no date/cf filter
    expect(spy.mock.calls[0][1]).toEqual({ projectId: "prj_1", typeId: "typ_1" });
  });
});
```

- [ ] **Step 2：改 list 測試（wspc 層）**

在 `worker/wspc.test.ts` 找既有 `listTodos` 測試（用 `fetch` mock 斷言 URL 帶 `cf.scheduled_dates`）。改成斷言 URL **不含** `cf.`、含 `project_id` / `type_id` / 三個 `status`：

```ts
it("listTodos queries project + type + statuses, no cf filter", async () => {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify({ todos: [] }), { status: 200 });
  }));
  await listTodos("at", { projectId: "prj_1", typeId: "typ_1" });
  const u = new URL(calls[0]);
  expect(u.searchParams.get("project_id")).toBe("prj_1");
  expect(u.searchParams.get("type_id")).toBe("typ_1");
  expect(u.searchParams.getAll("status")).toEqual(["open", "in_progress", "done"]);
  expect(calls[0]).not.toContain("cf.");
});
```

> 若 `worker/wspc.test.ts` 既有的 listTodos 測試簽章 / mock 形式不同，沿用該檔現有的 fetch-stub 寫法改寫，重點是斷言「無 cf、有 type_id、三個 status」。

- [ ] **Step 3：跑測試確認失敗**

Run: `npx vitest run worker/routes/todo.test.ts worker/wspc.test.ts`
Expected: FAIL（簽章還是舊的 `{ projectId, date }`）。

- [ ] **Step 4：改 `listTodos`**

`worker/wspc.ts`：移除 `CF_SCHEDULED_DATES` 常數，`listTodos` 改為：

```ts
export async function listTodos(
  accessToken: string,
  opts: { projectId: string; typeId: string },
): Promise<Todo[]> {
  const params = new URLSearchParams();
  params.set("project_id", opts.projectId);
  params.set("type_id", opts.typeId);
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
```

> 留意：移除 `CF_SCHEDULED_DATES` 後，若 `worker/wspc.ts` 內或測試還有 import 它，一併清掉。`scripts/verify-wspc.mjs` 是獨立腳本、硬編字串，不 import 此常數，本片不動它（其 cf 回歸檢查對本片已無意義，列為另案）。

- [ ] **Step 5：改 `handleListTodo`**

`worker/routes/todo.ts` 的 `handleListTodo` 改為（去掉 date 解析與驗證）：

```ts
export async function handleListTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todos = await listTodos(accessToken, { projectId, typeId });
    return json({ tasks: todos.map(mapTodoToTask) });
  });
}
```

- [ ] **Step 6：跑測試確認通過**

Run: `npx vitest run worker/routes/todo.test.ts worker/wspc.test.ts` + worker `tsc --noEmit`
Expected: PASS。

- [ ] **Step 7：Commit**

```bash
git add worker/wspc.ts worker/routes/todo.ts worker/wspc.test.ts worker/routes/todo.test.ts
git commit -m "feat(slice-3): BFF lists all non-cancelled tasks (drop cf date filter)"
```

---

## Task 4：前端載入改 load-once + `today` = 真實今天

`fetchTodos()` 去掉 date；store 改 `loadTasks()`（load-once）+ `reload()`（強制）；`today` 設成真實今天；`status` 加 `"idle"`。

**Files:**
- Modify: `src/lib/api/todo.ts`、`src/store/tasks.ts`、`src/routes/today.tsx`
- Test: `src/store/tasks.test.ts`

- [ ] **Step 1：改 `fetchTodos` 簽章**

`src/lib/api/todo.ts`：

```ts
export async function fetchTodos(): Promise<Task[]> {
  const res = await fetch(`/api/todo`, { credentials: "same-origin" });
  const data = await jsonOrThrow<{ tasks: Task[] }>(res);
  return data.tasks;
}
```

- [ ] **Step 2：改 store 載入測試**

`src/store/tasks.test.ts` 的 `describe("server-backed tasks store")` 內：
- `loadTasks populates from api`：改為呼叫 `loadTasks()`（無參數），先把 store 設成 `idle`，斷言 `fetchTodos` 被呼叫、status 變 ready：

```ts
  it("loadTasks populates from api (load-once)", async () => {
    useTasksStore.setState({ tasks: [], status: "idle" });
    vi.spyOn(api, "fetchTodos").mockResolvedValue([
      { id: "tod_1", title: "A", status: "open",
        created_at: "x", updated_at: "x", custom_fields: { scheduled_months: ["2026-05"] } },
    ]);
    await useTasksStore.getState().loadTasks();
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["tod_1"]);
    expect(useTasksStore.getState().status).toBe("ready");
  });

  it("loadTasks is a no-op when already ready", async () => {
    useTasksStore.setState({ tasks: [], status: "ready" });
    const spy = vi.spyOn(api, "fetchTodos");
    await useTasksStore.getState().loadTasks();
    expect(spy).not.toHaveBeenCalled();
  });
```

- 把 `sets status=error when load fails` 改成 `idle` 起點、呼叫 `loadTasks()`。
- 把 `ignores a stale load...` 改成測 `reload()`（強制連續兩次），並把斷言 `today` 那行改成斷言 `today === todayISO()`（import `todayISO`）；兩次 `reload` 用 `mockReturnValueOnce` 控制解析順序，最終取最後一次 `++loadSeq` 勝出。
- `setDailyPriority reloads from server when a patch fails`：把 `expect(reload).toHaveBeenCalledWith(MOCK_TODAY)` 改成 `expect(reload).toHaveBeenCalled()`（reload 不帶參數）。

- [ ] **Step 3：跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: FAIL。

- [ ] **Step 4：改 store**

`src/store/tasks.ts`：
- `status` 型別加 `"idle"`：`status: "idle" | "loading" | "ready" | "error";`，初值改 `status: "idle"`。
- import 改用 `todayISO` from `@/lib/date`（移除本地 `todayISO`），`today` 初值 `todayISO()`。
- 介面把 `loadTasks: (date: string) => Promise<void>` 改成 `loadTasks: () => Promise<void>` 並新增 `reload: () => Promise<void>`。
- 實作：

```ts
  async loadTasks() {
    const st = get().status;
    if (st === "ready" || st === "loading") return; // load-once
    await get().reload();
  },

  async reload() {
    const seq = ++loadSeq;
    set({ status: "loading", error: null });
    try {
      const tasks = await fetchTodos();
      if (seq !== loadSeq) return;
      set({ tasks, today: todayISO(), status: "ready" });
    } catch {
      if (seq !== loadSeq) return;
      set({ status: "error", error: "load_failed" });
    }
  },
```

- `setDailyPriority` 失敗分支裡的 `await get().loadTasks(get().today)` 改成 `await get().reload()`。

- [ ] **Step 5：改 today route 載入點**

`src/routes/today.tsx`：
- effect 改 load-once：

```ts
  useEffect(() => {
    useTasksStore.getState().loadTasks();
  }, []);
```

- skeleton 條件含 idle：`if (status === "loading" || status === "idle") return <TodaySkeleton />;`
- error 的「重試」按鈕 `onClick` 改 `() => useTasksStore.getState().reload()`。
- `TodayView` 仍以 `today={today}`（真實今天）、`selectedDate={date}` 傳給 `TodayLayout`（保持兩者分離；本片之後 `today` 才真的等於真實今天，修掉「看別天時把 today 標錯」的潛在問題）。

- [ ] **Step 6：跑測試 + 型別**

Run: `npx vitest run`、app `tsc --noEmit`
Expected: PASS。

- [ ] **Step 7：Commit**

```bash
git add src/lib/api/todo.ts src/store/tasks.ts src/routes/today.tsx src/store/tasks.test.ts
git commit -m "feat(slice-3): load-once task fetch, today = real today"
```

---

## Task 5：BFF create 泛化（支援 month 加入點）

`/api/todo` POST 改成依加入點組 custom_fields；前端 `postTodo` 改傳明確欄位；store `addTodayTask` 呼叫點跟著改。

**Files:**
- Modify: `worker/routes/todo.ts`、`src/lib/api/todo.ts`、`src/store/tasks.ts`
- Test: `worker/routes/todo.test.ts`、`src/store/tasks.test.ts`

- [ ] **Step 1：改 / 加 create 測試（route 層）**

`worker/routes/todo.test.ts` 的 `describe("POST /api/todo")`：既有「today adhoc」測試改成送新 body 形狀並斷言 customFields；再加一筆 month 加入點：

```ts
describe("POST /api/todo", () => {
  it("creates a today adhoc task", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "createTodo").mockResolvedValue({
      id: "tod_new", status: "open", title: "New", created_at: 0, updated_at: 0,
      custom_fields: { scheduled_dates: ["2026-05-31"], is_adhoc: "true" },
    });
    const req = new Request("https://d/api/todo", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", scheduled_dates: ["2026-05-31"], is_adhoc: "true" }),
    });
    const res = await handleCreateTodo(req, env);
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][1].customFields).toEqual({
      scheduled_dates: ["2026-05-31"], is_adhoc: "true",
    });
  });

  it("creates a month-scoped task", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "createTodo").mockResolvedValue({
      id: "tod_m", status: "open", title: "Plan", created_at: 0, updated_at: 0,
      custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
    });
    const req = new Request("https://d/api/todo", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Plan", scheduled_months: ["2026-05"], is_adhoc: "false" }),
    });
    const res = await handleCreateTodo(req, env);
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][1].customFields).toEqual({
      scheduled_months: ["2026-05"], is_adhoc: "false",
    });
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run worker/routes/todo.test.ts`
Expected: FAIL。

- [ ] **Step 3：改 `handleCreateTodo`**

`worker/routes/todo.ts`：

```ts
export async function handleCreateTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    let body: {
      title?: string;
      scheduled_dates?: string[];
      scheduled_months?: string[];
      is_adhoc?: "true" | "false";
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const title = body.title?.trim();
    if (!title) return json({ error: "title_required" }, 400);
    const customFields: Record<string, string | string[]> = {};
    if (body.scheduled_dates) customFields.scheduled_dates = body.scheduled_dates;
    if (body.scheduled_months) customFields.scheduled_months = body.scheduled_months;
    if (body.is_adhoc) customFields.is_adhoc = body.is_adhoc;
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todo = await createTodo(accessToken, { title, projectId, typeId, customFields });
    return json({ task: mapTodoToTask(todo) }, 201);
  });
}
```

- [ ] **Step 4：改前端 `postTodo`**

`src/lib/api/todo.ts`：

```ts
export interface CreateTodoInput {
  title: string;
  scheduled_dates?: string[];
  scheduled_months?: string[];
  is_adhoc?: "true" | "false";
}

export async function postTodo(input: CreateTodoInput): Promise<Task> {
  const res = await fetch("/api/todo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ task: Task }>(res);
  return data.task;
}
```

- [ ] **Step 5：改 store `addTodayTask` 呼叫點**

`src/store/tasks.ts` 的 `addTodayTask` action 內，把 `await postTodo(trimmed, today)` 改成：

```ts
      const created = await postTodo({
        title: trimmed,
        scheduled_dates: [today],
        is_adhoc: "true",
      });
```

`src/store/tasks.test.ts` 的 `addTodayTask` 測試把 `postTodo` mock 的呼叫斷言（若有）對齊新形狀；回傳值不變即可通過。

- [ ] **Step 6：跑測試 + 型別**

Run: `npx vitest run worker/routes/todo.test.ts src/store/tasks.test.ts`、app + worker `tsc --noEmit`
Expected: PASS。

- [ ] **Step 7：Commit**

```bash
git add worker/routes/todo.ts src/lib/api/todo.ts src/store/tasks.ts worker/routes/todo.test.ts src/store/tasks.test.ts
git commit -m "feat(slice-3): generalize todo create for month add-point"
```

---

## Task 6：BFF patch 擴充（`monthly_priority` + 陣列欄位）

PATCH 支援 `monthly_priority`、`scheduled_dates`、`scheduled_months`；wspc `patchTodo` customFields 型別放寬到含 `string[]`。

**Files:**
- Modify: `worker/wspc.ts`、`worker/routes/todo.ts`、`src/lib/api/todo.ts`
- Test: `worker/routes/todo.test.ts`

- [ ] **Step 1：加 patch 測試**

`worker/routes/todo.test.ts` 的 `describe("PATCH /api/todo/:id")` 內加：

```ts
  it("translates monthly_priority and array fields to custom fields", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        monthly_priority: "1",
        scheduled_dates: ["2026-05-22", "2026-05-23"],
      }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2]).toEqual({
      status: undefined,
      customFields: {
        monthly_priority: "1",
        scheduled_dates: ["2026-05-22", "2026-05-23"],
      },
    });
  });

  it("sends monthly_priority null to clear", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ monthly_priority: null }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2].customFields).toEqual({ monthly_priority: null });
  });
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run worker/routes/todo.test.ts`
Expected: FAIL。

- [ ] **Step 3：放寬 `patchTodo` 型別**

`worker/wspc.ts` 的 `patchTodo` body 型別：

```ts
  body: {
    status?: Todo["status"];
    customFields?: Record<string, string | string[] | null>;
    title?: string;
  },
```

（函式內 `payload.custom_fields = body.customFields;` 不變。）

- [ ] **Step 4：擴充 `handlePatchTodo`**

`worker/routes/todo.ts` 的 body 型別與映射加上新欄位：

```ts
    let body: {
      status?: "open" | "in_progress" | "done" | "cancelled";
      daily_priority?: string | null;
      monthly_priority?: string | null;
      done_on?: string | null;
      is_adhoc?: "true" | "false";
      title?: string;
      scheduled_dates?: string[];
      scheduled_months?: string[];
    };
    // ... parse 同前 ...
    const customFields: Record<string, string | string[] | null> = {};
    if ("daily_priority" in body) customFields.daily_priority = body.daily_priority ?? null;
    if ("monthly_priority" in body) customFields.monthly_priority = body.monthly_priority ?? null;
    if ("done_on" in body) customFields.done_on = body.done_on ?? null;
    if ("is_adhoc" in body) customFields.is_adhoc = body.is_adhoc ?? null;
    if ("scheduled_dates" in body && body.scheduled_dates) customFields.scheduled_dates = body.scheduled_dates;
    if ("scheduled_months" in body && body.scheduled_months) customFields.scheduled_months = body.scheduled_months;
```

（`parse` 的 try/catch 與 `body = (await request.json())` 一併把型別換成上面的擴充版。）

- [ ] **Step 5：擴充前端 `TodoPatch`**

`src/lib/api/todo.ts` 的 `TodoPatch`：

```ts
export interface TodoPatch {
  status?: TaskStatus;
  daily_priority?: string | null;
  monthly_priority?: string | null;
  done_on?: string | null;
  is_adhoc?: "true" | "false";
  title?: string;
  scheduled_dates?: string[];
  scheduled_months?: string[];
}
```

- [ ] **Step 6：跑測試 + 型別**

Run: `npx vitest run worker/routes/todo.test.ts`、app + worker `tsc --noEmit`
Expected: PASS。

- [ ] **Step 7：Commit**

```bash
git add worker/wspc.ts worker/routes/todo.ts src/lib/api/todo.ts worker/routes/todo.test.ts
git commit -m "feat(slice-3): BFF patch supports monthly_priority + array fields"
```

---

## Task 7：月層 store 純函式（`taskOps`）

`promoteToDay` / `setMonthlyPriority` / `addMonthTask` 三個純函式。

**Files:**
- Modify: `src/store/taskOps.ts`
- Test: `src/store/taskOps.test.ts`

- [ ] **Step 1：寫失敗測試**

`src/store/taskOps.test.ts` 末尾加（沿用檔內既有 import / helper 風格）：

```ts
import { promoteToDay, setMonthlyPriority, addMonthTask } from "./taskOps";

function mk(id: string, cf: Record<string, unknown>) {
  return { id, title: id, status: "open" as const,
    created_at: "x", updated_at: "x", custom_fields: cf };
}

describe("promoteToDay", () => {
  it("appends the date to scheduled_dates", () => {
    const tasks = [mk("a", { scheduled_months: ["2026-05"] })];
    const out = promoteToDay(tasks, "a", "2026-05-22");
    expect(out[0].custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
  });
  it("is a no-op when date is already the last entry", () => {
    const tasks = [mk("a", { scheduled_dates: ["2026-05-21", "2026-05-22"] })];
    const out = promoteToDay(tasks, "a", "2026-05-22");
    expect(out[0].custom_fields.scheduled_dates).toEqual(["2026-05-21", "2026-05-22"]);
  });
});

describe("setMonthlyPriority", () => {
  it("sets priority and evicts the collider within the same month", () => {
    const tasks = [
      mk("a", { scheduled_months: ["2026-05"], monthly_priority: "1" }),
      mk("b", { scheduled_months: ["2026-05"] }),
    ];
    const out = setMonthlyPriority(tasks, "b", "1", "2026-05");
    expect(out.find((t) => t.id === "b")!.custom_fields.monthly_priority).toBe("1");
    expect(out.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBeUndefined();
  });
  it("does not evict a collider in a different month", () => {
    const tasks = [
      mk("a", { scheduled_months: ["2026-04"], monthly_priority: "1" }),
      mk("b", { scheduled_months: ["2026-05"] }),
    ];
    const out = setMonthlyPriority(tasks, "b", "1", "2026-05");
    expect(out.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBe("1");
  });
  it("clears priority when n is null", () => {
    const tasks = [mk("a", { scheduled_months: ["2026-05"], monthly_priority: "2" })];
    const out = setMonthlyPriority(tasks, "a", null, "2026-05");
    expect(out[0].custom_fields.monthly_priority).toBeUndefined();
  });
});

describe("addMonthTask", () => {
  it("creates a month-scoped non-adhoc task", () => {
    const out = addMonthTask([], "計畫", "2026-05", "tmp-1", "2026-05-01T00:00:00Z");
    expect(out[0].custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(out[0].custom_fields.is_adhoc).toBe("false");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts`
Expected: FAIL。

- [ ] **Step 3：實作**

`src/store/taskOps.ts`：先把頂部 import 補上 `primaryMonth`：

```ts
import { primaryDate, primaryMonth } from "@/lib/tasks";
```

末尾加：

```ts
export function promoteToDay(tasks: Task[], id: string, date: string): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const arr = t.custom_fields.scheduled_dates ?? [];
    if (arr[arr.length - 1] === date) return t; // already there
    return patch(t, { scheduled_dates: [...arr, date] });
  });
}

export function setMonthlyPriority(
  tasks: Task[],
  id: string,
  n: Priority | null,
  month: string,
): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) => {
    if (t.id === id) return patch(t, { monthly_priority: n ?? undefined });
    // eviction: clear the collider among this month's primary tasks
    if (n !== null && primaryMonth(t) === month && t.custom_fields.monthly_priority === n) {
      return patch(t, { monthly_priority: undefined });
    }
    return t;
  });
}

export function addMonthTask(
  tasks: Task[],
  title: string,
  month: string,
  id: string,
  now: string,
): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_months: [month], is_adhoc: "false" },
  };
  return [...tasks, task];
}
```

> 注意 `patch` 已會把 `undefined` 的 key 刪掉，所以 `monthly_priority: undefined` = 清欄。`scheduled_dates` 為陣列整值替換。

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts`
Expected: PASS。

- [ ] **Step 5：Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(slice-3): month-layer task ops (promote, monthly priority, add)"
```

---

## Task 8：月層 store actions

把 Task 7 的純函式接成樂觀更新 + patch queue + 失敗處理的 store actions。

**Files:**
- Modify: `src/store/tasks.ts`
- Test: `src/store/tasks.test.ts`

- [ ] **Step 1：寫失敗測試**

`src/store/tasks.test.ts` 的 `describe("server-backed tasks store")` 內加：

```ts
  it("promoteToDay appends date and patches scheduled_dates", async () => {
    useTasksStore.setState({
      tasks: [{ id: "a", title: "A", status: "open",
        created_at: "x", updated_at: "x", custom_fields: { scheduled_months: ["2026-05"] } }],
      status: "ready", error: null,
    });
    const spy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().promoteToDay("a", "2026-05-22");
    expect(useTasksStore.getState().tasks[0].custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
    expect(spy).toHaveBeenCalledWith("a", { scheduled_dates: ["2026-05-22"] });
  });

  it("promoteToDay rolls back on failure", async () => {
    useTasksStore.setState({
      tasks: [{ id: "a", title: "A", status: "open",
        created_at: "x", updated_at: "x", custom_fields: { scheduled_months: ["2026-05"] } }],
      status: "ready", error: null,
    });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().promoteToDay("a", "2026-05-22");
    expect(useTasksStore.getState().tasks[0].custom_fields.scheduled_dates).toBeUndefined();
    expect(useTasksStore.getState().error).toBe("save_failed");
  });

  it("setMonthlyPriority sets and evicts within month, patching both", async () => {
    useTasksStore.setState({
      tasks: [
        { id: "a", title: "A", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "1" } },
        { id: "b", title: "B", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_months: ["2026-05"] } },
      ],
      status: "ready", error: null,
    });
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().setMonthlyPriority("b", "1", "2026-05");
    const s = useTasksStore.getState();
    expect(s.tasks.find((t) => t.id === "b")!.custom_fields.monthly_priority).toBe("1");
    expect(s.tasks.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBeUndefined();
  });

  it("addMonthTask adds a month-scoped task", async () => {
    useTasksStore.setState({ tasks: [], status: "ready", error: null });
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-m", title: "計畫", status: "open",
      created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
    });
    await useTasksStore.getState().addMonthTask("計畫", "2026-05");
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-m");
    expect(added?.custom_fields.scheduled_months).toEqual(["2026-05"]);
  });
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: FAIL。

- [ ] **Step 3：實作 actions**

`src/store/tasks.ts`：import 補 `promoteToDay as promoteToDayOp, setMonthlyPriority as setMonthlyPriorityOp, addMonthTask as addMonthTaskOp`；介面加三個方法簽章；實作：

```ts
  async promoteToDay(id, date) {
    const prev = get().tasks;
    const next = promoteToDayOp(prev, id, date);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id);
    try {
      await enqueuePatch(id, { scheduled_dates: updated!.custom_fields.scheduled_dates });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async setMonthlyPriority(id, n, month) {
    const prev = get().tasks;
    const next = setMonthlyPriorityOp(prev, id, n, month);
    set({ tasks: next, error: null });
    const changed = next.filter((t) => {
      const before = prev.find((p) => p.id === t.id);
      return before && before.custom_fields.monthly_priority !== t.custom_fields.monthly_priority;
    });
    try {
      await Promise.all(
        changed.map((t) =>
          enqueuePatch(t.id, { monthly_priority: t.custom_fields.monthly_priority ?? null }),
        ),
      );
    } catch {
      try {
        await get().reload();
      } catch {
        /* reload already set status:"error" */
      }
    }
  },

  async addMonthTask(title, month) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addMonthTaskOp(prev, trimmed, month, tempId, now()), error: null });
    try {
      const created = await postTodo({
        title: trimmed,
        scheduled_months: [month],
        is_adhoc: "false",
      });
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },
```

介面 `TasksState` 加：

```ts
  promoteToDay: (id: string, date: string) => Promise<void>;
  setMonthlyPriority: (id: string, n: Priority | null, month: string) => Promise<void>;
  addMonthTask: (title: string, month: string) => Promise<void>;
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/store/tasks.test.ts`、app `tsc --noEmit`
Expected: PASS。

- [ ] **Step 5：Commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(slice-3): month-layer store actions (promote, monthly priority, add)"
```

---

## Task 9：`/plan/$month` route + `PlanView`

把 `/plan` 拆成 layout + index + `$month`，並讓 `PlanView` 處理 load-once / skeleton / error，鏡像 `today.tsx`。

**Files:**
- Modify: `src/routes/plan.tsx`、`src/pages/PlanPage.tsx`（內容移入 `PlanView`，此檔可保留薄 re-export 或刪除）
- Create: `src/routes/plan.index.tsx`、`src/routes/plan.$month.tsx`
- Test: `src/routes/-plan.test.tsx`（新增，鏡像 `-today.test.tsx` 風格）

- [ ] **Step 1：寫 `PlanView` 與 layout route**

`src/routes/plan.tsx` 改成：

```tsx
import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTasksStore } from "@/store/tasks";
import { PlanLayout } from "@/features/plan-view/PlanLayout";
import { Button } from "@/ui/Button/Button";

function PlanSkeleton() {
  return (
    <main aria-busy="true" style={{ padding: "1.5rem" }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: "2.5rem", borderRadius: "0.5rem",
          background: "var(--color-paper-alt)", marginBottom: "0.75rem" }} />
      ))}
    </main>
  );
}

export function PlanView({ month }: { month: string }) {
  const status = useTasksStore((s) => s.status);
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);

  useEffect(() => {
    useTasksStore.getState().loadTasks();
  }, []);

  if (status === "loading" || status === "idle") return <PlanSkeleton />;
  if (status === "error") {
    return (
      <div role="alert" style={{ padding: "1.5rem" }}>
        載入失敗
        <Button variant="ghost" size="sm" onClick={() => useTasksStore.getState().reload()}>重試</Button>
      </div>
    );
  }
  return <PlanLayout allTasks={tasks} selectedDate={today} month={month} />;
}

function PlanLayoutRoute() {
  return <Outlet />;
}

export const Route = createFileRoute("/plan")({
  component: PlanLayoutRoute,
});
```

> `src/pages/PlanPage.tsx` 內容已由 `PlanView` 取代；刪掉該檔，並把任何 import 它的地方改 import `PlanView`（grep `PlanPage` 確認，多半只有舊 `plan.tsx`）。

- [ ] **Step 2：新增 index 與 \$month route**

`src/routes/plan.index.tsx`：

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { currentMonthISO } from "@/lib/date";
import { PlanView } from "./plan";

function PlanIndexRoute() {
  return <PlanView month={currentMonthISO()} />;
}

export const Route = createFileRoute("/plan/")({
  component: PlanIndexRoute,
});
```

`src/routes/plan.$month.tsx`：

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { isValidMonthParam } from "@/lib/date";
import { PlanView } from "./plan";

function PlanMonthRoute() {
  const { month } = Route.useParams();
  return <PlanView month={month} />;
}

export const Route = createFileRoute("/plan/$month")({
  beforeLoad: ({ params }) => {
    if (!isValidMonthParam(params.month)) throw redirect({ to: "/plan" });
  },
  component: PlanMonthRoute,
});
```

- [ ] **Step 3：重生 routeTree 並型別檢查**

Run: `npm run dev`（讓 plugin 重生 `src/routeTree.gen.ts`，啟動後可關掉）然後 app `tsc --noEmit`
Expected: 編譯通過，`routeTree.gen.ts` 含 `/plan/` 與 `/plan/$month`。

- [ ] **Step 4：寫 route 渲染測試**

`src/routes/-plan.test.tsx`（鏡像 `-today.test.tsx`：用 memory router 或直接 render `PlanView`，斷言當月 / 指定月顯示對應 task）。最小版：直接 render `PlanView`，先把 store 設 ready + mock 月度 task，斷言月度 title 出現：

```tsx
import { render, screen } from "@testing-library/react";
import { PlanView } from "./plan";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

it("renders the given month's tasks", () => {
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
  render(<PlanView month="2026-05" />);
  expect(screen.getByText("推出 desk.yurenju.me MVP")).toBeInTheDocument();
});
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/routes/-plan.test.tsx`
Expected: PASS。

- [ ] **Step 6：Commit**

```bash
git add src/routes/plan.tsx src/routes/plan.index.tsx src/routes/plan.$month.tsx src/routeTree.gen.ts src/routes/-plan.test.tsx
git rm src/pages/PlanPage.tsx
git commit -m "feat(slice-3): /plan/\$month route + PlanView load-once"
```

---

## Task 10：Monthly 欄月份 stepper + 空狀態

`MonthColumn` header 加 `‹ ›` 連到 `/plan/$prev|next`，並在月份無任務時顯示空狀態。**保留現有 sections 不動**（互動在 Task 11/12 接，`selectedDate` 串接也在 Task 11）。

**Files:**
- Modify: `src/features/month/MonthColumn.tsx`、`src/features/month/MonthColumn.module.css`
- Test: `src/features/month/MonthColumn.test.tsx`（新增）

- [ ] **Step 1：MonthColumn header stepper + 空狀態（保留所有 sections）**

`src/features/month/MonthColumn.tsx`：只改 import、header、加 `nothing` 空狀態；**`top3` / `otherPlanned` / `adhoc` / `trails` 的計算與既有 `MonthHeroCard` / `MonthRow` section JSX 原樣保留**（仍是目前的唯讀呼叫）。完整 return：

```tsx
import { Link } from "@tanstack/react-router";
import { formatMonth, prevMonth, nextMonth } from "@/lib/date";
// ... 其餘 import 同前（useMemo / Task / tasksOnMonth / BacklogSection / MonthHeroCard / MonthRow / styles）

export function MonthColumn({ allTasks, month }: MonthColumnProps) {
  // entries / top3 / otherPlanned / adhoc / trails 計算同前，原樣保留
  const nothing =
    top3.length === 0 && otherPlanned.length === 0 && adhoc.length === 0 && trails.length === 0;

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>MONTH · 規劃</div>
        <div className={styles.titleRow}>
          <Link to="/plan/$month" params={{ month: prevMonth(month) }}
            className={styles.step} aria-label="上個月">‹</Link>
          <h2 className={styles.title}>{formatMonth(month)}</h2>
          <Link to="/plan/$month" params={{ month: nextMonth(month) }}
            className={styles.step} aria-label="下個月">›</Link>
        </div>
      </header>

      <BacklogSection allTasks={allTasks} />

      {top3.length > 0 && <MonthHeroCard top3={top3} />}
      {/* otherPlanned / adhoc / trails 三個 section 原樣保留（唯讀 MonthRow），Task 11 才改互動 */}

      {nothing && <div className={styles.empty}>這個月還沒有任務</div>}
    </div>
  );
}
```

> `MonthColumnProps` 此 task **不動**（仍是 `{ allTasks, month }`）；`selectedDate` 在 Task 11 才加，避免未使用參數的型別錯。

- [ ] **Step 2：CSS**

`src/features/month/MonthColumn.module.css` 加：

```css
.titleRow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.step {
  text-decoration: none;
  color: var(--color-ink-faint);
  font-size: var(--text-lg);
  padding: 0 var(--space-1);
  border-radius: 5px;
}
.step:hover {
  background: var(--color-paper-alt);
  color: var(--color-ink);
}
.empty {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-ink-faint);
  padding: var(--space-3) 0;
}
```

- [ ] **Step 3：寫元件測試**

`src/features/month/MonthColumn.test.tsx`：用 `RouterProvider` 或 stub `Link`（TanStack `Link` 在無 router context 下需包 router）。最小作法：包一個 memory router；或直接斷言空狀態文字。先寫月份標題 + 空狀態：

```tsx
import { render, screen } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

it("shows empty hint for a month with no tasks", async () => {
  const router = createRouter({ routeTree,
    history: createMemoryHistory({ initialEntries: ["/plan/2099-01"] }) });
  // store 預設空 → ready 後月度無 task
  // ... 視專案測試慣例設定 store 為 ready + tasks:[] ...
  render(<RouterProvider router={router} />);
  expect(await screen.findByText("這個月還沒有任務")).toBeInTheDocument();
});
```

> 若 `RouterProvider` 整合測試在本專案太重，改用較輕的作法：把 stepper 抽成接受 `month` 的純渲染、測 `prevMonth/nextMonth` 已在 Task 2 覆蓋，元件測試只斷言空狀態與標題文字（用 `MemoryRouter` 包 `Link`）。沿用 `-today.test.tsx` 既有的 router 測試樣式。

- [ ] **Step 4：跑測試 + 型別**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`、app `tsc --noEmit`
Expected: PASS。

- [ ] **Step 5：Commit**

```bash
git add src/features/month/MonthColumn.tsx src/features/month/MonthColumn.module.css src/features/month/MonthColumn.test.tsx
git commit -m "feat(slice-3): month stepper + empty state in MonthColumn"
```

---

## Task 11：`useMonthRow` + 互動版 `MonthRow`

`MonthRow` 從唯讀變互動：可勾完成、`⋯` menu（編輯 / 刪除 / 計畫內⇄外 / → 排到選取日）。

**Files:**
- Create: `src/features/month/useMonthRow.ts`
- Modify: `src/features/month/MonthRow.tsx`、`src/features/month/MonthRow.module.css`、`src/features/month/MonthColumn.tsx`（加 `selectedDate` prop + otherPlanned / adhoc / trails 改傳互動 props）、`src/features/plan-view/PlanLayout.tsx`（傳 `selectedDate`）
- Test: `src/features/month/MonthRow.test.tsx`（新增）

- [ ] **Step 1：寫 hook**

`src/features/month/useMonthRow.ts`（鏡像 `useTaskRow`，多 `promote`、priority 綁月層）：

```ts
import { useState } from "react";
import type { Priority } from "@/lib/types";
import { useTasksStore } from "@/store/tasks";

export function useMonthRow(id: string, opts: { month: string; selectedDate: string }) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const setMonthlyPriority = useTasksStore((s) => s.setMonthlyPriority);
  const setAdhoc = useTasksStore((s) => s.setAdhoc);
  const promoteToDay = useTasksStore((s) => s.promoteToDay);
  const current = useTasksStore((s) => s.tasks.find((t) => t.id === id));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    setPriority: (n: Priority | null) => setMonthlyPriority(id, n, opts.month),
    promote: () => promoteToDay(id, opts.selectedDate),
    toggleAdhoc: () => {
      const isAdhoc = current?.custom_fields.is_adhoc === "true";
      setAdhoc(id, !isAdhoc);
    },
    startEdit: (initial: string) => {
      setDraft(initial);
      setIsEditing(true);
    },
    changeDraft: (v: string) => setDraft(v),
    commitEdit: () => {
      editTitle(id, draft);
      setIsEditing(false);
    },
    cancelEdit: () => setIsEditing(false),
  };
}
```

- [ ] **Step 2：改 `MonthRow` 為互動**

`src/features/month/MonthRow.tsx`：

```tsx
import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { useMonthRow } from "./useMonthRow";
import styles from "./MonthRow.module.css";

export interface MonthRowProps {
  task: Task;
  kind: TrailKind;
  month: string;
  selectedDate: string;
  interactive?: boolean;
}

export function MonthRow({ task, kind, month, selectedDate, interactive }: MonthRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const row = useMonthRow(task.id, { month, selectedDate });
  const editable = Boolean(interactive) && kind === "primary";

  return (
    <div className={[styles.row, isDone && styles.done].filter(Boolean).join(" ")}>
      <Checkbox
        checked={isDone}
        disabled={!editable}
        onCheckedChange={editable ? row.toggle : undefined}
        aria-label={task.title}
      />
      {row.isEditing ? (
        <input
          className={styles.editInput}
          autoFocus
          value={row.draft}
          onChange={(e) => row.changeDraft(e.target.value)}
          onBlur={row.cancelEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) row.commitEdit();
            if (e.key === "Escape") row.cancelEdit();
          }}
        />
      ) : (
        <span className={styles.title}>{task.title}</span>
      )}
      {kind === "forwarded" && <span className={styles.trail}>↪</span>}
      {kind === "dismissed" && <span className={styles.trail}>·略過</span>}
      {isAdhoc && <UnplannedChip />}
      {editable && !row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">⋯</button>
            }
            items={[
              { key: "promote", label: `→ 排到 ${selectedDate.slice(8)} 日`, onSelect: row.promote },
              isAdhoc
                ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
                : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3：CSS**

`src/features/month/MonthRow.module.css` 末尾把 `TaskRow.module.css` 的 `.actions` / `@media (hover...)` / `.iconBtn` / `.editInput` 規則複製過來（內容同 `src/features/day/TaskRow.module.css:53-88`，原樣貼上）。

- [ ] **Step 4：MonthColumn 加 `selectedDate` prop + 餵互動 props**

先把 `selectedDate` 串進來（Task 10 刻意延後到這裡）：
- `src/features/plan-view/PlanLayout.tsx`：`<MonthColumn allTasks={allTasks} month={month} />` 改成 `<MonthColumn allTasks={allTasks} month={month} selectedDate={selectedDate} />`。
- `src/features/month/MonthColumn.tsx`：`MonthColumnProps` 加 `selectedDate: string;`，函式簽章改 `{ allTasks, month, selectedDate }`。

再把 otherPlanned / adhoc / trails 三處 `<MonthRow .../>` 改成傳 `month={month} selectedDate={selectedDate}`；otherPlanned / adhoc 兩處再加 `interactive`（trails 不加，維持唯讀）：

```tsx
{otherPlanned.map((e) => (
  <MonthRow key={e.task.id} task={e.task} kind={e.kind}
    month={month} selectedDate={selectedDate} interactive />
))}
{/* adhoc 同上 interactive */}
{/* trails: <MonthRow ... month={month} selectedDate={selectedDate} />（不 interactive） */}
```

- [ ] **Step 5：寫元件測試**

`src/features/month/MonthRow.test.tsx`：render 一個 primary `MonthRow interactive`，store 設 ready，斷言勾選呼叫 toggle、menu 出現「→ 排到 …」「刪除」項。沿用 `TaskRow.test.tsx` 的測試樣式（mock store action 或用真 store + mock api）。範例：

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthRow } from "./MonthRow";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";
import { vi } from "vitest";

it("promotes via the overflow menu", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [{ id: "m5", title: "讀完《Deep Work》", status: "open",
      created_at: "x", updated_at: "x", custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive />);
  await userEvent.click(screen.getByLabelText("更多動作"));
  await userEvent.click(screen.getByRole("menuitem", { name: /排到 22 日/ }));
  expect(useTasksStore.getState().tasks[0].custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
});
```

- [ ] **Step 6：跑測試 + 型別**

Run: `npx vitest run src/features/month`、app `tsc --noEmit`
Expected: PASS。

- [ ] **Step 7：Commit**

```bash
git add src/features/month src/features/plan-view/PlanLayout.tsx
git commit -m "feat(slice-3): interactive MonthRow via useMonthRow"
```

---

## Task 12：互動版月層 Hero（`MonthHeroCard`）

本月 Top3 改互動：`monthly_priority` dropdown、勾完成、編輯、刪除、promote。不重用 day 的 `Top3Card`。

**Files:**
- Modify: `src/features/month/MonthHeroCard.tsx`、`src/features/month/MonthColumn.tsx`（傳 props）
- Create: `src/features/month/MonthHeroCard.module.css`
- Test: `src/features/month/MonthHeroCard.test.tsx`（新增）

- [ ] **Step 1：改 `MonthHeroCard`**

`src/features/month/MonthHeroCard.tsx`：

```tsx
import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";
import { useMonthRow } from "./useMonthRow";
import styles from "./MonthHeroCard.module.css";

export interface MonthHeroCardProps {
  top3: Task[];
  month: string;
  selectedDate: string;
}

export function MonthHeroCard({ top3, month, selectedDate }: MonthHeroCardProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>本月最重要的三件事</h3>
      <ul className={styles.list}>
        {top3.map((t) => (
          <MonthHeroItem key={t.id} task={t} month={month} selectedDate={selectedDate} />
        ))}
      </ul>
    </div>
  );
}

function MonthHeroItem({ task, month, selectedDate }:
  { task: Task; month: string; selectedDate: string }) {
  const row = useMonthRow(task.id, { month, selectedDate });
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const pr = task.custom_fields.monthly_priority ?? null;

  return (
    <li className={styles.item}>
      <Checkbox
        checked={task.status === "done"}
        onCheckedChange={row.toggle}
        aria-label={task.title}
      />
      <Menu
        ariaLabel="本月重點"
        selectedKey={pr ?? "none"}
        trigger={<PriorityRing value={pr} aria-label={pr ? `本月重點第 ${pr}` : "設為本月重點"} />}
        items={[
          { key: "1", label: "① 本月第一", onSelect: () => row.setPriority("1") },
          { key: "2", label: "② 本月第二", onSelect: () => row.setPriority("2") },
          { key: "3", label: "③ 本月第三", onSelect: () => row.setPriority("3") },
          { key: "none", label: "— 移除重點", onSelect: () => row.setPriority(null) },
        ]}
      />
      <div className={styles.itemBody}>
        {row.isEditing ? (
          <input
            className={styles.editInput}
            autoFocus
            value={row.draft}
            onChange={(e) => row.changeDraft(e.target.value)}
            onBlur={row.cancelEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) row.commitEdit();
              if (e.key === "Escape") row.cancelEdit();
            }}
          />
        ) : (
          <div className={styles.itemTitle}>{task.title}</div>
        )}
      </div>
      {isAdhoc && <UnplannedChip />}
      {!row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">⋯</button>
            }
            items={[
              { key: "promote", label: `→ 排到 ${selectedDate.slice(8)} 日`, onSelect: row.promote },
              isAdhoc
                ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
                : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
          />
        </div>
      )}
    </li>
  );
}
```

- [ ] **Step 2：CSS**

`src/features/month/MonthHeroCard.module.css`：以 `src/features/day/Top3Card.module.css` 的 `.v_plain` 觀感為底（plain 卡片），把 `.card`（套 plain 背景 + border）、`.heading`、`.list`、`.item`、`.itemBody`、`.itemTitle`、`.actions`+hover media、`.iconBtn`、`.editInput` 規則複製過來（對應 `Top3Card.module.css` 的 `.card`+`.v_plain` 合併、以及 `.heading/.list/.item/.itemBody/.itemTitle/.actions/.iconBtn/.editInput`）。`.iconBtn` 顏色用 `var(--color-ink-faint)`（plain 卡片，非 accent）。

- [ ] **Step 3：MonthColumn 傳 props 給 hero**

`src/features/month/MonthColumn.tsx`：`{top3.length > 0 && <MonthHeroCard top3={top3} />}` 改成 `<MonthHeroCard top3={top3} month={month} selectedDate={selectedDate} />`。

- [ ] **Step 4：寫元件測試**

`src/features/month/MonthHeroCard.test.tsx`：render hero（store ready，給兩筆 monthly_priority 1/2），點某筆 ring menu 選「② 本月第二」，斷言 store 內該筆 monthly_priority 變 2、原本的 2 被騰位。沿用 Task 11 測試樣式。

- [ ] **Step 5：跑測試 + 型別**

Run: `npx vitest run src/features/month`、app `tsc --noEmit`
Expected: PASS。

- [ ] **Step 6：Commit**

```bash
git add src/features/month
git commit -m "feat(slice-3): interactive month-layer hero card"
```

---

## Task 13：Monthly + 加入點

Monthly 欄底部加新增入口，寫 `scheduled_months=[month]`、`is_adhoc=false`。

**Files:**
- Create: `src/features/month/AddMonthTaskInput.tsx`、`src/features/month/AddMonthTaskInput.module.css`
- Modify: `src/features/month/MonthColumn.tsx`
- Test: `src/features/month/AddMonthTaskInput.test.tsx`（新增）

- [ ] **Step 1：寫元件**

`src/features/month/AddMonthTaskInput.tsx`（鏡像 `AddTaskInput`，改呼叫 `addMonthTask`、文案）：

```tsx
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./AddMonthTaskInput.module.css";

export function AddMonthTaskInput({ month }: { month: string }) {
  const addMonthTask = useTasksStore((s) => s.addMonthTask);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    addMonthTask(value, month);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder="+ 加一件這個月要做的事…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="新增本月任務"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
    </div>
  );
}
```

`src/features/month/AddMonthTaskInput.module.css`：複製 `src/features/day/AddTaskInput.module.css` 全部規則（`.bar` / `.box` / `.input`）。

- [ ] **Step 2：掛進 MonthColumn**

`src/features/month/MonthColumn.tsx`：在 sections 之後、`nothing` 提示之後加 `<AddMonthTaskInput month={month} />`（永遠顯示，讓空月份也能加）。

- [ ] **Step 3：寫測試**

`src/features/month/AddMonthTaskInput.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddMonthTaskInput } from "./AddMonthTaskInput";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";
import { vi } from "vitest";

it("adds a month-scoped task on Enter", async () => {
  vi.spyOn(api, "postTodo").mockResolvedValue({
    id: "srv", title: "規劃", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
  });
  useTasksStore.setState({ tasks: [], status: "ready", error: null });
  render(<AddMonthTaskInput month="2026-05" />);
  const input = screen.getByLabelText("新增本月任務");
  await userEvent.type(input, "規劃{Enter}");
  expect(useTasksStore.getState().tasks.some(
    (t) => t.custom_fields.scheduled_months?.includes("2026-05"))).toBe(true);
});
```

- [ ] **Step 4：跑測試 + 型別**

Run: `npx vitest run src/features/month`、app `tsc --noEmit`
Expected: PASS。

- [ ] **Step 5：Commit**

```bash
git add src/features/month
git commit -m "feat(slice-3): Monthly + add-point"
```

---

## Task 14：e2e — mock WSPC 擴充 + Plan/Month 流程

讓 e2e fake 回傳全部非 cancelled、補月度資料；新增 Plan 互動 spec；回歸 Today。

**Files:**
- Modify: `e2e/fixtures/wspc-fake.ts`
- Create: `e2e/plan-interaction.spec.ts`
- Modify（如需）: `e2e/fixtures/session.ts`（若要新增 `gotoPlanSeeded`）
- 參考: `playwright.config.ts`（server 釘 `127.0.0.1`，勿改）

- [ ] **Step 1：fake list 改全回、seed 補月度**

`e2e/fixtures/wspc-fake.ts`：
- `GET /todo/items` 的 handler 移除 `cf.scheduled_dates` 過濾分支（worker 不再送該 param），只留 `project_id` + `status` 過濾。保留 `status` 多值過濾。
- `seed()` 末尾補幾筆「本月、無 scheduled_dates」的月度 task，讓 Plan 的 Monthly 欄有內容（月份用執行期 `todayISO().slice(0,7)`）：

```ts
  const month = today.slice(0, 7);
  todos.push(
    { id: "pm1", project_id: PROJECT_ID, type_id: TYPE_ID, status: "open",
      title: "本月最重要的事 A", created_at: base, updated_at: base,
      custom_fields: { scheduled_months: [month], monthly_priority: "1", is_adhoc: "false" } },
    { id: "pm2", project_id: PROJECT_ID, type_id: TYPE_ID, status: "open",
      title: "本月其他計畫 B", created_at: base, updated_at: base,
      custom_fields: { scheduled_months: [month], is_adhoc: "false" } },
  );
```

> 注意：既有的 `mk(...)` 會自動塞 `scheduled_dates: [today]`，所以月度 task 要直接 push（不要用 `mk`），避免被當成今天的 task。

- [ ] **Step 2：寫 Plan 互動 spec**

`e2e/plan-interaction.spec.ts`：用既有 `gotoTodaySeeded` 登入後導到 `/plan`，驗：(a) Monthly 欄顯示「本月最重要的事 A」；(b) Monthly + 新增一筆後可見且 reload 後仍在；(c) 對「本月其他計畫 B」用 `⋯` →「→ 排到 X 日」後，切到 Day 欄看得到它；(d) `‹`/`›` stepper 改 URL。範例（依 `today-interaction.spec.ts` 的 row/menu 定位法）：

```ts
import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

test.beforeEach(async ({ page }) => {
  await gotoTodaySeeded(page);
  await page.goto("/plan");
});

test("adds a month task and persists across reload", async ({ page }) => {
  const input = page.getByPlaceholder("+ 加一件這個月要做的事…");
  await input.fill("月度新增測試");
  await input.press("Enter");
  await expect(page.getByText("月度新增測試")).toBeVisible();
  await page.reload();
  await expect(page.getByText("月度新增測試")).toBeVisible();
});

test("month stepper changes the URL", async ({ page }) => {
  await page.getByLabel("下個月").click();
  await expect(page).toHaveURL(/\/plan\/\d{4}-\d{2}$/);
});
```

> promote 的斷言：點 `⋯` →「→ 排到 …」後，Day 欄（同頁三欄）會出現該 task 標題；若 mobile tab 版型擋住，先點 Day tab 再斷言。依實際 DOM 調整定位。

- [ ] **Step 3：跑 e2e**

Run: `npm run test:e2e`
Expected: 新 spec + 既有 `today-interaction.spec.ts` 全 PASS（Today 回歸不退化）。

- [ ] **Step 4：Commit**

```bash
git add e2e
git commit -m "test(slice-3): e2e for month interactions + list-all fake"
```

---

## Task 15：最終驗證（自動化 + 型別 + e2e + 手動 preview）

**Files:** 無（驗證）

- [ ] **Step 1：全套自動化**

Run: `npx vitest run`
Expected: 全 PASS。

- [ ] **Step 2：型別**

Run: app `tsc --noEmit`、worker `tsc --noEmit`
Expected: 無錯。

- [ ] **Step 3：e2e**

Run: `npm run test:e2e`
Expected: 全 PASS。

- [ ] **Step 4：手動 preview（AI agent + 使用者協助登入）**

用 `preview_start` 開預覽，**請使用者協助完成 WSPC device flow 登入**，對照設計文件「驗收標準」1–10 逐項操作：Monthly 顯示本月歸屬、Monthly + 落地、列完成/編輯/刪除/計畫內外切換、`monthly_priority` dropdown + 騰位、promote 後出現在 Day 欄、`‹›` 與 `/plan/$month` 切月即時且重整保留、空月份不報錯、Today 互動不退化、mutation 失敗 toast。

- [ ] **Step 5：完成分支**

驗收通過後，依 `superpowers:finishing-a-development-branch` 決定 merge / PR。

---

## 自我檢查對照（spec → task）

| Spec 項目 | 對應 Task |
|---|---|
| 方案 A：list 全載 | 3 |
| 方案 A：store load-once + today 真實化 + view re-derive | 4、9 |
| create 泛化（month 加入點） | 5 |
| patch 擴充（monthly_priority + 陣列） | 6 |
| `/plan/$month` route + helper | 2、9 |
| 月份 stepper | 10 |
| Monthly 列互動（完成/編輯/刪除/adhoc/promote） | 11 |
| 月層 Hero（monthly_priority dropdown + 互動） | 12 |
| Monthly + 加入點 | 13 |
| 淘汰 parent_id | 1 |
| 月層 store ops + 騰位/promote 語意 | 7、8 |
| 測試：單元 / e2e / 手動 | 各 task + 14、15 |
| 不動 Today 路徑（選項 1） | 11、12（平行新建）|
