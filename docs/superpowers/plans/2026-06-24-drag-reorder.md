# 拖曳重排 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓三件事（①②③）可拖曳重排並在放下前預覽溢出、活動池（backlog / 其他任務 / 其他計劃內 / 臨時加的）可桶內手排，並把 `⋯` menu / ring 的名次指定統一成跟拖曳一樣的「插入＋連鎖下推＋尾端溢出」。

**Architecture:** 兩軸資料模型 —— 重要性沿用既有 `daily_priority`/`monthly_priority`（明確 0–3 件），桶內順序啟用既有保留欄位 `position`（lex 字串）。先做純函式資料層與 store，接著把非拖曳的名次指定統一到新 op（這段就能 ship「menu 溢出」修正），最後加 `@dnd-kit/sortable` 把各 surface 改成可拖排。

**Tech Stack:** React 18 + TypeScript、Zustand store、`@dnd-kit/core`（既有）+ `@dnd-kit/sortable`（本片新增）、vitest、Playwright e2e。

## Global Constraints

- 程式碼與註解一律英文；對話 / 文件敘述繁中。
- 安裝相依套件用 `npm install --legacy-peer-deps`（openapi-typescript 與 typescript 6 的 peer 衝突）。
- 型別檢查**只信 `npm run build`**（= `tsc -b && vite build`），**不要**用 `tsc -p tsconfig.json --noEmit`（solution-style，no-op 假綠）。
- 測試檔顯式 `import { describe, it, expect } from "vitest"`（`tsc -b` 會檢查測試檔，本專案不靠 global）。
- 改到 Today/Plan 互動或使用者操作流程後，除 `npx vitest run` 也要跑 `npm run test:e2e`（Playwright 對真實 BFF + mock WSPC）。
- 拖曳排序桌機限定（`hover: hover` gated，沿用既有 `useDragEnabled`）；手機不掛、不加上下移 menu。
- 不掛 `KeyboardSensor`（沿用 Slice 4 決策）。
- 衍生區（已排入本週 / 其他已完成 / 已移走）不可拖、不套 `position`。
- Week 日格只排三件事；該格「其他」不排序。
- 不改三件事版型（維持 accent 特色卡片）。

---

## 檔案結構

**新增**
- `src/lib/order.ts` — `midpoint(a, b)` lex-order 鍵生成（純函式）。
- `src/lib/order.test.ts` — `midpoint` 單元測試。
- `src/store/taskOps.reorder.test.ts` — `reorderPriority` / `reorderInPool` 單元測試。
- `src/features/plan-view/useSortableRow.ts` — 取代 `useDraggableRow`，列同時是 sortable item + 仍能 drop 到外部 droppable。
- `src/features/plan-view/useDragOrdering.tsx` — 拖曳期間的 live preview 排序狀態（含溢出預覽），Context 提供給各欄渲染。
- `e2e/plan-reorder.spec.ts` — 拖曳重排 + menu 溢出 e2e。

**修改**
- `src/store/taskOps.ts` — 新增 `reorderPriority`、`reorderInPool` 純函式。
- `src/store/tasks.ts` — 新增對應 store actions（樂觀更新 + patch queue）。
- `src/lib/tasks.ts` — 新增 `byPosition` 比較子；pool 衍生套 `position` 排序。
- `src/features/day/DailyPriorityMenu.tsx`、`day/useTaskRow.ts`、`day/Top3Card.tsx`、`day/TaskRow.tsx` — ring/menu 名次指定改走 `reorderPriority`；列改 sortable。
- `src/features/month/useMonthRow.ts`、`month/monthRowMenu.ts`、`month/MonthRow.tsx`、`month/MonthHeroCard.tsx`、`month/MonthColumn.tsx` — 同上（月層）。
- `src/features/day/DayColumn.tsx`、`week/WeekColumn.tsx`、`backlog/BacklogSection.tsx`、`backlog/BacklogRow.tsx` — 套 `SortableContext` / sortable 列。
- `src/features/plan-view/PlanLayout.tsx` — onDragOver 接 preview；onDragEnd 接 reorder ops。
- `src/features/today/TodayLayout.tsx` — 新增 `DndContext`（只包中欄）。

---

## Task 1: `midpoint(a, b)` lex-order 鍵

**Files:**
- Create: `src/lib/order.ts`
- Test: `src/lib/order.test.ts`

**Interfaces:**
- Produces: `midpoint(a: string | null, b: string | null): string` — 回傳嚴格介於 `a`、`b` 之間的字串（`a=null` = 開頭之前；`b=null` = 結尾之後）。要求 `a < midpoint < b`（lexicographic）。

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from "vitest";
import { midpoint } from "./order";

