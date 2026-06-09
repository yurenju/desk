# Task 詳情 Modal 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 點 task 開置中 Modal，檢視並完整編輯 description（渲染 Markdown）與 subtask（勾 / 加 / 刪 / 改標題）。

**Architecture:** subtask 是 WSPC 用 `parent_id` 連的子 todo（純 checklist，不進三層漏斗）。BFF 的 root list 補回 `description` + `subtask_count`（map `child_count`）；子任務在開 Modal 時用 `parent_id` lazy-load。子任務的 status/title 改寫沿用既有 `PATCH /api/todo/:id`；只有「列子任務」與「建子任務」是新端點。所有編輯即時 PATCH（沿用 patch queue）。

**Tech Stack:** Cloudflare Workers (BFF) + React 19 + Zustand + `@base-ui/react` Dialog + `react-markdown` + `remark-gfm`；vitest / Testing Library / Playwright。

> 設計來源：[2026-06-09-task-detail-modal-design.md](../specs/2026-06-09-task-detail-modal-design.md)

---

## 檔案結構

**Worker（BFF）**
- 修改 `worker/wspc.ts`：`Todo` 加 `description` / `child_count`；新增 `listChildren`；`createTodo` 加 `parentId`；`patchTodo` 加 `description`。
- 修改 `worker/todo-mapper.ts`：`mapTodoToTask` 帶 `description` + `subtask_count`；新增 `mapTodoToSubtask`。
- 修改 `worker/routes/todo.ts`：新增 `handleListSubtasks` / `handleCreateSubtask`；`handlePatchTodo` 接受 `description`。
- 修改 `worker/index.ts`：掛 `/api/todo/:id/subtasks`（GET / POST）。

**前端**
- 修改 `src/lib/types.ts`：`Task` 加 `description?` / `subtask_count?`；新增 `Subtask`。
- 修改 `src/lib/api/todo.ts`：`TodoPatch` 加 `description`；新增 `fetchSubtasks` / `createSubtask`。
- 修改 `src/store/tasks.ts`：新增 `editDescription` / `bumpSubtaskCount`。
- 新增 `src/features/task-detail/store.ts`：`useTaskDetailStore`（`openId` + open/close）。
- 新增 `src/features/task-detail/useTaskDetail.ts`：子任務 fetch + toggle/add/rename/remove + `subtask_count` 同步。
- 新增 `src/features/task-detail/DescriptionEditor.tsx`（+ `.module.css`）：渲染 / 編輯兩態。
- 新增 `src/features/task-detail/SubtaskList.tsx`（+ `.module.css`）：子任務清單 + 新增框。
- 新增 `src/features/task-detail/TaskDetailModal.tsx`（+ `.module.css`）：Dialog 容器。
- 新增 `src/features/task-detail/TaskDetailTrigger.tsx`（+ `.module.css`）：展開 icon + 徽記，插進三種 row。
- 修改 `src/features/day/TaskRow.tsx`、`src/features/month/MonthRow.tsx`、`src/features/backlog/BacklogRow.tsx`：放入 `TaskDetailTrigger`。
- 修改 `src/routes/__root.tsx`：掛載 `<TaskDetailModal />`。

**e2e**
- 修改 `e2e/fixtures/wspc-fake.ts`：`parent_id` 過濾 + `child_count` + `description` + 子任務 create/patch。
- 新增 `e2e/task-detail.spec.ts`。

---

## Task 1：wspc.ts —— Todo 欄位 + listChildren + parentId + description

**Files:**
- Modify: `worker/wspc.ts`
- Test: `worker/wspc.test.ts`

- [ ] **Step 1：寫失敗測試**

加到 `worker/wspc.test.ts`（沿用該檔既有 `fetch` mock 風格；若該檔尚無共用 helper，於檔內就近 stub `globalThis.fetch`）：

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { listChildren, createTodo, patchTodo } from "./wspc";

afterEach(() => vi.restoreAllMocks());

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status: ok ? status : status }),
  );
}

describe("listChildren", () => {
  it("requests children of a parent scoped to project+type, non-cancelled", async () => {
    const spy = mockFetchOnce({ todos: [{ id: "c1", status: "open", title: "step", created_at: 0, updated_at: 0 }] });
    const out = await listChildren("at", { projectId: "p1", typeId: "t1", parentId: "tod_1" });
    expect(out).toHaveLength(1);
    const url = (spy.mock.calls[0][0] as string);
    expect(url).toContain("parent_id=tod_1");
    expect(url).toContain("project_id=p1");
    expect(url).toContain("type_id=t1");
    expect(url).toContain("status=open");
  });
});

describe("createTodo with parentId", () => {
  it("sends parent_id in the body when given", async () => {
    const spy = mockFetchOnce({ id: "c2", status: "open", title: "sub", created_at: 0, updated_at: 0 });
    await createTodo("at", { title: "sub", projectId: "p1", typeId: "t1", customFields: {}, parentId: "tod_1" });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({ parent_id: "tod_1", title: "sub" });
  });
});

