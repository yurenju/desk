# Todo PATCH 序列化佇列 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 對同一個 todo 的 PATCH 做 per-id 序列化加合併,消除連點 priority ring 造成的 `VERSION_CONFLICT` 並發衝突。

**架構:** 新增 `src/lib/api/todoQueue.ts`,內部以 module-level `Map<id, QueueEntry>` 維護每個 todo 的佇列;同 id 的請求一個接一個送、in-flight 期間的新 patch 淺合併成一個批次;不同 id 天然並行。store 層把所有 `patchTodoApi` 呼叫改走 `enqueuePatch`,並只把 `setDailyPriority` 的失敗回復改成 reload。

**技術棧:** TypeScript、Zustand、Vitest。

---

## 檔案結構

- 新增:`src/lib/api/todoQueue.ts` — per-id PATCH 序列化加合併佇列,對外只暴露 `enqueuePatch` 與測試用的 `resetTodoQueue`。
- 新增:`src/lib/api/todoQueue.test.ts` — 佇列的單元測試。
- 修改:`src/store/tasks.ts` — 所有 mutation 改用 `enqueuePatch`;`setDailyPriority` 失敗改 reload。
- 修改:`src/store/tasks.test.ts` — 加 `resetTodoQueue` 到 `beforeEach`;新增 setDailyPriority 失敗 reload 測試。

---

### 任務 1:佇列骨架與單一 patch 直送

**檔案:**
- 新增:`src/lib/api/todoQueue.ts`
- 測試:`src/lib/api/todoQueue.test.ts`

- [ ] **步驟 1:撰寫失敗的測試**

`src/lib/api/todoQueue.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Task } from "@/lib/types";
import * as api from "./todo";
import { enqueuePatch, resetTodoQueue } from "./todoQueue";

beforeEach(() => {
  vi.restoreAllMocks();
  resetTodoQueue();
});

describe("todoQueue", () => {
  it("sends a single patch immediately and resolves with the task", async () => {
    const spy = vi
      .spyOn(api, "patchTodoApi")
      .mockResolvedValue({ id: "a" } as Task);
    const task = await enqueuePatch("a", { daily_priority: "1" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("a", { daily_priority: "1" });
    expect(task).toEqual({ id: "a" });
  });
});
```

- [ ] **步驟 2:執行測試確認失敗**

Run: `npx vitest run src/lib/api/todoQueue.test.ts`
Expected: FAIL,訊息類似 `Failed to resolve import "./todoQueue"` 或 `enqueuePatch is not a function`。

- [ ] **步驟 3:寫最小實作**

`src/lib/api/todoQueue.ts`:

```ts
import type { Task } from "@/lib/types";
import { patchTodoApi, type TodoPatch } from "./todo";

interface Waiter {
  resolve: (task: Task) => void;
  reject: (err: unknown) => void;
}

interface QueueEntry {
  // Patch accumulated while a request for this id is in flight.
  pendingPatch: TodoPatch | null;
  // Callers waiting for the coalesced pending batch to settle.
  pendingWaiters: Waiter[];
}

// One entry per todo id. Presence of an entry means a request for that id is
// currently in flight; an idle id has no entry.
const queues = new Map<string, QueueEntry>();

// Test-only: drop all queue state between tests.
export function resetTodoQueue(): void {
  queues.clear();
}

export function enqueuePatch(id: string, patch: TodoPatch): Promise<Task> {
  const entry = queues.get(id);
  if (!entry) {
    // No in-flight request for this id: send immediately.
    queues.set(id, { pendingPatch: null, pendingWaiters: [] });
    const p = patchTodoApi(id, patch);
    p.then(
      () => flush(id),
      (err) => abort(id, err),
    );
    return p;
  }
  // A request is in flight: merge this patch into the pending batch and wait.
  entry.pendingPatch = { ...(entry.pendingPatch ?? {}), ...patch };
  return new Promise<Task>((resolve, reject) => {
    entry.pendingWaiters.push({ resolve, reject });
  });
}

function flush(id: string): void {
  const entry = queues.get(id);
  if (!entry) return;
  if (entry.pendingPatch === null) {
    // Nothing accumulated: the id is now idle.
    queues.delete(id);
    return;
  }
  const patch = entry.pendingPatch;
  const batch = entry.pendingWaiters;
  entry.pendingPatch = null;
  entry.pendingWaiters = [];
  patchTodoApi(id, patch).then(
    (task) => {
      batch.forEach((w) => w.resolve(task));
      flush(id);
    },
    (err) => {
      batch.forEach((w) => w.reject(err));
      abort(id, err);
    },
  );
}

function abort(id: string, err: unknown): void {
  const entry = queues.get(id);
  if (!entry) return;
  const waiters = entry.pendingWaiters;
  queues.delete(id);
  waiters.forEach((w) => w.reject(err));
}
```