describe("midpoint", () => {
  it("returns a key after a when b is null", () => {
    expect(midpoint("a", null) > "a").toBe(true);
  });
  it("returns a key before b when a is null", () => {
    expect(midpoint(null, "n") < "n").toBe(true);
  });
  it("returns a key strictly between a and b", () => {
    const m = midpoint("a", "c");
    expect(m > "a" && m < "c").toBe(true);
  });
  it("subdivides repeatedly while staying ordered", () => {
    let lo = "a";
    const hi = "b";
    let prev = lo;
    for (let i = 0; i < 50; i++) {
      const m = midpoint(lo, hi);
      expect(m > prev && m < hi).toBe(true);
      prev = m;
      lo = m;
    }
  });
  it("handles adjacent keys by extending length", () => {
    const m = midpoint("ab", "ac");
    expect(m > "ab" && m < "ac").toBe(true);
  });
  it("returns a default first key when both null", () => {
    const m = midpoint(null, null);
    expect(typeof m).toBe("string");
    expect(m.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/order.test.ts`
Expected: FAIL（`midpoint` is not defined）。

- [ ] **Step 3: 實作**

```ts
// Fractional lexicographic key generator for manual ordering (`position` field).
// Keys are compared with plain string `<`. midpoint(a, b) returns a key strictly
// between a and b; null bounds mean "before everything" / "after everything".
//
// ponytail: midpoint can grow the string without bound under pathological
// repeated insertion at the same spot. Upgrade path when keys get long: rebalance
// the whole bucket (reassign evenly spaced keys in one pass). Buckets here are
// small (handful to dozens), so this is not a near-term concern.

const FIRST = "a";
const LAST = "z";

// Average of two single chars within [MIN..MAX]; returns -1 if they are adjacent.
function midChar(loCode: number, hiCode: number): number {
  if (hiCode - loCode <= 1) return -1;
  return Math.floor((loCode + hiCode) / 2);
}

const MIN = "a".charCodeAt(0); // exclusive lower sentinel
const MAX = "z".charCodeAt(0) + 1; // exclusive upper sentinel

export function midpoint(a: string | null, b: string | null): string {
  const lo = a ?? "";
  const hi = b ?? "";
  let i = 0;
  let prefix = "";
  // Walk shared prefix; at the first differing position try to fit a char between.
  for (;;) {
    const loCode = i < lo.length ? lo.charCodeAt(i) : MIN;
    const hiCode = i < hi.length ? hi.charCodeAt(i) : MAX;
    if (loCode === hiCode) {
      prefix += String.fromCharCode(loCode);
      i++;
      continue;
    }
    const mid = midChar(loCode, hiCode);
    if (mid !== -1) return prefix + String.fromCharCode(mid);
    // Adjacent here (e.g. "ab" vs "ac"): keep lo's char and recurse into the
    // next position with an open upper bound until a gap appears.
    prefix += String.fromCharCode(loCode);
    i++;
    // hi is now effectively MAX from here on (we passed its differing char).
    // Continue scanning lo against MAX.
    for (;;) {
      const lc = i < lo.length ? lo.charCodeAt(i) : MIN;
      const m2 = midChar(lc, MAX);
      if (m2 !== -1) return prefix + String.fromCharCode(m2);
      prefix += String.fromCharCode(lc);
      i++;
    }
  }
}

export { FIRST, LAST };
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/order.test.ts`
Expected: PASS（6 個）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/order.ts src/lib/order.test.ts
git commit -m "feat(order): lexicographic midpoint key generator for manual ordering"
```

---

## Task 2: `reorderPriority` op（插入＋連鎖下推＋尾端溢出）

**Files:**
- Modify: `src/store/taskOps.ts`
- Test: `src/store/taskOps.reorder.test.ts`

**Interfaces:**
- Consumes: `midpoint` from `src/lib/order.ts`；`primaryDate` / `primaryMonth` from `src/lib/tasks.ts`。
- Produces: `reorderPriority(tasks: Task[], id: string, targetRank: Priority, axis: "daily" | "monthly", scope: string): Task[]`
  - 把 `id` 設成 `targetRank`，原本 `targetRank..` 名次的 task 連鎖下推一格；若推出第 3 名，第 4 名 task 清掉 priority 並把 `position` 設成「該 scope 其他池目前最小 position 之前」（落到其他第一格）。
  - `axis` 決定動哪個 priority 欄位與用 `primaryDate`/`primaryMonth` 判定 scope 成員。
  - 只動「primary on scope」的 task；其餘不變。回傳新陣列（未變動回傳原參照）。

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from "vitest";
import { reorderPriority } from "./taskOps";
import type { Task } from "@/lib/types";

function dayTask(id: string, date: string, p?: string, pos?: string): Task {
  return {
    id,
    title: id,
    status: "open",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    custom_fields: {
      scheduled_dates: [date],
      ...(p ? { daily_priority: p as Task["custom_fields"]["daily_priority"] } : {}),
      ...(pos ? { position: pos } : {}),
    },
  };
}

const D = "2026-06-10";

describe("reorderPriority (daily)", () => {
  it("swaps order within an existing top-3", () => {
    const tasks = [dayTask("a", D, "1"), dayTask("b", D, "2"), dayTask("c", D, "3")];
    const next = reorderPriority(tasks, "c", "1", "daily", D);
    const p = (id: string) => next.find((t) => t.id === id)!.custom_fields.daily_priority;
    expect(p("c")).toBe("1");
    expect(p("a")).toBe("2");
    expect(p("b")).toBe("3");
  });

  it("inserts an other task at rank 2, pushing 2→3 and overflowing old 3 to other", () => {
    const tasks = [
      dayTask("a", D, "1"),
      dayTask("b", D, "2"),
      dayTask("c", D, "3"),
      dayTask("x", D, undefined, "m"), // an existing other-pool task
    ];
    const next = reorderPriority(tasks, "x", "2", "daily", D);
    const cf = (id: string) => next.find((t) => t.id === id)!.custom_fields;
    expect(cf("x").daily_priority).toBe("2");
    expect(cf("a").daily_priority).toBe("1");
    expect(cf("b").daily_priority).toBe("3");
    // old 3 (c) overflowed: priority cleared, position sorts before the pool min ("m")
    expect(cf("c").daily_priority).toBeUndefined();
    expect(cf("c").position! < "m").toBe(true);
  });

  it("keeps a single ① without forcing ②③", () => {
    const tasks = [dayTask("a", D, "1"), dayTask("x", D, undefined, "m")];
    const next = reorderPriority(tasks, "a", "1", "daily", D);
    expect(next.find((t) => t.id === "a")!.custom_fields.daily_priority).toBe("1");
    expect(next.find((t) => t.id === "x")!.custom_fields.daily_priority).toBeUndefined();
  });

  it("promoting into a non-full top-3 does not overflow", () => {
    const tasks = [dayTask("a", D, "1"), dayTask("x", D, undefined, "m")];
    const next = reorderPriority(tasks, "x", "2", "daily", D);
    expect(next.find((t) => t.id === "x")!.custom_fields.daily_priority).toBe("2");
    expect(next.find((t) => t.id === "a")!.custom_fields.daily_priority).toBe("1");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/store/taskOps.reorder.test.ts`
Expected: FAIL（`reorderPriority` is not defined）。

- [ ] **Step 3: 實作（append 到 `src/store/taskOps.ts`）**

在檔案頂部 import 補上 `midpoint`：

```ts
import { midpoint } from "@/lib/order";
```

新增 op（`primaryDate` / `primaryMonth` 已從 `@/lib/tasks` import）：

```ts
type Axis = "daily" | "monthly";

function priorityField(axis: Axis): "daily_priority" | "monthly_priority" {
  return axis === "daily" ? "daily_priority" : "monthly_priority";
}

function isPrimaryOnScope(t: Task, axis: Axis, scope: string): boolean {
  return axis === "daily" ? primaryDate(t) === scope : primaryMonth(t) === scope;
}

/**
 * Insert `id` at `targetRank` among the scope's top-3, cascading lower ranks
 * down by one. If that pushes a task past rank 3, it overflows: its priority is
 * cleared and it gets a `position` sorting before the scope's current "other"
 * pool (lands in the first "其他" slot). Single source of truth for both drag
 * and menu/ring rank assignment.
 */
export function reorderPriority(
  tasks: Task[],
  id: string,
  targetRank: Priority,
  axis: Axis,
  scope: string,
): Task[] {
  const field = priorityField(axis);
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;

  // Current ranked members on this scope (excluding the task being placed).
  const ranked = tasks
    .filter((t) => t.id !== id && isPrimaryOnScope(t, axis, scope) && t.custom_fields[field])
    .sort((a, b) => Number(a.custom_fields[field]) - Number(b.custom_fields[field]));

  // Build the new ordered list of ids: insert `id` at (targetRank-1).
  const order = ranked.map((t) => t.id);
  const insertAt = Math.min(Number(targetRank) - 1, order.length);
  order.splice(insertAt, 0, id);

  // First three keep ranks 1/2/3; anything past index 2 overflows.
  const newRank = new Map<string, Priority>();
  order.slice(0, 3).forEach((tid, i) => newRank.set(tid, String(i + 1) as Priority));
  const overflowId = order.length > 3 ? order[3] : null;

  // Overflow position = before the scope's current "other" pool min.
  let overflowPos: string | null = null;
  if (overflowId) {
    const poolMin = tasks
      .filter(
        (t) =>
          t.id !== overflowId &&
          isPrimaryOnScope(t, axis, scope) &&
          !t.custom_fields[field] &&
          t.custom_fields.position,
      )
      .map((t) => t.custom_fields.position!)
      .sort()[0];
    overflowPos = midpoint(null, poolMin ?? null);
  }

  return tasks.map((t) => {
    if (t.id === overflowId) {
      return patch(t, { [field]: undefined, position: overflowPos ?? undefined });
    }
    const r = newRank.get(t.id);
    if (r) return patch(t, { [field]: r });
    // A previously-ranked task that fell out of the top-3 set but is not the
    // single tracked overflow (shouldn't happen with cap 3, but stay safe):
    if (isPrimaryOnScope(t, axis, scope) && t.custom_fields[field] && !newRank.has(t.id) && t.id !== overflowId) {
      return patch(t, { [field]: undefined });
    }
    return t;
  });
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/store/taskOps.reorder.test.ts`
Expected: PASS。

- [ ] **Step 5: 型別 + commit**

```bash
npm run build
git add src/store/taskOps.ts src/store/taskOps.reorder.test.ts
git commit -m "feat(taskOps): reorderPriority with insert-cascade-overflow semantics"
```

---

## Task 3: `reorderInPool` op（活動池 position 重排）

**Files:**
- Modify: `src/store/taskOps.ts`
- Test: `src/store/taskOps.reorder.test.ts`（append）

**Interfaces:**
- Consumes: `midpoint`。
- Produces: `reorderInPool(tasks: Task[], id: string, prevId: string | null, nextId: string | null): Task[]` — 把 `id` 的 `position` 設成 `midpoint(prev.position, next.position)`；`prevId`/`nextId` 為 null 表示落到頭/尾。回傳新陣列。

- [ ] **Step 1: 寫失敗測試（append 到 reorder.test.ts）**

```ts
import { reorderInPool } from "./taskOps";

describe("reorderInPool", () => {
  it("sets position between prev and next neighbours", () => {
    const tasks = [dayTask("a", D, undefined, "a"), dayTask("b", D, undefined, "c"), dayTask("x", D, undefined, "z")];
    const next = reorderInPool(tasks, "x", "a", "b");
    const pos = next.find((t) => t.id === "x")!.custom_fields.position!;
    expect(pos > "a" && pos < "c").toBe(true);
  });
  it("moving to head uses null prev", () => {
    const tasks = [dayTask("a", D, undefined, "m"), dayTask("x", D, undefined, "z")];
    const next = reorderInPool(tasks, "x", null, "a");
    expect(next.find((t) => t.id === "x")!.custom_fields.position! < "m").toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/store/taskOps.reorder.test.ts`
Expected: FAIL（`reorderInPool` is not defined）。

- [ ] **Step 3: 實作（append 到 taskOps.ts）**

```ts
export function reorderInPool(
  tasks: Task[],
  id: string,
  prevId: string | null,
  nextId: string | null,
): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const prevPos = prevId ? (tasks.find((t) => t.id === prevId)?.custom_fields.position ?? null) : null;
  const nextPos = nextId ? (tasks.find((t) => t.id === nextId)?.custom_fields.position ?? null) : null;
  const pos = midpoint(prevPos, nextPos);
  return tasks.map((t) => (t.id === id ? patch(t, { position: pos }) : t));
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/store/taskOps.reorder.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.reorder.test.ts
git commit -m "feat(taskOps): reorderInPool writes a midpoint position"
```

---

## Task 4: pool 套 `position` 排序

**Files:**
- Modify: `src/lib/tasks.ts`
- Test: `src/lib/tasks.test.ts`（既有檔，append）
- Modify: `src/features/day/DayColumn.tsx`、`src/features/month/MonthColumn.tsx`、`src/features/backlog/BacklogSection.tsx`

**Interfaces:**
- Produces: `byPosition(a: Task, b: Task): number` — 有 `position` 的排前面、照字串比；皆無則回 0（穩定保持原序，沿用既有陣列序 fallback）。

- [ ] **Step 1: 寫失敗測試（append 到 `src/lib/tasks.test.ts`）**

```ts
import { byPosition } from "./tasks";

describe("byPosition", () => {
  const mk = (id: string, position?: string): Task => ({
    id, title: id, status: "open", created_at: "", updated_at: "",
    custom_fields: position ? { position } : {},
  });
  it("orders by position string when both present", () => {
    expect(byPosition(mk("a", "b"), mk("b", "d"))).toBeLessThan(0);
  });
  it("treats missing position as equal (stable fallback)", () => {
    expect(byPosition(mk("a"), mk("b"))).toBe(0);
  });
  it("a positioned task sorts before an unpositioned one", () => {
    expect(byPosition(mk("a", "m"), mk("b"))).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: FAIL（`byPosition` is not defined）。

- [ ] **Step 3: 實作 `byPosition`（append 到 `src/lib/tasks.ts`）**

```ts
/** Sort comparator for manually-ordered pools. Tasks with a `position` come
 * first (ascending string); tasks without keep their incoming relative order
 * (Array.prototype.sort is stable), so unset tasks fall back to store order. */
export function byPosition(a: Task, b: Task): number {
  const pa = a.custom_fields.position;
  const pb = b.custom_fields.position;
  if (pa && pb) return pa < pb ? -1 : pa > pb ? 1 : 0;
  if (pa && !pb) return -1;
  if (!pa && pb) return 1;
  return 0;
}
```

- [ ] **Step 4: 套用到 pool 衍生**

`src/features/day/DayColumn.tsx`：`otherPlanned` 與 `adhoc` 各自 append `.sort(byPosition)`（import `byPosition`）。`otherPlanned` 改：

```ts
import { tasksOnDate, byPosition } from "@/lib/tasks";
// ...
const otherPlanned = primary
  .filter((e) => !e.task.custom_fields.daily_priority && e.task.custom_fields.is_adhoc !== "true")
  .sort((a, b) => byPosition(a.task, b.task));
const adhoc = primary
  .filter((e) => !e.task.custom_fields.daily_priority && e.task.custom_fields.is_adhoc === "true")
  .sort((a, b) => byPosition(a.task, b.task));
```

`src/features/month/MonthColumn.tsx`：`others` 的 sort 改為先 `is_adhoc`（既有規則：計劃外沉底）再 `position`：

```ts
const others = undone
  .filter((e) => e.kind === "primary")
  .sort((a, b) => {
    const adhocDelta =
      Number(a.task.custom_fields.is_adhoc === "true") - Number(b.task.custom_fields.is_adhoc === "true");
    return adhocDelta !== 0 ? adhocDelta : byPosition(a.task, b.task);
  });
```

`src/features/backlog/BacklogSection.tsx`：backlog 清單渲染前 `.sort((a, b) => byPosition(a, b))`（讀該檔確認 backlog 任務變數名後套用）。

- [ ] **Step 5: 跑測試 + 型別 + commit**

Run: `npx vitest run src/lib/tasks.test.ts` → PASS；`npm run build` → 綠。

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts src/features/day/DayColumn.tsx src/features/month/MonthColumn.tsx src/features/backlog/BacklogSection.tsx
git commit -m "feat(tasks): order manual pools by position"
```

---

## Task 5: store actions `reorderPriority` / `reorderInPool`

**Files:**
- Modify: `src/store/tasks.ts`

**Interfaces:**
- Consumes: ops `reorderPriority` / `reorderInPool` from `./taskOps`。
- Produces: store actions
  - `reorderPriority(id: string, targetRank: Priority, axis: "daily" | "monthly", scope: string): Promise<void>`
  - `reorderInPool(id: string, prevId: string | null, nextId: string | null): Promise<void>`
  - 兩者樂觀更新 + 失敗回滾；`reorderPriority` 可能動多筆，patch 每筆變動的 `daily_priority`/`monthly_priority` 與 `position`，失敗走 `reload()`（沿用既有 setDailyPriority 模式）。

- [ ] **Step 1: 在 interface `TasksState` 加簽名**

```ts
reorderPriority: (id: string, targetRank: Priority, axis: "daily" | "monthly", scope: string) => Promise<void>;
reorderInPool: (id: string, prevId: string | null, nextId: string | null) => Promise<void>;
```

- [ ] **Step 2: import op**

```ts
import {
  // ...existing...
  reorderPriority as reorderPriorityOp,
  reorderInPool as reorderInPoolOp,
} from "./taskOps";
```

- [ ] **Step 3: 實作 actions（仿既有 setDailyPriority 的「diff 後 patch 變動筆 + 失敗 reload」）**

```ts
async reorderPriority(id, targetRank, axis, scope) {
  const prev = get().tasks;
  const next = reorderPriorityOp(prev, id, targetRank, axis, scope);
  if (next === prev) return;
  set({ tasks: next, error: null });
  const field = axis === "daily" ? "daily_priority" : "monthly_priority";
  const changed = next.filter((t) => {
    const before = prev.find((p) => p.id === t.id);
    if (!before) return false;
    return (
      before.custom_fields[field] !== t.custom_fields[field] ||
      before.custom_fields.position !== t.custom_fields.position
    );
  });
  try {
    await Promise.all(
      changed.map((t) =>
        enqueuePatch(t.id, {
          [field]: t.custom_fields[field] ?? null,
          ...(t.custom_fields.position !== prev.find((p) => p.id === t.id)?.custom_fields.position
            ? { position: t.custom_fields.position ?? null }
            : {}),
        }),
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

async reorderInPool(id, prevId, nextId) {
  const prev = get().tasks;
  const next = reorderInPoolOp(prev, id, prevId, nextId);
  if (next === prev) return;
  set({ tasks: next, error: null });
  const updated = next.find((t) => t.id === id)!;
  try {
    await enqueuePatch(id, { position: updated.custom_fields.position });
  } catch {
    set({ tasks: prev, error: "save_failed" });
  }
},
```

> 注意：確認 `src/lib/api/todo.ts` 的 patch body 型別與 worker PATCH 路由支援寫 `position`（custom field）。若 worker 端白名單未含 `position`，補上（仿既有 `is_adhoc` / `daily_priority` 寫入路徑）。讀 `worker/` 對應檔案確認。

- [ ] **Step 4: 型別 + commit**

Run: `npm run build` → 綠。

```bash
git add src/store/tasks.ts src/lib/api/todo.ts worker/
git commit -m "feat(store): reorderPriority/reorderInPool actions with optimistic patch"
```

---

## Task 6: ring / `⋯` menu 名次指定改走 `reorderPriority`（menu 溢出修正，可獨立 ship）

**Files:**
- Modify: `src/features/day/useTaskRow.ts`、`src/features/month/useMonthRow.ts`
- Modify: `src/features/day/Top3Card.tsx`、`src/features/day/TaskRow.tsx`（確認 ring onSelect 走 row.setPriority）
- Modify: `src/features/month/monthRowMenu.ts`（promote 名次走新路徑，見下）

**Interfaces:**
- Consumes: store `reorderPriority`、`planScheduleDay`。
- 設計：所有「指定名次 N」改呼叫 `reorderPriority(id, N, axis, scope)`；「移除重點」（null）維持既有 `setDailyPriority(id, null, scope)` / `setMonthlyPriority(id, null, scope)`。月列 menu 的「→ N日 · ①②③」= 先 `planScheduleDay(id, date)` 再 `reorderPriority(id, N, "daily", date)`。

- [ ] **Step 1: 改 `useTaskRow.ts` 的 `setPriority`**

```ts
const reorderPriority = useTasksStore((s) => s.reorderPriority);
// ...
setPriority: (n: Priority | null) =>
  n === null ? setDailyPriority(id, null, date) : reorderPriority(id, n, "daily", date),
```

- [ ] **Step 2: 改 `useMonthRow.ts`**

讀 `src/features/month/useMonthRow.ts`，把 `setPriority` 與 `promote` 改為：

```ts
const reorderPriority = useTasksStore((s) => s.reorderPriority);
// setPriority(n): n null → setMonthlyPriority(id, null, month); else reorderPriority(id, n, "monthly", month)
// promote(rank?): await planScheduleDay(id, selectedDate);
//   if (rank) await reorderPriority(id, rank, "daily", selectedDate);
```

確保 `promote` 在排到日後用 `reorderPriority`（cascade + overflow），取代既有「planScheduleDay + setDailyPriority(nextFreeDailySlot)」式擲位。

- [ ] **Step 3: 寫 e2e 驗 menu 溢出（先放這裡，Task 13 一起跑）**

在 `e2e/plan-reorder.spec.ts` 加一個 case：日欄已有 ①②③，對一個「其他計劃內」任務開 ring/menu 選「② 今日第二」→ 斷言原 ③ 任務離開三件事卡片、出現在其他第一列。（實際 selector 依 e2e fixtures，讀 `e2e/plan-interaction.spec.ts` 既有 selector 慣例。）

- [ ] **Step 4: 型別 + 單元（store 層）+ commit**

Run: `npm run build` → 綠；`npx vitest run` → 綠。

```bash
git add src/features/day/useTaskRow.ts src/features/month/useMonthRow.ts src/features/day src/features/month
git commit -m "feat(priority): route ring/menu rank assignment through reorderPriority (cascade overflow)"
```

> 此 commit 後「menu / ring 排到已滿名次會把尾端擠到其他第一格」就成立，與後續拖曳行為一致。

---

## Task 7: 加 `@dnd-kit/sortable` + `useSortableRow` + 拖曳 preview 狀態

**Files:**
- Modify: `package.json`（新增相依）
- Create: `src/features/plan-view/useSortableRow.ts`
- Create: `src/features/plan-view/useDragOrdering.tsx`

**Interfaces:**
- Produces:
  - `useSortableRow(id: string): { ref, handleProps, isDragging }` — 形狀同既有 `useDraggableRow`，但底層用 `@dnd-kit/sortable` `useSortable`，桌機限定（`useDragEnabled` gated）。可放進 `SortableContext` 內當 sortable item，亦保留對外部 droppable 的拖放能力（cross-column 不變）。
  - `useDragOrdering()` + `DragOrderingProvider` — 拖曳期間保存各容器的 live id 順序（含溢出預覽）。提供 `previewOrder(containerId: string, baseIds: string[]): string[]`（無拖曳時回傳 `baseIds`），與 `applyOver(args)` / `reset()` 給 PlanLayout 的 onDragStart/Over/End 呼叫。

- [ ] **Step 1: 安裝相依**

```bash
npm install --legacy-peer-deps @dnd-kit/sortable
```

- [ ] **Step 2: `useSortableRow.ts`**

```ts
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDragEnabled } from "./dragContext";

export function useSortableRow(id: string) {
  const enabled = useDragEnabled();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enabled,
  });
  return {
    ref: setNodeRef,
    style: enabled ? { transform: CSS.Translate.toString(transform), transition } : undefined,
    handleProps: enabled ? { ...attributes, ...listeners } : {},
    isDragging,
  };
}
```

- [ ] **Step 3: `useDragOrdering.tsx`（preview 狀態機）**

設計：拖曳開始時記錄 active id 與其來源容器；onDragOver 計算「目前指標所在容器 + index」，產出 preview 覆寫；對「top3 容器已滿 3 又有外來 item 進入」的情況，把超出第 3 名的 id 擠到該日 other 容器頭部。preview 以 `Map<containerId, string[]>` 表示，元件用 `previewOrder` 取代 base 順序渲染。

```tsx
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { arrayMove } from "@dnd-kit/sortable";

export interface DragOrdering {
  activeId: string | null;
  previewOrder: (containerId: string, baseIds: string[]) => string[];
}

const Ctx = createContext<DragOrdering>({ activeId: null, previewOrder: (_c, ids) => ids });
export function useDragOrdering() {
  return useContext(Ctx);
}

export function DragOrderingProvider({
  value,
  children,
}: {
  value: DragOrdering;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

> preview 的「擠出」計算與 PlanLayout 的 onDragOver 緊耦合，故狀態 owner 放 PlanLayout（Task 8 落實 over 邏輯）；本 hook 只定義 Context 形狀與 `arrayMove` 依賴。container id 慣例：`top3:<scope>` / `other:<scope>` / `pool:backlog` / `pool:month:<month>` / `week:<date>:top3`。

- [ ] **Step 4: 型別 + commit**

Run: `npm run build` → 綠。

```bash
git add package.json package-lock.json src/features/plan-view/useSortableRow.ts src/features/plan-view/useDragOrdering.tsx
git commit -m "feat(dnd): add @dnd-kit/sortable, useSortableRow, drag-ordering context"
```

---

## Task 8: Day 欄可拖排（三件事 + 其他）+ 溢出預覽

**Files:**
- Modify: `src/features/plan-view/PlanLayout.tsx`、`src/features/day/DayColumn.tsx`、`src/features/day/Top3Card.tsx`、`src/features/day/TaskRow.tsx`

**Interfaces:**
- Consumes: `useSortableRow`、`SortableContext`、store `reorderPriority` / `reorderInPool` / `setDailyPriority`、既有 `planScheduleDay`。
- 容器：`top3:<date>`（SortableContext，items = top3 ids）、`other:<date>`（SortableContext，items = otherPlanned ids）。`adhoc` 也各自一個 SortableContext（`adhoc:<date>`）。

- [ ] **Step 1: Day 欄列改 sortable**

`Top3Card` 的 `Top3Item`、`TaskRow`：把 `useDraggableRow(\`day:${id}\`)` 換成 `useSortableRow(\`day:${id}\`)`，套 `style`。三件事 ul 外包 `<SortableContext items={top3.map(t=>\`day:${t.id}\`)} strategy={verticalListSortingStrategy}>`；其他 section 外包 `SortableContext items={otherPlanned ids}`。

- [ ] **Step 2: PlanLayout onDragOver 溢出預覽 + onDragEnd 落實**

在 `PlanLayout` 持有 preview 狀態（`Map<string,string[]>`），實作：
- onDragStart：記 active、source container。
- onDragOver：判定 over 容器；若 over 是 `top3:<date>` 且該容器（base）已有 3 個且 active 不在其中 → preview：把 active 插入 hovered index、原第 3 名移到 `other:<date>` 頭部；否則一般 `arrayMove` preview。
- onDragEnd：依最終 over 容器與 index 呼叫：
  - 落 `top3:<date>` → `reorderPriority(activeRealId, hoveredRank, "daily", date)`。
  - 落 `other:<date>` / `adhoc:<date>` → 若 active 原有 priority，先 `setDailyPriority(id, null, date)`（降級），再 `reorderInPool(id, prevId, nextId)`；若 active 來自別欄（cross-column），先 `planScheduleDay(id, date)` 再定位。
  - 落外部既有 droppable（month / weekday，非本欄 sortable）→ 沿用 Slice 4 既有 `handleDragEnd` 分支（保持不變）。

> 實作細節（hovered index、prev/next id）用 dnd-kit `event.over` + sortable `over.data.current.sortable.index` 推導；container id 由 droppable id 命名空間解析。**此 task 需 preview_start 實機驗證手感**（溢出即時預覽、降級、跨欄仍可用）。

- [ ] **Step 3: vitest（元件層可測的部分）**

對 `DayColumn` 渲染順序加測：given tasks with positions，otherPlanned 依 position 排序渲染（驗 Task 4 整合）。拖曳互動本身交給 e2e（jsdom 測不到 dnd-kit pointer）。

- [ ] **Step 4: 型別 + 實機驗 + commit**

Run: `npm run build` → 綠。preview_start 手動確認 Day 欄三件事重排 + 第4件溢出預覽 + 其他重排。

```bash
git add src/features/plan-view/PlanLayout.tsx src/features/day
git commit -m "feat(day): sortable three-things + other with live overflow preview"
```

---

## Task 9: Month 欄可拖排（三件事 + 其他任務）

**Files:**
- Modify: `src/features/month/MonthColumn.tsx`、`src/features/month/MonthRow.tsx`、`src/features/month/MonthHeroCard.tsx`

- [ ] **Step 1:** MonthRow / MonthHeroCard 列改 `useSortableRow(\`month:${id}\`)`。
- [ ] **Step 2:** `MonthHeroCard`（三件事）包 `SortableContext items=top3 ids`、容器 id `top3:<month>`；`其他任務` section 包 `SortableContext items=others ids`、容器 id `other:<month>`。
- [ ] **Step 3:** PlanLayout onDragOver/End 對 month 容器套同 Task 8 邏輯，但 axis = `"monthly"`、scope = month；溢出落 `其他任務` 頭部。降級用 `setMonthlyPriority(id, null, month)`。
- [ ] **Step 4:** 型別 + 實機驗（月三件事重排 + 第4件溢出 + 其他任務重排）+ commit。

```bash
git add src/features/month src/features/plan-view/PlanLayout.tsx
git commit -m "feat(month): sortable monthly three-things + other tasks with overflow"
```

---

## Task 10: Week 日格只排三件事

**Files:**
- Modify: `src/features/week/WeekColumn.tsx`、`src/features/plan-view/PlanLayout.tsx`

- [ ] **Step 1:** 讀 `WeekColumn.tsx`，每格 top-3 任務列改 `useSortableRow(\`week:<date>:${id}\`)`，top-3 區包 `SortableContext items=該格 top3 ids` 容器 id `week:<date>:top3`。其他區**不包** SortableContext（維持現狀、不可拖排）。
- [ ] **Step 2:** PlanLayout：`week:<date>:top3` 容器走 axis `"daily"`、scope=date 的 reorderPriority；溢出落該 date 的 other（清 priority；position 由 reorderPriority 設「該日 other 池頭部」）。既有「週日格落點 top3/other（跨欄搬移）」邏輯保留不變。
- [ ] **Step 3:** 型別 + 實機驗（週格內三件事互換；其他區不可拖）+ commit。

```bash
git add src/features/week src/features/plan-view/PlanLayout.tsx
git commit -m "feat(week): sortable top-3 within each day cell (other zone unsorted)"
```

---

## Task 11: Backlog 池可拖排

**Files:**
- Modify: `src/features/backlog/BacklogSection.tsx`、`src/features/backlog/BacklogRow.tsx`

- [ ] **Step 1:** `BacklogRow` 列改 `useSortableRow(\`backlog:${id}\`)`。
- [ ] **Step 2:** backlog 清單包 `SortableContext items=backlog ids` 容器 id `pool:backlog`。
- [ ] **Step 3:** PlanLayout onDragEnd：落 `pool:backlog` → `reorderInPool(id, prevId, nextId)`（backlog 無 priority，純 position）。
- [ ] **Step 4:** 型別 + 實機驗（backlog 重排、reload 後保留）+ commit。

```bash
git add src/features/backlog src/features/plan-view/PlanLayout.tsx
git commit -m "feat(backlog): sortable backlog pool by position"
```

---

## Task 12: Focus 中欄可拖（只中欄）

**Files:**
- Modify: `src/features/today/TodayLayout.tsx`

- [ ] **Step 1:** 讀 `TodayLayout.tsx`，在**只包中間 DayColumn** 的範圍外掛一個 `DndContext`（sensors / collisionDetection 同 PlanLayout；`DragEnabledProvider` 沿用）。左 WeekRail、右 MonthDigest 留在 DndContext 外（或不掛 sortable）。
- [ ] **Step 2:** 中欄 DayColumn 已是 sortable（Task 8 的元件改動全域生效）；確認 Focus 的 DndContext onDragOver/End 重用 Task 8 同一套 handler（抽成共用 `usePlanDragHandlers(month, selectedDate)` 或直接複製最小必要邏輯；優先抽共用避免兩處 drift）。
- [ ] **Step 3:** 確認 Focus 左右欄不可拖（WeekRail / MonthDigest 列不掛 useSortableRow）。
- [ ] **Step 4:** 型別 + 實機驗（Focus 中欄三件事重排 + 其他/臨時加的重排；左右不可拖）+ commit。

```bash
git add src/features/today src/features/plan-view
git commit -m "feat(focus): drag reorder in the middle day column only"
```

---

## Task 13: e2e

**Files:**
- Create: `e2e/plan-reorder.spec.ts`
- Modify: 既有 e2e fixtures（如需 seed 帶 position / 多個 priority 任務）

**Interfaces:** 沿用 `e2e/plan-interaction.spec.ts` 的 BFF + mock WSPC 慣例；dnd 用 `mouse.move` 分段模擬（非 `dragTo`）。

- [ ] **Step 1:** 寫 cases（每個獨立 `test`）：
  1. Plan 日欄三件事互換（拖 ③ 到 ① 上 → 斷言 ring 數字重排）。
  2. 已滿三件事拖第 4 件（其他）進 ② → 原 ③ 出現在其他第一列。
  3. `⋯`/ring 選已滿名次 → 同上溢出（對應 Task 6）。
  4. 其他任務桶內重排 → reload 後順序保留。
  5. Week 日格三件事互換；其他區拖不動（斷言無重排）。
  6. Focus 中欄三件事重排；左右欄列無 drag handle / 拖不動。
  7. 手機視窗（`page.setViewportSize` 窄）下三件事 / 池皆不可拖。
- [ ] **Step 2:** 跑：`npm run test:e2e` → 全綠（先停掉 preview dev server，避免 port 衝突）。
- [ ] **Step 3:** Commit。

```bash
git add e2e
git commit -m "test(e2e): drag reorder, overflow, menu cascade, focus middle-only, mobile gating"
```

---

## Task 14: 手動驗收 + 產生驗收報告

**Files:**
- Create: `docs/acceptance-reports/2026-06-24-drag-reorder/`（gitignored；報告 + `assets/` 截圖）

**做法：** 全程用 `playwright-cli`（`open --persistent --profile ~/.desk-dev/pw-profile`）對真實 WSPC 驗收，截圖用 `playwright-cli screenshot --filename` 落地到報告 `assets/`。先探登入狀態，已登入直接驗；未登入請使用者協助 device flow。報告格式 / 流程見 [.claude/rules/acceptance-report.md](.claude/rules/acceptance-report.md)。

- [ ] **Step 1:** 逐項對照 spec「驗收標準」1–14 操作並截圖。
- [ ] **Step 2:** 寫報告（每條 PASS/FAIL + 截圖引用 + 一句觀察），特別記錄溢出即時預覽手感、跨 card reflow 視覺、`position` 跨 reload 保留、Focus 左右不可拖、手機完全無拖曳。
- [ ] **Step 3:** 最終門檻：`npm run build`、`npx vitest run`、`npm run test:e2e` 全綠，貼最後輸出。

---

## Self-Review（計畫 vs spec 覆蓋）

- 三件事拖曳重排 → Task 8/9/10。✅
- 滿格溢出 + 放下前預覽 → Task 2（資料）+ Task 8（preview 狀態機）。✅
- 被擠出落「其他第一格」→ Task 2（`reorderPriority` overflow position = before pool min）。✅
- 活動池手排（backlog / 其他任務 / 其他計劃內 / 臨時加的）→ Task 4（排序）+ Task 8/9/11（拖曳）。✅
- Week 日格只排三件事 → Task 10。✅
- `⋯`/ring 名次指定共用溢出 → Task 6。✅
- Focus 中欄、左右不可拖 → Task 12。✅
- 桌機限定 / 手機不掛 → `useSortableRow` 經 `useDragEnabled` gated；Task 13 case 7 驗。✅
- 衍生區不可拖 → 各欄只對 pool/三件事包 SortableContext，trail/done/scheduledThisWeek 不包。✅
- Slice 4 跨欄搬移不變 → Task 8 onDragEnd 保留既有 month/weekday 分支。✅
- 型別命名一致：`reorderPriority(id, targetRank, axis, scope)`、`reorderInPool(id, prevId, nextId)`、`byPosition`、`midpoint`、`useSortableRow` 全程一致。✅