describe("patchTodo with description", () => {
  it("sends description in the payload when given", async () => {
    const spy = mockFetchOnce({ id: "tod_1", status: "open", title: "x", created_at: 0, updated_at: 0 });
    await patchTodo("at", "tod_1", { description: "**hi**" });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ description: "**hi**" });
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run worker/wspc.test.ts`
Expected: FAIL（`listChildren` 未匯出、`createTodo` 無 `parentId`、`patchTodo` 無 `description`）。

- [ ] **Step 3：實作**

在 `worker/wspc.ts` 把 `Todo` 介面改成：

```ts
export interface Todo {
  id: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  title: string;
  created_at: number;
  updated_at: number;
  description?: string;
  child_count?: number;
  custom_fields?: Record<string, string | string[]>;
}
```

在 `listTodos` 後新增：

```ts
// Direct children of one parent todo (subtask checklist). WSPC scopes children
// by parent_id; root listTodos never returns these, so they stay out of the
// month/day funnel views.
export async function listChildren(
  accessToken: string,
  opts: { projectId: string; typeId: string; parentId: string },
): Promise<Todo[]> {
  const params = new URLSearchParams();
  params.set("project_id", opts.projectId);
  params.set("type_id", opts.typeId);
  params.set("parent_id", opts.parentId);
  for (const s of ["open", "in_progress", "done"]) params.append("status", s);
  const res = await fetch(`${WSPC_BASE}/todo/items?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`WSPC listChildren failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { todos?: Todo[] };
  return data.todos ?? [];
}
```

把 `createTodo` 的 body 型別與送出改為（加可選 `parentId`）：

```ts
export async function createTodo(
  accessToken: string,
  body: {
    title: string;
    projectId: string;
    typeId: string;
    customFields: Record<string, string | string[]>;
    parentId?: string;
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
      ...(body.parentId ? { parent_id: body.parentId } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`WSPC createTodo failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Todo;
}
```

把 `patchTodo` 的 body 型別與 payload 加上 `description`：

```ts
export async function patchTodo(
  accessToken: string,
  id: string,
  body: {
    status?: Todo["status"];
    customFields?: Record<string, string | string[] | null>;
    title?: string;
    description?: string;
  },
): Promise<Todo> {
  const payload: Record<string, unknown> = {};
  if (body.title !== undefined) payload.title = body.title;
  if (body.status !== undefined) payload.status = body.status;
  if (body.description !== undefined) payload.description = body.description;
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
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run worker/wspc.test.ts`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add worker/wspc.ts worker/wspc.test.ts
git commit -m "feat(worker): wspc listChildren + parentId create + description patch"
```

---

## Task 2：todo-mapper.ts —— description + subtask_count + subtask mapper

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `worker/todo-mapper.ts`
- Test: `worker/todo-mapper.test.ts`

- [ ] **Step 1：先加型別（讓 mapper 能引用）**

在 `src/lib/types.ts` 的 `Task` 介面加兩個欄位，並新增 `Subtask`：

```ts
export interface Subtask {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  subtask_count?: number;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  custom_fields: TaskCustomFields;
}
```

- [ ] **Step 2：寫失敗測試**

在 `worker/todo-mapper.test.ts` 加（沿用既有 import）：

```ts
import { describe, it, expect } from "vitest";
import { mapTodoToTask, mapTodoToSubtask } from "./todo-mapper";

describe("mapTodoToTask detail fields", () => {
  it("carries description and maps child_count to subtask_count", () => {
    const out = mapTodoToTask({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0,
      description: "**hi**", child_count: 3, custom_fields: {},
    });
    expect(out.description).toBe("**hi**");
    expect(out.subtask_count).toBe(3);
  });

  it("defaults subtask_count to 0 and drops empty description", () => {
    const out = mapTodoToTask({
      id: "tod_2", status: "open", title: "B", created_at: 0, updated_at: 0,
      description: "", custom_fields: {},
    });
    expect(out.subtask_count).toBe(0);
    expect(out.description).toBeUndefined();
  });
});

describe("mapTodoToSubtask", () => {
  it("projects a child todo to a lean subtask", () => {
    const out = mapTodoToSubtask({
      id: "c1", status: "done", title: "step", created_at: 0, updated_at: 0, custom_fields: {},
    });
    expect(out).toEqual({ id: "c1", title: "step", status: "done" });
  });
});
```

- [ ] **Step 3：跑測試確認失敗**

Run: `npx vitest run worker/todo-mapper.test.ts`
Expected: FAIL（`mapTodoToSubtask` 未定義、`description`/`subtask_count` 未帶）。

- [ ] **Step 4：實作**

把 `worker/todo-mapper.ts` 改為：

```ts
import type { Todo } from "./wspc";
import type { Task, Subtask, TaskCustomFields } from "../src/lib/types";

export function mapTodoToTask(todo: Todo): Task {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ? todo.description : undefined,
    subtask_count: todo.child_count ?? 0,
    status: todo.status,
    created_at: new Date(todo.created_at).toISOString(),
    updated_at: new Date(todo.updated_at).toISOString(),
    custom_fields: (todo.custom_fields ?? {}) as TaskCustomFields,
  };
}

export function mapTodoToSubtask(todo: Todo): Subtask {
  return { id: todo.id, title: todo.title, status: todo.status };
}
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run worker/todo-mapper.test.ts`
Expected: PASS。

- [ ] **Step 6：commit**

```bash
git add src/lib/types.ts worker/todo-mapper.ts worker/todo-mapper.test.ts
git commit -m "feat(worker): map description + subtask_count, add subtask mapper"
```

---

## Task 3：BFF subtask 端點 + description patch

**Files:**
- Modify: `worker/routes/todo.ts`
- Modify: `worker/index.ts`
- Test: `worker/routes/todo.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `worker/routes/todo.test.ts` 末尾加（沿用該檔 `makeEnv` / `seedSession` / `cookie` helper）：

```ts
import { handleListSubtasks, handleCreateSubtask } from "./todo";

describe("GET /api/todo/:id/subtasks", () => {
  it("lists children of a parent", async () => {
    const env = makeEnv();
    await seedSession(env);
    vi.spyOn(wspc, "listChildren").mockResolvedValue([
      { id: "c1", status: "open", title: "step", created_at: 0, updated_at: 0, custom_fields: {} },
    ]);
    const req = new Request("https://d/api/todo/tod_1/subtasks", { headers: cookie });
    const res = await handleListSubtasks(req, env, "tod_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subtasks: { id: string }[] };
    expect(body.subtasks[0]).toEqual({ id: "c1", title: "step", status: "open" });
  });
});

describe("POST /api/todo/:id/subtasks", () => {
  it("creates a child todo under the parent", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "createTodo").mockResolvedValue({
      id: "c_new", status: "open", title: "new step", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1/subtasks", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new step" }),
    });
    const res = await handleCreateSubtask(req, env, "tod_1");
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][1]).toMatchObject({ title: "new step", parentId: "tod_1" });
  });

  it("rejects an empty title", async () => {
    const env = makeEnv();
    await seedSession(env);
    const req = new Request("https://d/api/todo/tod_1/subtasks", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  " }),
    });
    const res = await handleCreateSubtask(req, env, "tod_1");
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/todo/:id description", () => {
  it("forwards description to wspc", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ description: "**hi**" }),
    });
    const res = await handlePatchTodo(req, env, "tod_1");
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][2]).toMatchObject({ description: "**hi**" });
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run worker/routes/todo.test.ts`
Expected: FAIL（`handleListSubtasks` / `handleCreateSubtask` 未匯出、PATCH 未轉 `description`）。

- [ ] **Step 3：實作 route handlers**

在 `worker/routes/todo.ts`：頂部 import 補上 `listChildren` 與 `mapTodoToSubtask`：

```ts
import { listTodos, createTodo, patchTodo, listChildren } from "../wspc";
import { mapTodoToTask, mapTodoToSubtask } from "../todo-mapper";
```

新增兩個 handler：

```ts
export async function handleListSubtasks(
  request: Request,
  env: Env,
  parentId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const children = await listChildren(accessToken, { projectId, typeId, parentId });
    return json({ subtasks: children.map(mapTodoToSubtask) });
  });
}

export async function handleCreateSubtask(
  request: Request,
  env: Env,
  parentId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    let body: { title?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const title = body.title?.trim();
    if (!title) return json({ error: "title_required" }, 400);
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todo = await createTodo(accessToken, {
      title,
      projectId,
      typeId,
      customFields: {},
      parentId,
    });
    return json({ subtask: mapTodoToSubtask(todo) }, 201);
  });
}
```

在 `handlePatchTodo` 內，`body` 型別兩處都加 `description?: string;`，並在組裝 `patchTodo` 呼叫前加：

```ts
    const todo = await patchTodo(accessToken, id, {
      status: body.status,
      customFields: Object.keys(customFields).length ? customFields : undefined,
      title: body.title,
      description: body.description,
    });
```

（`body` 的兩個 inline 型別宣告各加一行 `description?: string;`。）

- [ ] **Step 4：掛路由**

在 `worker/index.ts`，於 `todoIdMatch` 的 PATCH 區塊之前插入 subtask 路由：

```ts
    const subtaskMatch = path.match(/^\/api\/todo\/([^/]+)\/subtasks$/);
    if (subtaskMatch) {
      let parentId: string;
      try {
        parentId = decodeURIComponent(subtaskMatch[1]);
      } catch {
        return new Response(JSON.stringify({ error: "bad_todo_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (method === "GET") return handleListSubtasks(request, env, parentId);
      if (method === "POST") return handleCreateSubtask(request, env, parentId);
    }
```

並把 import 改為：

```ts
import {
  handleListTodo,
  handleCreateTodo,
  handlePatchTodo,
  handleListSubtasks,
  handleCreateSubtask,
} from "./routes/todo";
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run worker/routes/todo.test.ts`
Expected: PASS。

- [ ] **Step 6：commit**

```bash
git add worker/routes/todo.ts worker/index.ts worker/routes/todo.test.ts
git commit -m "feat(worker): subtask list/create endpoints + description patch"
```

---

## Task 4：前端 API + TodoPatch description

**Files:**
- Modify: `src/lib/api/todo.ts`
- Test: `src/lib/api/todo.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `src/lib/api/todo.test.ts` 加（沿用該檔 `fetch` mock 風格）：

```ts
import { fetchSubtasks, createSubtask } from "./todo";

describe("fetchSubtasks", () => {
  it("GETs the subtasks endpoint and returns the list", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ subtasks: [{ id: "c1", title: "s", status: "open" }] }), { status: 200 }),
    );
    const out = await fetchSubtasks("tod_1");
    expect(out).toEqual([{ id: "c1", title: "s", status: "open" }]);
    expect(spy.mock.calls[0][0]).toBe("/api/todo/tod_1/subtasks");
  });
});