- [ ] **步驟 4:執行測試確認通過**

Run: `npx vitest run src/lib/api/todoQueue.test.ts`
Expected: PASS。

- [ ] **步驟 5:Commit**

```bash
git add src/lib/api/todoQueue.ts src/lib/api/todoQueue.test.ts
git commit -m "feat(todoQueue): per-id patch queue, single-patch path"
```

---

### 任務 2:同 id 序列化與合併

**檔案:**
- 修改:`src/lib/api/todoQueue.test.ts`(沿用任務 1 的實作,只補測試)

- [ ] **步驟 1:撰寫失敗的測試**

在 `describe("todoQueue", ...)` 內新增兩個測試:

```ts
it("merges patches enqueued while a request is in flight into one follow-up", async () => {
  let resolve1!: (t: Task) => void;
  const p1 = new Promise<Task>((r) => {
    resolve1 = r;
  });
  const spy = vi
    .spyOn(api, "patchTodoApi")
    .mockReturnValueOnce(p1)
    .mockResolvedValueOnce({ id: "a", v: 2 } as unknown as Task);

  const c1 = enqueuePatch("a", { daily_priority: "1" }); // sent as R1
  const c2 = enqueuePatch("a", { daily_priority: "2" }); // merged into pending
  const c3 = enqueuePatch("a", { status: "done" }); // merged into pending

  // Only R1 has been sent while R1 is still in flight.
  expect(spy).toHaveBeenCalledTimes(1);

  resolve1({ id: "a", v: 1 } as unknown as Task);
  await c1;
  const [r2, r3] = await Promise.all([c2, c3]);

  // R1, then exactly one coalesced batch carrying both fields (later wins).
  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenNthCalledWith(2, "a", {
    daily_priority: "2",
    status: "done",
  });
  // c2 and c3 share the single coalesced result.
  expect(r2).toEqual({ id: "a", v: 2 });
  expect(r3).toEqual({ id: "a", v: 2 });
});

it("later value wins when the same field is enqueued repeatedly", async () => {
  let resolve1!: (t: Task) => void;
  const p1 = new Promise<Task>((r) => {
    resolve1 = r;
  });
  const spy = vi
    .spyOn(api, "patchTodoApi")
    .mockReturnValueOnce(p1)
    .mockResolvedValueOnce({ id: "a" } as Task);

  const c1 = enqueuePatch("a", { daily_priority: "1" });
  const c2 = enqueuePatch("a", { daily_priority: "2" });
  const c3 = enqueuePatch("a", { daily_priority: "3" });

  resolve1({ id: "a" } as Task);
  await Promise.all([c1, c2, c3]);

  expect(spy).toHaveBeenNthCalledWith(2, "a", { daily_priority: "3" });
});
```

- [ ] **步驟 2:執行測試確認通過(行為已由任務 1 實作涵蓋)**

Run: `npx vitest run src/lib/api/todoQueue.test.ts`
Expected: PASS(這兩個測試驗證任務 1 實作的合併行為;若失敗,代表任務 1 的 `flush`/合併邏輯有 bug,需修正)。