describe("createSubtask", () => {
  it("POSTs the title and returns the new subtask", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ subtask: { id: "c2", title: "new", status: "open" } }), { status: 201 }),
    );
    const out = await createSubtask("tod_1", "new");
    expect(out.id).toBe("c2");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ title: "new" });
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/api/todo.test.ts`
Expected: FAIL（`fetchSubtasks` / `createSubtask` 未定義）。

- [ ] **Step 3：實作**

在 `src/lib/api/todo.ts`：`import type` 補 `Subtask`；`TodoPatch` 加 `description`；新增兩個函式。

```ts
import type { Task, Subtask, TaskStatus } from "@/lib/types";
```

`TodoPatch` 介面加一行：

```ts
  description?: string;
```

檔末新增：

```ts
export async function fetchSubtasks(parentId: string): Promise<Subtask[]> {
  const res = await fetch(`/api/todo/${encodeURIComponent(parentId)}/subtasks`, {
    credentials: "same-origin",
  });
  const data = await jsonOrThrow<{ subtasks: Subtask[] }>(res);
  return data.subtasks;
}

export async function createSubtask(parentId: string, title: string): Promise<Subtask> {
  const res = await fetch(`/api/todo/${encodeURIComponent(parentId)}/subtasks`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await jsonOrThrow<{ subtask: Subtask }>(res);
  return data.subtask;
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/api/todo.test.ts`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/api/todo.ts src/lib/api/todo.test.ts
git commit -m "feat(api): fetchSubtasks/createSubtask + description patch field"
```

---

## Task 5：tasks store —— editDescription + bumpSubtaskCount

**Files:**
- Modify: `src/store/tasks.ts`
- Test: `src/store/tasks.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `src/store/tasks.test.ts` 加（沿用該檔既有的 store 初始化 / mock api 風格；下面假設既有 helper `seedStore(tasks)` 或直接 `useTasksStore.setState`，依該檔現況採用）：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTasksStore } from "./tasks";
import * as queue from "@/lib/api/todoQueue";
import type { Task } from "@/lib/types";

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id, title: id, status: "open", created_at: "", updated_at: "",
    custom_fields: {}, ...over,
  };
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [], status: "ready", error: null, recentlyDeleted: null });
  vi.restoreAllMocks();
});

describe("editDescription", () => {
  it("optimistically sets description and patches", async () => {
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue(task("t1"));
    useTasksStore.setState({ tasks: [task("t1")] });
    await useTasksStore.getState().editDescription("t1", "**hi**");
    expect(useTasksStore.getState().tasks[0].description).toBe("**hi**");
    expect(spy.mock.calls[0]).toEqual(["t1", { description: "**hi**" }]);
  });

  it("rolls back on failure", async () => {
    vi.spyOn(queue, "enqueuePatch").mockRejectedValue(new Error("x"));
    useTasksStore.setState({ tasks: [task("t1", { description: "old" })] });
    await useTasksStore.getState().editDescription("t1", "new");
    expect(useTasksStore.getState().tasks[0].description).toBe("old");
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

describe("bumpSubtaskCount", () => {
  it("adjusts subtask_count by delta, floored at 0", () => {
    useTasksStore.setState({ tasks: [task("t1", { subtask_count: 1 })] });
    useTasksStore.getState().bumpSubtaskCount("t1", 1);
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(2);
    useTasksStore.getState().bumpSubtaskCount("t1", -5);
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(0);
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: FAIL（`editDescription` / `bumpSubtaskCount` 未定義）。

- [ ] **Step 3：實作**

在 `TasksState` 介面加兩個簽名：

```ts
  editDescription: (id: string, description: string) => Promise<void>;
  bumpSubtaskCount: (id: string, delta: number) => void;
```

在 store 實作中（`editTitle` 附近）加：

```ts
  async editDescription(id, description) {
    const prev = get().tasks;
    set({
      tasks: prev.map((t) => (t.id === id ? { ...t, description: description || undefined } : t)),
      error: null,
    });
    try {
      await enqueuePatch(id, { description });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  bumpSubtaskCount(id, delta) {
    set({
      tasks: get().tasks.map((t) =>
        t.id === id ? { ...t, subtask_count: Math.max(0, (t.subtask_count ?? 0) + delta) } : t,
      ),
    });
  },
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(store): editDescription + bumpSubtaskCount"
```

---

## Task 6：task-detail store（開關 Modal）

**Files:**
- Create: `src/features/task-detail/store.ts`
- Test: `src/features/task-detail/store.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useTaskDetailStore } from "./store";

beforeEach(() => useTaskDetailStore.setState({ openId: null }));

describe("useTaskDetailStore", () => {
  it("opens and closes by task id", () => {
    useTaskDetailStore.getState().open("t1");
    expect(useTaskDetailStore.getState().openId).toBe("t1");
    useTaskDetailStore.getState().close();
    expect(useTaskDetailStore.getState().openId).toBeNull();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/task-detail/store.test.ts`
Expected: FAIL（模組不存在）。

- [ ] **Step 3：實作**

```ts
import { create } from "zustand";

interface TaskDetailState {
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useTaskDetailStore = create<TaskDetailState>()((set) => ({
  openId: null,
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
}));
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/features/task-detail/store.test.ts`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/features/task-detail/store.ts src/features/task-detail/store.test.ts
git commit -m "feat(task-detail): open/close store"
```

---

## Task 7：useTaskDetail hook（子任務 fetch + mutation）

**Files:**
- Create: `src/features/task-detail/useTaskDetail.ts`
- Test: `src/features/task-detail/useTaskDetail.test.ts`

- [ ] **Step 1：寫失敗測試**

用 `@testing-library/react` 的 `renderHook` + `act`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import * as api from "@/lib/api/todo";
import * as queue from "@/lib/api/todoQueue";
import { useTasksStore } from "@/store/tasks";
import { useTaskDetail } from "./useTaskDetail";

beforeEach(() => {
  vi.restoreAllMocks();
  useTasksStore.setState({
    tasks: [{ id: "t1", title: "T", status: "open", created_at: "", updated_at: "",
      custom_fields: {}, subtask_count: 1 }],
    status: "ready", error: null, recentlyDeleted: null,
  });
});

describe("useTaskDetail", () => {
  it("loads subtasks for the given parent", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([{ id: "c1", title: "s", status: "open" }]);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(1));
    expect(result.current.status).toBe("ready");
  });

  it("adds a subtask and bumps parent count", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([]);
    vi.spyOn(api, "createSubtask").mockResolvedValue({ id: "c9", title: "new", status: "open" });
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => { await result.current.add("new"); });
    expect(result.current.subtasks.map((s) => s.id)).toContain("c9");
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(2);
  });

  it("toggles a subtask via the patch queue", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([{ id: "c1", title: "s", status: "open" }]);
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(1));
    await act(async () => { await result.current.toggle("c1"); });
    expect(result.current.subtasks[0].status).toBe("done");
    expect(spy.mock.calls[0]).toEqual(["c1", { status: "done" }]);
  });

  it("removes a subtask and decrements parent count", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([{ id: "c1", title: "s", status: "open" }]);
    vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(1));
    await act(async () => { await result.current.remove("c1"); });
    expect(result.current.subtasks).toHaveLength(0);
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(0);
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/task-detail/useTaskDetail.test.ts`
Expected: FAIL（hook 不存在）。

- [ ] **Step 3：實作**

```ts
import { useEffect, useState } from "react";
import type { Subtask } from "@/lib/types";
import { fetchSubtasks, createSubtask } from "@/lib/api/todo";
import { enqueuePatch } from "@/lib/api/todoQueue";
import { useTasksStore } from "@/store/tasks";

type Status = "loading" | "ready" | "error";

export function useTaskDetail(parentId: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const bumpSubtaskCount = useTasksStore((s) => s.bumpSubtaskCount);

  useEffect(() => {
    if (!parentId) return;
    let alive = true;
    setStatus("loading");
    fetchSubtasks(parentId).then(
      (list) => { if (alive) { setSubtasks(list); setStatus("ready"); } },
      () => { if (alive) setStatus("error"); },
    );
    return () => { alive = false; };
  }, [parentId]);

  async function add(title: string) {
    const trimmed = title.trim();
    if (!trimmed || !parentId) return;
    try {
      const created = await createSubtask(parentId, trimmed);
      setSubtasks((prev) => [...prev, created]);
      bumpSubtaskCount(parentId, 1);
    } catch {
      setStatus("error");
    }
  }

  async function toggle(id: string) {
    const target = subtasks.find((s) => s.id === id);
    if (!target) return;
    const next = target.status === "done" ? "open" : "done";
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
    try {
      await enqueuePatch(id, { status: next });
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, status: target.status } : s)));
    }
  }

  async function rename(id: string, title: string) {
    const trimmed = title.trim();
    const target = subtasks.find((s) => s.id === id);
    if (!trimmed || !target) return;
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)));
    try {
      await enqueuePatch(id, { title: trimmed });
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, title: target.title } : s)));
    }
  }

  async function remove(id: string) {
    if (!parentId) return;
    const prev = subtasks;
    setSubtasks((cur) => cur.filter((s) => s.id !== id));
    bumpSubtaskCount(parentId, -1);
    try {
      await enqueuePatch(id, { status: "cancelled" });
    } catch {
      setSubtasks(prev);
      bumpSubtaskCount(parentId, 1);
    }
  }

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.status === "done").length;

  return { subtasks, status, total, done, add, toggle, rename, remove };
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/features/task-detail/useTaskDetail.test.ts`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/features/task-detail/useTaskDetail.ts src/features/task-detail/useTaskDetail.test.ts
git commit -m "feat(task-detail): useTaskDetail hook for subtasks"
```

---

## Task 8：安裝 react-markdown + DescriptionEditor

**Files:**
- Modify: `package.json`（透過 npm install）
- Create: `src/features/task-detail/DescriptionEditor.tsx`
- Create: `src/features/task-detail/DescriptionEditor.module.css`
- Test: `src/features/task-detail/DescriptionEditor.test.tsx`

- [ ] **Step 1：裝相依**

Run: `npm install react-markdown remark-gfm --legacy-peer-deps`
Expected: 成功加入 `dependencies`。

- [ ] **Step 2：寫失敗測試**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DescriptionEditor } from "./DescriptionEditor";

describe("DescriptionEditor", () => {
  it("renders markdown in view mode", () => {
    render(<DescriptionEditor value="**bold**" onSave={() => {}} />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("shows a placeholder when empty and enters edit on click", async () => {
    render(<DescriptionEditor value="" onSave={() => {}} />);
    await userEvent.click(screen.getByText("加上描述…"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("saves on blur with the edited text", async () => {
    const onSave = vi.fn();
    render(<DescriptionEditor value="old" onSave={onSave} />);
    await userEvent.click(screen.getByLabelText("編輯描述"));
    const ta = screen.getByRole("textbox");
    await userEvent.clear(ta);
    await userEvent.type(ta, "new");
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith("new");
  });
});
```

- [ ] **Step 3：跑測試確認失敗**

Run: `npx vitest run src/features/task-detail/DescriptionEditor.test.tsx`
Expected: FAIL（元件不存在）。

- [ ] **Step 4：實作元件**

`DescriptionEditor.tsx`：

```tsx
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./DescriptionEditor.module.css";

export interface DescriptionEditorProps {
  value: string;
  onSave: (text: string) => void;
}

export function DescriptionEditor({ value, onSave }: DescriptionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (editing) {
    return (
      <textarea
        className={styles.editor}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        aria-label="編輯描述"
      />
    );
  }

  return (
    <div className={styles.view}>
      <button type="button" className={styles.editBtn} aria-label="編輯描述" onClick={startEdit}>
        ✎ 編輯
      </button>
      {value ? (
        <div className={styles.markdown}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : (
        <button type="button" className={styles.placeholder} onClick={startEdit}>
          加上描述…
        </button>
      )}
    </div>
  );
}
```

`DescriptionEditor.module.css`（沿用既有 token；最小可用）：

```css
.view { position: relative; }
.editBtn {
  position: absolute; top: 0; right: 0;
  background: none; border: none; cursor: pointer;
  font-size: 12px; color: var(--color-accent, #9a6a2c);
}
.markdown { line-height: 1.6; }
.markdown :where(ul, ol) { margin: 6px 0 0; padding-left: 20px; }
.placeholder {
  background: none; border: none; cursor: text;
  color: var(--color-text-muted, #b0a890); font-size: 14px; padding: 0;
}
.editor {
  width: 100%; min-height: 120px; resize: vertical;
  font: inherit; line-height: 1.6;
  border: 1px solid var(--color-border, #d8d0bf); border-radius: 6px; padding: 8px;
  background: var(--color-surface, #fff); color: inherit;
}
```

> 安全性：`react-markdown` 預設不渲染原始 HTML（不啟用 `rehype-raw`），符合 spec 的 XSS 防護要求，毋須額外設定。

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/task-detail/DescriptionEditor.test.tsx`
Expected: PASS。

- [ ] **Step 6：commit**

```bash
git add package.json package-lock.json src/features/task-detail/DescriptionEditor.tsx src/features/task-detail/DescriptionEditor.module.css src/features/task-detail/DescriptionEditor.test.tsx
git commit -m "feat(task-detail): markdown DescriptionEditor (react-markdown)"
```

---

## Task 9：SubtaskList

**Files:**
- Create: `src/features/task-detail/SubtaskList.tsx`
- Create: `src/features/task-detail/SubtaskList.module.css`
- Test: `src/features/task-detail/SubtaskList.test.tsx`

- [ ] **Step 1：寫失敗測試**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubtaskList } from "./SubtaskList";
import type { Subtask } from "@/lib/types";

const subs: Subtask[] = [
  { id: "c1", title: "done one", status: "done" },
  { id: "c2", title: "open one", status: "open" },
];

describe("SubtaskList", () => {
  it("shows done/total progress", () => {
    render(<SubtaskList subtasks={subs} onToggle={() => {}} onRename={() => {}} onRemove={() => {}} onAdd={() => {}} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("toggles a subtask", async () => {
    const onToggle = vi.fn();
    render(<SubtaskList subtasks={subs} onToggle={onToggle} onRename={() => {}} onRemove={() => {}} onAdd={() => {}} />);
    await userEvent.click(screen.getByLabelText("open one"));
    expect(onToggle).toHaveBeenCalledWith("c2");
  });

  it("adds a subtask on Enter", async () => {
    const onAdd = vi.fn();
    render(<SubtaskList subtasks={[]} onToggle={() => {}} onRename={() => {}} onRemove={() => {}} onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("新增子任務…");
    await userEvent.type(input, "third{Enter}");
    expect(onAdd).toHaveBeenCalledWith("third");
  });

  it("removes a subtask", async () => {
    const onRemove = vi.fn();
    render(<SubtaskList subtasks={subs} onToggle={() => {}} onRename={() => {}} onRemove={onRemove} onAdd={() => {}} />);
    await userEvent.click(screen.getAllByLabelText("刪除子任務")[0]);
    expect(onRemove).toHaveBeenCalledWith("c1");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/task-detail/SubtaskList.test.tsx`
Expected: FAIL（元件不存在）。

- [ ] **Step 3：實作**

`SubtaskList.tsx`：

```tsx
import { useState } from "react";
import type { Subtask } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import styles from "./SubtaskList.module.css";

export interface SubtaskListProps {
  subtasks: Subtask[];
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  onAdd: (title: string) => void;
}

export function SubtaskList({ subtasks, onToggle, onRename, onRemove, onAdd }: SubtaskListProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.status === "done").length;

  function submitAdd() {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  }

  function commitRename(id: string) {
    setEditingId(null);
    if (editDraft.trim()) onRename(id, editDraft);
  }

  return (
    <div className={styles.wrap}>
      {total > 0 && (
        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className={styles.count}>{done} / {total}</span>
        </div>
      )}
      {subtasks.map((s) => (
        <div key={s.id} className={[styles.row, s.status === "done" && styles.done].filter(Boolean).join(" ")}>
          <Checkbox checked={s.status === "done"} onCheckedChange={() => onToggle(s.id)} aria-label={s.title} />
          {editingId === s.id ? (
            <input
              className={styles.editInput}
              autoFocus
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onBlur={() => commitRename(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) commitRename(s.id);
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          ) : (
            <button
              type="button"
              className={styles.title}
              onClick={() => { setEditingId(s.id); setEditDraft(s.title); }}
            >
              {s.title}
            </button>
          )}
          <button type="button" className={styles.del} aria-label="刪除子任務" onClick={() => onRemove(s.id)}>
            🗑
          </button>
        </div>
      ))}
      <div className={styles.add}>
        <span className={styles.plus}>＋</span>
        <input
          className={styles.addInput}
          placeholder="新增子任務…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAdd();
          }}
        />
      </div>
    </div>
  );
}
```

`SubtaskList.module.css`（最小可用）：

```css
.wrap { display: flex; flex-direction: column; gap: 2px; }
.progress { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.track { flex: 1; height: 6px; border-radius: 3px; background: rgba(0,0,0,0.08); overflow: hidden; }
.fill { height: 100%; background: var(--color-accent, #c08a4a); }
.count { font-size: 12px; color: var(--color-text-muted, #6a6453); }
.row { display: flex; align-items: center; gap: 10px; padding: 6px 4px; border-radius: 6px; }
.row:hover { background: rgba(0,0,0,0.03); }
.title { flex: 1; text-align: left; background: none; border: none; cursor: text; font: inherit; color: inherit; padding: 0; }
.done .title { text-decoration: line-through; opacity: 0.5; }
.editInput { flex: 1; font: inherit; border: none; border-bottom: 1px solid var(--color-accent, #c08a4a); background: transparent; color: inherit; padding: 2px 0; }
.del { background: none; border: none; cursor: pointer; opacity: 0.5; }
.del:hover { opacity: 1; }
.add { display: flex; align-items: center; gap: 10px; padding: 8px 4px; }
.plus { color: var(--color-text-muted, #9a927e); }
.addInput { flex: 1; font: inherit; border: none; border-bottom: 1px dashed var(--color-border, #c9bfa6); background: transparent; color: inherit; padding: 3px 2px; }
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/features/task-detail/SubtaskList.test.tsx`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/features/task-detail/SubtaskList.tsx src/features/task-detail/SubtaskList.module.css src/features/task-detail/SubtaskList.test.tsx
git commit -m "feat(task-detail): SubtaskList with progress + add/rename/remove"
```

---

## Task 10：TaskDetailModal（Base UI Dialog）+ 掛載

**Files:**
- Create: `src/features/task-detail/TaskDetailModal.tsx`
- Create: `src/features/task-detail/TaskDetailModal.module.css`
- Modify: `src/routes/__root.tsx`
- Test: `src/features/task-detail/TaskDetailModal.test.tsx`

- [ ] **Step 1：寫失敗測試**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as api from "@/lib/api/todo";
import { useTasksStore } from "@/store/tasks";
import { useTaskDetailStore } from "./store";
import { TaskDetailModal } from "./TaskDetailModal";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "fetchSubtasks").mockResolvedValue([]);
  useTasksStore.setState({
    tasks: [{ id: "t1", title: "Ship MVP", description: "**plan**", status: "open",
      created_at: "", updated_at: "", custom_fields: { daily_priority: "1" }, subtask_count: 0 }],
    status: "ready", error: null, recentlyDeleted: null,
  });
  useTaskDetailStore.setState({ openId: null });
});

describe("TaskDetailModal", () => {
  it("renders nothing when closed", () => {
    render(<TaskDetailModal />);
    expect(screen.queryByText("Ship MVP")).toBeNull();
  });

  it("shows the open task's title and rendered description", async () => {
    useTaskDetailStore.setState({ openId: "t1" });
    render(<TaskDetailModal />);
    expect(await screen.findByDisplayValue("Ship MVP")).toBeInTheDocument();
    expect(screen.getByText("plan").tagName).toBe("STRONG");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/task-detail/TaskDetailModal.test.tsx`
Expected: FAIL（元件不存在）。

- [ ] **Step 3：實作元件**

`TaskDetailModal.tsx`（標題用受控 `<input>`，故測試用 `findByDisplayValue`）：

```tsx
import { Dialog } from "@base-ui/react/dialog";
import { useTasksStore } from "@/store/tasks";
import { todayISO } from "@/lib/date";
import { Checkbox } from "@/ui/Checkbox";
import { useTaskDetailStore } from "./store";
import { useTaskDetail } from "./useTaskDetail";
import { DescriptionEditor } from "./DescriptionEditor";
import { SubtaskList } from "./SubtaskList";
import styles from "./TaskDetailModal.module.css";

const PRIORITY_LABEL: Record<string, string> = { "1": "① 今日第一", "2": "② 今日第二", "3": "③ 今日第三" };

export function TaskDetailModal() {
  const openId = useTaskDetailStore((s) => s.openId);
  const close = useTaskDetailStore((s) => s.close);
  const task = useTasksStore((s) => s.tasks.find((t) => t.id === openId) ?? null);

  const toggleDone = useTasksStore((s) => s.toggleDone);
  const editTitle = useTasksStore((s) => s.editTitle);
  const editDescription = useTasksStore((s) => s.editDescription);
  const deleteTask = useTasksStore((s) => s.deleteTask);

  const detail = useTaskDetail(openId);

  // Render the dialog only when there is an open task to anchor it to.
  const open = Boolean(openId && task);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} aria-label="任務詳情">
          {task && (
            <>
              <div className={styles.header}>
                <Checkbox
                  checked={task.status === "done"}
                  onCheckedChange={() => toggleDone(task.id)}
                  aria-label="完成任務"
                />
                <input
                  className={styles.title}
                  defaultValue={task.title}
                  key={task.id}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== task.title) editTitle(task.id, v);
                  }}
                  aria-label="任務標題"
                />
                <Dialog.Close className={styles.close} aria-label="關閉">✕</Dialog.Close>
              </div>

              <div className={styles.chips}>
                {task.custom_fields.daily_priority && (
                  <span className={`${styles.chip} ${styles.pri}`}>
                    {PRIORITY_LABEL[task.custom_fields.daily_priority]}
                  </span>
                )}
                {task.custom_fields.scheduled_dates?.length ? (
                  <span className={styles.chip}>
                    排到 {task.custom_fields.scheduled_dates[task.custom_fields.scheduled_dates.length - 1].slice(5)}
                  </span>
                ) : null}
                {task.custom_fields.scheduled_months?.includes(todayISO().slice(0, 7)) && (
                  <span className={styles.chip}>本月</span>
                )}
              </div>

              <section className={styles.section}>
                <div className={styles.label}>描述</div>
                <DescriptionEditor
                  value={task.description ?? ""}
                  onSave={(text) => editDescription(task.id, text)}
                />
              </section>

              <section className={styles.section}>
                <div className={styles.label}>子任務</div>
                {detail.status === "error" ? (
                  <p className={styles.muted}>子任務載入失敗</p>
                ) : (
                  <SubtaskList
                    subtasks={detail.subtasks}
                    onToggle={detail.toggle}
                    onRename={detail.rename}
                    onRemove={detail.remove}
                    onAdd={detail.add}
                  />
                )}
              </section>

              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => { deleteTask(task.id); close(); }}
                >
                  🗑 刪除任務
                </button>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

`TaskDetailModal.module.css`（最小可用、紙感調性）：

```css
.backdrop { position: fixed; inset: 0; background: rgba(20, 16, 10, 0.35); }
.popup {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(520px, calc(100vw - 32px)); max-height: 85vh; overflow: auto;
  background: var(--color-surface, #fbf8f1); color: var(--color-text, #2c2820);
  border: 1px solid var(--color-border, #d8d0bf); border-radius: 14px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.18);
}
.header { display: flex; align-items: center; gap: 10px; padding: 16px 18px 8px; }
.title { flex: 1; font-size: 17px; font-weight: 650; border: none; background: transparent; color: inherit; padding: 2px 0; }
.close { background: none; border: none; cursor: pointer; opacity: 0.5; font-size: 16px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 18px 12px; }
.chip { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; background: rgba(0,0,0,0.05); color: var(--color-text-muted, #6a6453); }
.pri { background: rgba(192,138,74,0.16); color: var(--color-accent, #9a6a2c); }
.section { padding: 12px 18px; border-top: 1px solid var(--color-border-soft, #ece5d6); }
.label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted, #9a927e); margin-bottom: 8px; }
.muted { color: var(--color-text-muted, #9a927e); font-size: 13px; }
.footer { padding: 12px 18px; border-top: 1px solid var(--color-border-soft, #ece5d6); }
.delete { background: none; border: none; cursor: pointer; font-size: 13px; color: var(--color-danger, #b3401f); }

@media (max-width: 560px) {
  .popup { top: auto; bottom: 0; left: 0; transform: none; width: 100vw; max-height: 92vh; border-radius: 16px 16px 0 0; }
}
```

- [ ] **Step 4：掛載到 root**

把 `src/routes/__root.tsx` 的 `RootComponent` 改為：

```tsx
import { TaskDetailModal } from "@/features/task-detail/TaskDetailModal";
// ...
  return (
    <>
      <TopNav />
      <Outlet />
      <TaskDetailModal />
    </>
  );
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/task-detail/TaskDetailModal.test.tsx`
Expected: PASS。

- [ ] **Step 6：commit**

```bash
git add src/features/task-detail/TaskDetailModal.tsx src/features/task-detail/TaskDetailModal.module.css src/routes/__root.tsx src/features/task-detail/TaskDetailModal.test.tsx
git commit -m "feat(task-detail): TaskDetailModal dialog + root mount"
```

---

## Task 11：TaskDetailTrigger（展開 icon + 徽記）插進三種 row

**Files:**
- Create: `src/features/task-detail/TaskDetailTrigger.tsx`
- Create: `src/features/task-detail/TaskDetailTrigger.module.css`
- Modify: `src/features/day/TaskRow.tsx`
- Modify: `src/features/month/MonthRow.tsx`
- Modify: `src/features/backlog/BacklogRow.tsx`
- Test: `src/features/task-detail/TaskDetailTrigger.test.tsx`

- [ ] **Step 1：寫失敗測試**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@/lib/types";
import { useTaskDetailStore } from "./store";
import { TaskDetailTrigger } from "./TaskDetailTrigger";

function task(over: Partial<Task> = {}): Task {
  return { id: "t1", title: "T", status: "open", created_at: "", updated_at: "", custom_fields: {}, ...over };
}

beforeEach(() => useTaskDetailStore.setState({ openId: null }));

describe("TaskDetailTrigger", () => {
  it("opens the detail store on click", async () => {
    render(<TaskDetailTrigger task={task()} />);
    await userEvent.click(screen.getByLabelText("開啟詳情"));
    expect(useTaskDetailStore.getState().openId).toBe("t1");
  });

  it("shows a subtask-count badge when there are subtasks", () => {
    render(<TaskDetailTrigger task={task({ subtask_count: 3 })} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a description marker when description is present", () => {
    render(<TaskDetailTrigger task={task({ description: "x" })} />);
    expect(screen.getByLabelText("有描述")).toBeInTheDocument();
  });

  it("renders no badge when neither subtasks nor description", () => {
    render(<TaskDetailTrigger task={task()} />);
    expect(screen.queryByLabelText("有描述")).toBeNull();
    expect(screen.queryByTestId("subtask-badge")).toBeNull();
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/task-detail/TaskDetailTrigger.test.tsx`
Expected: FAIL（元件不存在）。

- [ ] **Step 3：實作元件**

`TaskDetailTrigger.tsx`：

```tsx
import type { Task } from "@/lib/types";
import { useTaskDetailStore } from "./store";
import styles from "./TaskDetailTrigger.module.css";

export interface TaskDetailTriggerProps {
  task: Task;
}

export function TaskDetailTrigger({ task }: TaskDetailTriggerProps) {
  const open = useTaskDetailStore((s) => s.open);
  const count = task.subtask_count ?? 0;
  const hasDesc = Boolean(task.description);

  return (
    <span className={styles.wrap}>
      {(count > 0 || hasDesc) && (
        <span className={styles.badge}>
          {count > 0 && <span data-testid="subtask-badge" className={styles.count}>◔ {count}</span>}
          {hasDesc && <span className={styles.descDot} aria-label="有描述">·有描述</span>}
        </span>
      )}
      <button
        type="button"
        className={styles.expand}
        aria-label="開啟詳情"
        onClick={() => open(task.id)}
      >
        ⤢
      </button>
    </span>
  );
}
```

`TaskDetailTrigger.module.css`：

```css
.wrap { display: inline-flex; align-items: center; gap: 6px; }
.badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-muted, #8a8268); }
.expand {
  width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; border-radius: 6px;
  color: var(--color-text-muted, #6a6453);
}
.expand:hover { background: rgba(0,0,0,0.05); }
@media (hover: hover) {
  /* On pointer devices, reveal the icon on row hover via the row's own hover
     rules; the badge stays visible because it is information, not an action. */
  .expand { opacity: 0.7; }
}
```

- [ ] **Step 4：插進三種 row**

`src/features/day/TaskRow.tsx`：`import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";`，並在 `{showAdhocChip && isAdhoc && <UnplannedChip />}` 之後、`{editable && !row.isEditing && (...)}` 之前插入：

```tsx
      <TaskDetailTrigger task={task} />
```

`src/features/month/MonthRow.tsx`：同樣 import，於 `{isAdhoc && <UnplannedChip />}` 之後插入 `<TaskDetailTrigger task={task} />`。

`src/features/backlog/BacklogRow.tsx`：同樣 import，於 row 的動作區（`⋯` menu）之前插入 `<TaskDetailTrigger task={task} />`（依該檔現有結構放在標題與 actions 之間）。

- [ ] **Step 5：跑測試 + 既有 row 測試確認沒破**

Run: `npx vitest run src/features/task-detail/TaskDetailTrigger.test.tsx src/features/day/TaskRow.test.tsx src/features/month/MonthRow.test.tsx src/features/backlog/BacklogRow.test.tsx`
Expected: PASS（既有 row 測試可能需補對新 `TaskDetailTrigger` 的存在無感——若既有測試以精確 query 撞到新按鈕，改用更明確的 query；否則不動）。

- [ ] **Step 6：commit**

```bash
git add src/features/task-detail/TaskDetailTrigger.tsx src/features/task-detail/TaskDetailTrigger.module.css src/features/day/TaskRow.tsx src/features/month/MonthRow.tsx src/features/backlog/BacklogRow.tsx src/features/task-detail/TaskDetailTrigger.test.tsx
git commit -m "feat(task-detail): expand trigger + content badge in task rows"
```

---

## Task 12：型別檢查 + 全測試

**Files:** 無（驗證關卡）

- [ ] **Step 1：型別檢查（專案唯一可信的方式）**

Run: `npm run build`
Expected: `tsc -b` 無錯、`vite build` 成功。若有錯就地修到綠。

- [ ] **Step 2：全 vitest**

Run: `npx vitest run`
Expected: 全部 PASS。

- [ ] **Step 3：commit（若 Step 1/2 有修才需要）**

```bash
git add -A
git commit -m "fix(task-detail): satisfy build + tests"
```

---

## Task 13：e2e —— wspc-fake 擴充 + task-detail.spec.ts

**Files:**
- Modify: `e2e/fixtures/wspc-fake.ts`
- Create: `e2e/task-detail.spec.ts`

- [ ] **Step 1：擴充 fake WSPC**

在 `e2e/fixtures/wspc-fake.ts`：

(a) `Todo` 介面加可選欄位：

```ts
interface Todo {
  id: string;
  project_id: string;
  type_id: string;
  status: Status;
  title: string;
  created_at: number;
  updated_at: number;
  description?: string;
  parent_id?: string;
  custom_fields: Record<string, string | string[]>;
}
```

(b) `GET /todo/items` 的過濾改為依 `parent_id` 分流，並在回傳每筆補 `child_count`：

```ts
  if (path === "/todo/items" && method === "GET") {
    const projectId = url.searchParams.get("project_id");
    const statuses = url.searchParams.getAll("status");
    const parentId = url.searchParams.get("parent_id");
    const result = todos.filter((t) => {
      if (projectId && t.project_id !== projectId) return false;
      if (statuses.length && !statuses.includes(t.status)) return false;
      // No parent_id param => root-level only; with one => that parent's children.
      if (parentId) return t.parent_id === parentId;
      return !t.parent_id;
    });
    const withCounts = result.map((t) => ({
      ...t,
      child_count: todos.filter((c) => c.parent_id === t.id && c.status !== "cancelled").length,
    }));
    return send(res, 200, { todos: withCounts });
  }
```

(c) `POST /todo/items` 支援 `parent_id` 與 `description`：

```ts
    const todo: Todo = {
      id: `e2e-new-${idCounter}`,
      project_id: String(body.project_id ?? PROJECT_ID),
      type_id: String(body.type_id ?? TYPE_ID),
      status: "open",
      title: String(body.title ?? ""),
      created_at: now,
      updated_at: now,
      parent_id: typeof body.parent_id === "string" ? body.parent_id : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      custom_fields: (body.custom_fields as Record<string, string | string[]>) ?? {},
    };
```

(d) `PATCH /todo/items/:id` 支援 `description`：在既有 `if (typeof body.title === "string")` 後加：

```ts
    if (typeof body.description === "string") todo.description = body.description;
```

(e) 在 `seed()` 為某個今天的 task 加一筆 description + 一個子任務，讓 spec 有東西可驗。於 `seed()` 的 `todos = [...]` 後、`month` 區塊前加：

```ts
  // Detail-modal fixtures: d1 has a description and one subtask.
  const d1 = todos.find((t) => t.id === "d1");
  if (d1) d1.description = "**MVP** demo checklist";
  todos.push({
    id: "d1-sub1",
    project_id: PROJECT_ID,
    type_id: TYPE_ID,
    status: "open",
    title: "first subtask",
    created_at: base,
    updated_at: base,
    parent_id: "d1",
    custom_fields: {},
  });
```

- [ ] **Step 2：寫 e2e spec**

`e2e/task-detail.spec.ts`（沿用 `e2e/fixtures/session.ts` 的 `gotoTodaySeeded` helper；若該 helper 名稱/簽名不同，依現況調整）：

```ts
import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

test.beforeEach(async ({ page }) => {
  await gotoTodaySeeded(page);
});

test("opens detail, shows description + subtask, adds and toggles", async ({ page }) => {
  // Open the detail modal for the first top-3 task (d1).
  const row = page.locator("text=完成 desk.yurenju.me todo MVP demo").locator("..");
  await row.getByLabel("開啟詳情").click();

  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await expect(dialog).toBeVisible();
  // Rendered markdown: **MVP** -> strong
  await expect(dialog.locator("strong", { hasText: "MVP" })).toBeVisible();
  // Existing subtask present, progress 0 / 1
  await expect(dialog.getByText("0 / 1")).toBeVisible();

  // Add a subtask
  await dialog.getByPlaceholder("新增子任務…").fill("second subtask");
  await dialog.getByPlaceholder("新增子任務…").press("Enter");
  await expect(dialog.getByText("0 / 2")).toBeVisible();

  // Toggle the first subtask done
  await dialog.getByLabel("first subtask").click();
  await expect(dialog.getByText("1 / 2")).toBeVisible();
});

test("edits description and persists across reopen", async ({ page }) => {
  const row = page.locator("text=寫週報 + 5 月中檢視").locator("..");
  await row.getByLabel("開啟詳情").click();
  const dialog = page.getByRole("dialog", { name: "任務詳情" });

  await dialog.getByText("加上描述…").click();
  await dialog.getByRole("textbox").fill("weekly **report** plan");
  await dialog.getByRole("textbox").blur();
  await expect(dialog.locator("strong", { hasText: "report" })).toBeVisible();

  // Close and reopen — description still there
  await dialog.getByLabel("關閉").click();
  await row.getByLabel("開啟詳情").click();
  await expect(dialog.locator("strong", { hasText: "report" })).toBeVisible();
});
```

- [ ] **Step 3：跑 e2e（先確認沒有 preview server 佔用 5173）**

> 重要：跑前先停掉任何 `preview_start` 的 dev server，否則 Playwright 會重用到非 e2e env 的 server 導致 seeded 測試全失敗。

Run: `npm run test:e2e`
Expected: 既有 24 + 新 2 皆 PASS。

- [ ] **Step 4：commit**

```bash
git add e2e/fixtures/wspc-fake.ts e2e/task-detail.spec.ts
git commit -m "test(e2e): task detail modal — subtasks + description"
```

---

## Task 14：手動 preview 驗收（preview + AI agent）

**Files:** 無（手動驗收）

- [ ] **Step 1：起 preview 並用 dev-login 免登入**

用 `preview_start`（`dev`）開預覽，`POST /api/dev-login` 取得登入態（見 [[desk-preview-auth-dev-login]] 的機制；若 KV 已有 session 直接 reissue，否則走一次 device flow）。確認 header 顯示測試帳號。

- [ ] **Step 2：對照設計「驗收標準」逐項驗**

逐項手動操作驗收 spec 的驗收標準 1–12：展開 icon / 徽記、Markdown 渲染、描述編輯即時儲存與重開保留、空描述 placeholder、子任務進度、勾選 / 新增 / 改標題 / 刪除即時生效並同步徽記、刪除任務、subtask 不出現在月/週/日/backlog、Modal 升起與手機全屏 sheet 過場。截圖佐證視覺。

- [ ] **Step 3：記錄結果**

把通過 / 未過逐項記下；未過的回對應 Task 修正後重驗。

---

## 自我檢查（writing-plans 規定，已執行）

- **spec 覆蓋**：展開入口 + 徽記（Task 11）、Modal 版型（Task 10）、description 渲染/編輯（Task 8）、subtask 勾/加/刪/改（Task 7+9）、BFF mapper + 端點（Task 1–3）、前端 api/store（Task 4–6）、即時儲存（patch queue，沿用）、e2e（Task 13）、手動驗收（Task 14）。皆有對應任務。
- **非目標**未做：拖拉排序、`2/3` 上 row、cascade 刪子任務——計畫未涉及，正確。
- **型別一致**：`Subtask {id,title,status}`、`Task.subtask_count`、`mapTodoToSubtask`、`fetchSubtasks`/`createSubtask`、`bumpSubtaskCount`/`editDescription`、`useTaskDetail` 的 `add/toggle/rename/remove` 在各任務間命名一致。
- **風險**（spec 列）：REST `child_count`/`description` 實證——於 Task 14 手動對真實 WSPC 驗；e2e 用 fake 已涵蓋邏輯。