- [ ] **步驟 3:Commit**

```bash
git add src/lib/api/todoQueue.test.ts
git commit -m "test(todoQueue): cover serialization and coalescing of same-id patches"
```

---

### 任務 3:不同 id 並行與失敗作廢

**檔案:**
- 修改:`src/lib/api/todoQueue.test.ts`

- [ ] **步驟 1:撰寫失敗的測試**

在 `describe("todoQueue", ...)` 內新增:

```ts
it("sends different ids concurrently without blocking each other", async () => {
  let resolveA!: (t: Task) => void;
  const pA = new Promise<Task>((r) => {
    resolveA = r;
  });
  const spy = vi
    .spyOn(api, "patchTodoApi")
    .mockReturnValueOnce(pA) // id "a" hangs
    .mockResolvedValueOnce({ id: "b" } as Task); // id "b"

  const ca = enqueuePatch("a", { daily_priority: "1" });
  // "b" resolves without waiting for "a".
  const cb = await enqueuePatch("b", { daily_priority: "1" });

  expect(cb).toEqual({ id: "b" });
  expect(spy).toHaveBeenCalledTimes(2);

  resolveA({ id: "a" } as Task);
  await ca;
});

it("rejects the in-flight caller and all coalesced waiters when a request fails", async () => {
  let reject1!: (err: unknown) => void;
  const p1 = new Promise<Task>((_, rej) => {
    reject1 = rej;
  });
  vi.spyOn(api, "patchTodoApi").mockReturnValueOnce(p1);

  const c1 = enqueuePatch("a", { daily_priority: "1" });
  const c2 = enqueuePatch("a", { daily_priority: "2" }); // pending, merged

  reject1(new Error("boom"));

  await expect(c1).rejects.toThrow("boom");
  await expect(c2).rejects.toThrow("boom");
});

it("recovers for the same id after a failure (queue state is cleared)", async () => {
  vi.spyOn(api, "patchTodoApi").mockRejectedValueOnce(new Error("boom"));
  await expect(enqueuePatch("a", { daily_priority: "1" })).rejects.toThrow(
    "boom",
  );

  // After abort, the id is idle again and a fresh patch is sent normally.
  const spy = vi
    .spyOn(api, "patchTodoApi")
    .mockResolvedValue({ id: "a" } as Task);
  const task = await enqueuePatch("a", { daily_priority: "2" });
  expect(task).toEqual({ id: "a" });
  expect(spy).toHaveBeenCalledWith("a", { daily_priority: "2" });
});
```

- [ ] **步驟 2:執行測試確認通過(行為已由任務 1 實作涵蓋)**

Run: `npx vitest run src/lib/api/todoQueue.test.ts`
Expected: PASS(驗證任務 1 的 `abort` 與不同 id 獨立 entry 的行為)。

- [ ] **步驟 3:Commit**

```bash
git add src/lib/api/todoQueue.test.ts
git commit -m "test(todoQueue): cover concurrent ids and failure abort"
```

---

### 任務 4:store 接上佇列,setDailyPriority 改 reload

**檔案:**
- 修改:`src/store/tasks.ts`
- 修改:`src/store/tasks.test.ts`

- [ ] **步驟 1:撰寫失敗的測試**

在 `src/store/tasks.test.ts` 最上方的 import 區加入:

```ts
import { resetTodoQueue } from "@/lib/api/todoQueue";
```

在「server-backed tasks store」的 `beforeEach`(約 line 94)與最上方 `beforeEach`(約 line 8)兩處都加上 `resetTodoQueue();`,例如:

```ts
beforeEach(() => {
  vi.restoreAllMocks();
  resetTodoQueue();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null, recentlyDeleted: null });
});
```

並在「server-backed tasks store」describe 內新增測試:

```ts
it("setDailyPriority reloads from server when a patch fails", async () => {
  useTasksStore.setState({
    tasks: allTasks,
    today: MOCK_TODAY,
    status: "ready",
    error: null,
    recentlyDeleted: null,
  });
  vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
  const reload = vi.spyOn(api, "fetchTodos").mockResolvedValue([
    {
      id: "reloaded",
      title: "R",
      status: "open",
      parent_id: null,
      created_at: "x",
      updated_at: "x",
      custom_fields: {},
    },
  ]);
  await useTasksStore.getState().setDailyPriority("d5", "1");
  expect(reload).toHaveBeenCalledWith(MOCK_TODAY);
  expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["reloaded"]);
});
```

- [ ] **步驟 2:執行測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: FAIL,新測試 `setDailyPriority reloads from server when a patch fails` 失敗(目前 `setDailyPriority` 失敗是 `set({ tasks: prev })` 而非 reload,`fetchTodos` 不會被呼叫)。

- [ ] **步驟 3:寫實作**

修改 `src/store/tasks.ts`。

第一,改 import(約 line 3):

```ts
import { fetchTodos, postTodo } from "@/lib/api/todo";
import { enqueuePatch } from "@/lib/api/todoQueue";
```

(移除 `patchTodoApi` 的 import;若 `postTodo`/`fetchTodos` 仍由 `todo` 提供則保留。)

第二,把所有 `patchTodoApi(` 呼叫改成 `enqueuePatch(`。共有以下幾處:

- `toggleDone`(約 line 67):
```ts
await enqueuePatch(id, {
  status: willBeDone ? "done" : "open",
  done_on: willBeDone ? stamp : null,
});
```
- `editTitle`(約 line 97):
```ts
await enqueuePatch(id, { title: trimmed });
```
- `deleteTask`(約 line 109):
```ts
await enqueuePatch(id, { status: "cancelled" });
```
- `restoreTask`(約 line 121):
```ts
await enqueuePatch(removed.task.id, { status: removed.task.status });
```
- `setDailyPriority`(約 line 137):
```ts
await Promise.all(
  changed.map((t) =>
    enqueuePatch(t.id, { daily_priority: t.custom_fields.daily_priority ?? null }),
  ),
);
```

第三,只把 `setDailyPriority` 的 catch 從 rollback 改成 reload(其餘 mutation 的 catch 維持不動):

```ts
async setDailyPriority(id, n) {
  const prev = get().tasks;
  const next = setDailyPriority(prev, id, n, get().today);
  set({ tasks: next, error: null });
  const changed = next.filter((t) => {
    const before = prev.find((p) => p.id === t.id);
    return before && before.custom_fields.daily_priority !== t.custom_fields.daily_priority;
  });
  try {
    await Promise.all(
      changed.map((t) =>
        enqueuePatch(t.id, { daily_priority: t.custom_fields.daily_priority ?? null }),
      ),
    );
  } catch {
    await get().loadTasks(get().today);
  }
},
```

- [ ] **步驟 4:執行測試確認通過**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: PASS。既有 rollback 測試(toggleDone/editTitle/delete/restore)仍通過(它們的 catch 未改,且 `enqueuePatch` 內部仍呼叫被 spy 的 `patchTodoApi`),新的 setDailyPriority reload 測試通過。

- [ ] **步驟 5:跑整包測試與型別檢查**

Run: `npx vitest run`
Expected: 全部 PASS。

Run: `npx tsc -b`
Expected: 無型別錯誤(確認移除 `patchTodoApi` import 後沒有殘留參照)。

- [ ] **步驟 6:Commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(tasks): route mutations through patch queue, reload on priority conflict"
```

---

## 驗收

- 連點 priority ring 不再出現 `VERSION_CONFLICT` 409(序列化後同 id 永遠最多一個 in-flight)。
- 連點後最終 priority 與使用者停手時的值一致(合併只送最終值)。
- toggleDone/editTitle/delete/restore 的既有 rollback 與 undo 行為不變。
- `npm test` 全綠、型別檢查通過。
