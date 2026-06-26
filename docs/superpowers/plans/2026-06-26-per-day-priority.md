# 每天 / 每月獨立順位（per-period priority）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 把「今日重點 / 本月三件大事」的順位從綁在 task 上的單一值，改成綁在「task + 那一天 / 那一月」的 per-period 記錄，讓每天、每月各自記得自己的順位。

**架構:** 新增兩個 string_array custom field（`daily_ranks` / `monthly_ranks`，編碼 `"期間:順位"`）。讀取走集中的 helper，並 fallback 舊單值欄位，所以既有任務免批次遷移。先把所有 UI 讀取點切到 helper（此時寫入仍走舊欄位、靠 fallback 維持畫面），再切換寫入路徑寫新欄位並清掉舊單值。

**技術:** TypeScript、React、Zustand、@dnd-kit、Vitest、Testing Library、Playwright、Cloudflare Workers（BFF）、WSPC。

## 全域限制

- 程式碼與註解一律英文；文件敘述繁體中文。
- 型別檢查只信 `npm run build`（`tsc -b && vite build`），不要用 `tsc -p ... --noEmit`。
- 測試檔需顯式 `import { describe, it, expect } from "vitest"`。
- 安裝相依套件用 `npm install --legacy-peer-deps`。
- 改到 Today / Plan 互動後，除了 `npx vitest run` 也要跑 `npm run test:e2e`。
- `Priority` 型別 = `"1" | "2" | "3"`。
- 順位編碼：日 `"YYYY-MM-DD:R"`、月 `"YYYY-MM:R"`。

## 檔案結構

- `src/lib/ranks.ts`（新）：rank 陣列的純函式編解碼 / 查詢 / 寫入。
- `src/lib/tasks.ts`（改）：`dailyRankOn` / `monthlyRankOn` 綁定語意查詢（含 fallback）。
- `src/lib/types.ts`（改）：`TaskCustomFields` 加 `daily_ranks?` / `monthly_ranks?`。
- `src/lib/api/todo.ts`（改）、`worker/routes/todo.ts`（改）：PATCH 欄位轉發。
- `src/store/taskOps.ts`、`src/store/tasks.ts`（改）：寫入 op 改 per-period。
- UI 讀取點（改）：day / week / month / plan / task-detail 各檔。
- `src/mock/data.ts`、`e2e/fixtures/wspc-fake.ts`（改）：seed。

---

### 任務 1：rank 編解碼 helper（`src/lib/ranks.ts`）

**檔案:**
- 新增: `src/lib/ranks.ts`
- 測試: `src/lib/ranks.test.ts`

**介面:**
- 產出: `parseRanks(arr?: string[]): Map<string, Priority>`、`encodeRanks(map: Map<string, Priority>): string[]`、`rankOn(arr: string[] | undefined, key: string): Priority | null`、`writeRank(arr: string[] | undefined, key: string, rank: Priority | null, legacy: { value?: Priority; key: string | null }): string[]`

- [ ] **步驟 1：寫失敗測試**

```ts
// src/lib/ranks.test.ts
import { describe, it, expect } from "vitest";
import { parseRanks, encodeRanks, rankOn, writeRank } from "./ranks";

describe("parseRanks / encodeRanks", () => {
  it("parses 'key:rank' entries and skips malformed ones", () => {
    const m = parseRanks(["2026-06-25:1", "2026-06-26:3", "bad", "2026-06-27:9"]);
    expect(m.get("2026-06-25")).toBe("1");
    expect(m.get("2026-06-26")).toBe("3");
    expect(m.has("bad")).toBe(false);
    expect(m.has("2026-06-27")).toBe(false); // rank 9 invalid
  });
  it("handles undefined as empty", () => {
    expect(parseRanks(undefined).size).toBe(0);
  });
  it("encodes back sorted by key for stable output", () => {
    const m = new Map<string, "1" | "2" | "3">([
      ["2026-06-26", "3"],
      ["2026-06-25", "1"],
    ]);
    expect(encodeRanks(m)).toEqual(["2026-06-25:1", "2026-06-26:3"]);
  });
});

describe("rankOn", () => {
  it("returns the rank for a key or null", () => {
    expect(rankOn(["2026-06:2"], "2026-06")).toBe("2");
    expect(rankOn(["2026-06:2"], "2026-07")).toBeNull();
    expect(rankOn(undefined, "2026-06")).toBeNull();
  });
});

describe("writeRank", () => {
  it("sets a rank, folding the legacy value in on first write", () => {
    const out = writeRank(undefined, "2026-06-26", "2", {
      value: "1",
      key: "2026-06-25",
    });
    expect(out).toEqual(["2026-06-25:1", "2026-06-26:2"]);
  });
  it("does not re-fold legacy once the array is non-empty", () => {
    const out = writeRank(["2026-06-25:1"], "2026-06-26", "2", {
      value: "3",
      key: "2026-06-20",
    });
    expect(out).toEqual(["2026-06-25:1", "2026-06-26:2"]);
  });
  it("clears a rank when rank is null", () => {
    expect(writeRank(["2026-06-25:1", "2026-06-26:2"], "2026-06-25", null, { key: null })).toEqual([
      "2026-06-26:2",
    ]);
  });
});
```

- [ ] **步驟 2：跑測試確認失敗**

Run: `npx vitest run src/lib/ranks.test.ts`
Expected: FAIL（找不到 `./ranks`）

- [ ] **步驟 3：寫實作**

```ts
// src/lib/ranks.ts
import type { Priority } from "./types";

function isPriority(s: string): s is Priority {
  return s === "1" || s === "2" || s === "3";
}

/** Parse ["YYYY-MM-DD:R", ...] into Map<key, Priority>; skips malformed entries. */
export function parseRanks(arr: string[] | undefined): Map<string, Priority> {
  const map = new Map<string, Priority>();
  for (const entry of arr ?? []) {
    const i = entry.lastIndexOf(":");
    if (i <= 0) continue;
    const key = entry.slice(0, i);
    const rank = entry.slice(i + 1);
    if (isPriority(rank)) map.set(key, rank);
  }
  return map;
}

/** Encode back to a key-sorted string[] for stable output. */
export function encodeRanks(map: Map<string, Priority>): string[] {
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, r]) => `${k}:${r}`);
}

/** Look up one key's rank (no fallback — see lib/tasks for the bound queries). */
export function rankOn(arr: string[] | undefined, key: string): Priority | null {
  return parseRanks(arr).get(key) ?? null;
}

/**
 * Produce the new ranks array when writing `rank` (or null to clear) for `key`.
 * On first write (array still empty) the legacy single value is folded into
 * `legacy.key` so the task's current-period rank survives the migration.
 */
export function writeRank(
  arr: string[] | undefined,
  key: string,
  rank: Priority | null,
  legacy: { value?: Priority; key: string | null },
): string[] {
  const map = parseRanks(arr);
  if (map.size === 0 && legacy.value && legacy.key) map.set(legacy.key, legacy.value);
  if (rank === null) map.delete(key);
  else map.set(key, rank);
  return encodeRanks(map);
}
```

- [ ] **步驟 4：跑測試確認通過**

Run: `npx vitest run src/lib/ranks.test.ts`
Expected: PASS

- [ ] **步驟 5：commit**

```bash
git add src/lib/ranks.ts src/lib/ranks.test.ts
git commit -m "feat(ranks): per-period rank encode/decode helpers"
```

---

### 任務 2：型別欄位 + 綁定查詢 helper（`src/lib/types.ts`、`src/lib/tasks.ts`）

**檔案:**
- 修改: `src/lib/types.ts`（`TaskCustomFields`）
- 修改: `src/lib/tasks.ts`
- 測試: `src/lib/tasks.test.ts`

**介面:**
- 消費: `rankOn`（任務 1）、`primaryDate` / `primaryMonth`（既有）
- 產出: `dailyRankOn(task: Task, date: string): Priority | null`、`monthlyRankOn(task: Task, month: string): Priority | null`

- [ ] **步驟 1：型別加欄位**

`src/lib/types.ts` 的 `TaskCustomFields` 內，`daily_priority?: Priority;` 之後加：

```ts
  daily_ranks?: string[];
  monthly_ranks?: string[];
```

- [ ] **步驟 2：寫失敗測試**

加到 `src/lib/tasks.test.ts`（import 補 `dailyRankOn, monthlyRankOn`）：

```ts
describe("dailyRankOn / monthlyRankOn", () => {
  it("reads from the per-date array first", () => {
    const t = makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-22"], daily_ranks: ["2026-05-22:2"] } });
    expect(dailyRankOn(t, "2026-05-22")).toBe("2");
    expect(dailyRankOn(t, "2026-05-21")).toBeNull();
  });
  it("falls back to legacy daily_priority only on the current primary day", () => {
    const t = makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20", "2026-05-22"], daily_priority: "1" } });
    expect(dailyRankOn(t, "2026-05-22")).toBe("1"); // primaryDate
    expect(dailyRankOn(t, "2026-05-20")).toBeNull(); // trail day — no fallback
  });
  it("does not fall back once the per-date array is non-empty", () => {
    const t = makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-22"], daily_priority: "1", daily_ranks: ["2026-05-23:2"] } });
    expect(dailyRankOn(t, "2026-05-22")).toBeNull();
  });
  it("monthlyRankOn mirrors the behaviour for months", () => {
    const t = makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "3" } });
    expect(monthlyRankOn(t, "2026-05")).toBe("3");
    const t2 = makeTask({ id: "b", custom_fields: { scheduled_months: ["2026-05"], monthly_ranks: ["2026-05:1"] } });
    expect(monthlyRankOn(t2, "2026-05")).toBe("1");
  });
});
```

- [ ] **步驟 3：跑測試確認失敗**

Run: `npx vitest run src/lib/tasks.test.ts -t "dailyRankOn"`
Expected: FAIL

- [ ] **步驟 4：寫實作**

`src/lib/tasks.ts`：import 補 `rankOn`，加：

```ts
import { rankOn } from "./ranks";

/** This task's rank on `date`: per-date array first, else the legacy single
 * value but only on its current primary day (so a moved-out trail day shows no
 * stale rank). */
export function dailyRankOn(task: Task, date: string): Priority | null {
  const direct = rankOn(task.custom_fields.daily_ranks, date);
  if (direct) return direct;
  if (!task.custom_fields.daily_ranks?.length && primaryDate(task) === date) {
    return task.custom_fields.daily_priority ?? null;
  }
  return null;
}

/** Monthly mirror of dailyRankOn. */
export function monthlyRankOn(task: Task, month: string): Priority | null {
  const direct = rankOn(task.custom_fields.monthly_ranks, month);
  if (direct) return direct;
  if (!task.custom_fields.monthly_ranks?.length && primaryMonth(task) === month) {
    return task.custom_fields.monthly_priority ?? null;
  }
  return null;
}
```

- [ ] **步驟 5：跑測試 + build 確認**

Run: `npx vitest run src/lib/tasks.test.ts && npm run build`
Expected: PASS / build 成功

- [ ] **步驟 6：commit**

```bash
git add src/lib/types.ts src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat(tasks): dailyRankOn/monthlyRankOn with legacy fallback"
```

---

### 任務 3：day 區讀取點切到 helper

此時寫入仍走舊 `daily_priority`，`dailyRankOn` 的 fallback 讓畫面維持不變；改動是把直接讀 `daily_priority` 換成 `dailyRankOn(task, date)`。

**檔案:**
- 修改: `src/features/day/DayColumn.tsx`
- 修改: `src/features/day/Top3Card.tsx`
- 修改: `src/features/day/TaskRow.tsx`
- 修改: `src/features/day/useTaskRow.ts`
- 測試: `src/features/day/DayColumn.test.tsx`、`Top3Card.test.tsx`（跑既有，確認不破）

**介面:**
- 消費: `dailyRankOn`（任務 2）

- [ ] **步驟 1：DayColumn 分區改用 helper**

`src/features/day/DayColumn.tsx`，import 補 `dailyRankOn`；三個 filter 把 `e.task.custom_fields.daily_priority` 換成 `dailyRankOn(e.task, selectedDate)`，top3 排序的兩處 `Number(a.task.custom_fields.daily_priority)` 換成 `Number(dailyRankOn(a.task, selectedDate))`（b 同理）：

```ts
const top3 = entries
  .filter((e) => dailyRankOn(e.task, selectedDate))
  .sort(
    (a, b) =>
      Number(dailyRankOn(a.task, selectedDate)) - Number(dailyRankOn(b.task, selectedDate)),
  );

const otherPlanned = entries
  .filter((e) => !dailyRankOn(e.task, selectedDate) && e.task.custom_fields.is_adhoc !== "true")
  .sort((a, b) => byPosition(a.task, b.task));

const adhoc = entries
  .filter((e) => !dailyRankOn(e.task, selectedDate) && e.task.custom_fields.is_adhoc === "true")
  .sort((a, b) => byPosition(a.task, b.task));
```

- [ ] **步驟 2：Top3Item 的順位圈改用 helper**

`src/features/day/Top3Card.tsx`：`Top3Item` 內，trail 的順位圈目前用 `previewRank`。把 trail 的 `order` 改成 `dailyRankOn(t, date)`（顯示那天的歷史順位），primary 維持 `previewRank`（拖曳即時位置）。import 補 `dailyRankOn`。在 `if (isTrail)` 分支內：

```ts
const trailRank = dailyRankOn(t, date);
// ...
{trailRank && <span className={[styles.ring, styles.ringMuted].join(" ")}>{trailRank}</span>}
```

- [ ] **步驟 3：TaskRow / useTaskRow 的順位值改用 helper**

`src/features/day/TaskRow.tsx`：`DailyPriorityMenu` 的 `value` 目前是 `task.custom_fields.daily_priority ?? null`，改成 `dailyRankOn(task, date)`（import 補）。`src/features/day/useTaskRow.ts` 不直接讀 priority 值，免改。

- [ ] **步驟 4：跑測試 + build**

Run: `npx vitest run src/features/day && npm run build`
Expected: PASS（fallback 讓既有測試行為不變）

- [ ] **步驟 5：commit**

```bash
git add src/features/day/DayColumn.tsx src/features/day/Top3Card.tsx src/features/day/TaskRow.tsx
git commit -m "refactor(day): read daily rank via dailyRankOn"
```

---

### 任務 4：week 區讀取點 + drag 容器切到 helper

**檔案:**
- 修改: `src/features/week/WeekColumn.tsx`
- 修改: `src/features/week/WeekRail.tsx`
- 修改: `src/features/plan-view/planDrag.ts`（`buildDayContainers`、`buildWeekContainers`）
- 測試: `src/features/week/WeekColumn.test.tsx`、`src/features/plan-view/planDrag.test.ts`

**介面:**
- 消費: `dailyRankOn`（任務 2）

- [ ] **步驟 1：WeekColumn top3 改用 helper**

`src/features/week/WeekColumn.tsx`（`WeekDayCell` 內），import 補 `dailyRankOn`，把 `top3` 的 filter / sort 從 `e.task.custom_fields.daily_priority` 換成 `dailyRankOn(e.task, date)`：

```ts
const top3 = primary
  .filter((e) => dailyRankOn(e.task, date))
  .sort((a, b) => Number(dailyRankOn(a.task, date)) - Number(dailyRankOn(b.task, date)))
  .slice(0, 3);
```

- [ ] **步驟 2：WeekRail 改用 helper**

`src/features/week/WeekRail.tsx`：用 Grep 找該檔所有 `daily_priority`，把「判斷是否有當日順位 / 取順位數字」改成 `dailyRankOn(task, date)`（date 為該 rail 格子的日期變數）。

- [ ] **步驟 3：planDrag 容器改用 helper**

`src/features/plan-view/planDrag.ts`，import 補 `dailyRankOn`。`buildDayContainers` 的 `top3` / `other` / `adhoc` 把 `t.custom_fields.daily_priority` 換成 `dailyRankOn(t, date)`；`buildWeekContainers` 的 `top3` 同樣換成 `dailyRankOn(t, date)`。

```ts
// buildDayContainers
const top3 = primary
  .filter((t) => dailyRankOn(t, date))
  .sort((a, b) => Number(dailyRankOn(a, date)) - Number(dailyRankOn(b, date)));
const other = primary
  .filter((t) => !dailyRankOn(t, date) && t.custom_fields.is_adhoc !== "true")
  .sort(byPosition);
const adhoc = primary
  .filter((t) => !dailyRankOn(t, date) && t.custom_fields.is_adhoc === "true")
  .sort(byPosition);
```

- [ ] **步驟 4：跑測試 + build**

Run: `npx vitest run src/features/week src/features/plan-view && npm run build`
Expected: PASS

- [ ] **步驟 5：commit**

```bash
git add src/features/week src/features/plan-view/planDrag.ts
git commit -m "refactor(week,drag): read daily rank via dailyRankOn"
```

---

### 任務 5：month 區讀取點 + drag 容器切到 helper

**檔案:**
- 修改: `src/features/month/MonthColumn.tsx`、`MonthRow.tsx`、`MonthHeroCard.tsx`、`MonthDigest.tsx`
- 修改: `src/features/plan-view/planDrag.ts`（`buildMonthContainers`）
- 測試: `src/features/month`、`src/features/plan-view/planDrag.test.ts`

**介面:**
- 消費: `monthlyRankOn`（任務 2）

- [ ] **步驟 1：用 Grep 列出 month 區所有 `monthly_priority` 讀取點**

Run: `rg -n "monthly_priority" src/features/month src/features/plan-view/planDrag.ts`

- [ ] **步驟 2：逐檔把讀取換成 `monthlyRankOn(task, month)`**

pattern：filter `e.task.custom_fields.monthly_priority` → `monthlyRankOn(e.task, month)`；排序 `Number(a.task.custom_fields.monthly_priority)` → `Number(monthlyRankOn(a.task, month))`。各檔 import 補 `monthlyRankOn`。`MonthDigest.tsx`（任務脈絡：本檔 `top3` filter 用 `e.task.custom_fields.monthly_priority`，改 `monthlyRankOn(e.task, month)`）。`buildMonthContainers` 的 `top3` 與 `rest` 判斷同樣換掉。

- [ ] **步驟 3：跑測試 + build**

Run: `npx vitest run src/features/month src/features/plan-view && npm run build`
Expected: PASS

- [ ] **步驟 4：commit**

```bash
git add src/features/month src/features/plan-view/planDrag.ts
git commit -m "refactor(month,drag): read monthly rank via monthlyRankOn"
```

---

### 任務 6：task-detail 讀取點切到 helper

**檔案:**
- 修改: `src/features/task-detail/TaskDetailModal.tsx`
- 測試: `src/features/task-detail/TaskDetailModal.test.tsx`

- [ ] **步驟 1：找出讀取點**

Run: `rg -n "daily_priority|monthly_priority" src/features/task-detail/TaskDetailModal.tsx`

- [ ] **步驟 2：換成 helper**

把顯示「今日重點 / 本月順位」的讀取改成 `dailyRankOn(task, <該 task 的 primaryDate>)` / `monthlyRankOn(task, <primaryMonth>)`（modal 顯示的是任務當前所屬期間的順位；用 `primaryDate(task)` / `primaryMonth(task)`，為 null 時視為無順位）。import 補對應 helper 與 `primaryDate` / `primaryMonth`。

- [ ] **步驟 3：跑測試 + build**

Run: `npx vitest run src/features/task-detail && npm run build`
Expected: PASS

- [ ] **步驟 4：commit**

```bash
git add src/features/task-detail/TaskDetailModal.tsx
git commit -m "refactor(task-detail): read rank via helpers"
```

---

### 任務 7：BFF / API 型別加 per-period 欄位

讀取靠 `mapTodoToTask` 的 custom_fields passthrough，已自動支援；本任務只加**寫入**轉發與型別。

**檔案:**
- 修改: `src/lib/api/todo.ts`（`TodoPatch`）
- 修改: `worker/routes/todo.ts`（`handlePatchTodo`）

- [ ] **步驟 1：`TodoPatch` 加欄位**

`src/lib/api/todo.ts` 的 `TodoPatch` interface 加：

```ts
  daily_ranks?: string[];
  monthly_ranks?: string[];
```

- [ ] **步驟 2：worker PATCH 轉發**

`worker/routes/todo.ts` 的 `handlePatchTodo`：body 兩處 inline 型別各加 `daily_ranks?: string[];` `monthly_ranks?: string[];`，並在 customFields 組裝處加：

```ts
if ("daily_ranks" in body && body.daily_ranks) customFields.daily_ranks = body.daily_ranks;
if ("monthly_ranks" in body && body.monthly_ranks) customFields.monthly_ranks = body.monthly_ranks;
```

- [ ] **步驟 3：build**

Run: `npm run build`
Expected: 成功

- [ ] **步驟 4：commit**

```bash
git add src/lib/api/todo.ts worker/routes/todo.ts
git commit -m "feat(bff): forward daily_ranks/monthly_ranks on PATCH"
```

---

### 任務 8：taskOps set / reorder 改寫 per-period（+ store 同步）

把「設順位 / 重排」改成寫 `*_ranks` 並清掉舊單值。

**檔案:**
- 修改: `src/store/taskOps.ts`（`setDailyPriority`、`setMonthlyPriority`、`reorderPriority`、`nextFreeDailySlot` 的呼叫面）
- 修改: `src/store/tasks.ts`（對應 action 的 `enqueuePatch`）
- 測試: `src/store/taskOps.test.ts`、`src/store/taskOps.reorder.test.ts`

**介面:**
- 消費: `writeRank`（任務 1）、`dailyRankOn` / `monthlyRankOn`（任務 2）
- 產出: 寫入後 task 帶 `daily_ranks` / `monthly_ranks`，且 `daily_priority` / `monthly_priority` 清為 `undefined`

- [ ] **步驟 1：改寫測試表達 per-period 行為**

`src/store/taskOps.test.ts` 的 `setDailyPriority` 區，改成斷言寫進 `daily_ranks` 並清掉 `daily_priority`。範例：

```ts
it("writes the rank into daily_ranks for that date and clears the legacy field", () => {
  const tasks = [onToday("a")]; // scheduled_dates: [today]
  const next = setDailyPriority(tasks, "a", "1", today);
  expect(next[0].custom_fields.daily_ranks).toEqual([`${today}:1`]);
  expect(next[0].custom_fields.daily_priority).toBeUndefined();
});

it("eviction only affects the same date", () => {
  const a = onToday("a", "1"); // helper seeds daily_ranks:[`${today}:1`]
  const other = makeTask({ id: "x", custom_fields: { scheduled_dates: ["2026-05-24"], daily_ranks: ["2026-05-24:1"] } });
  const next = setDailyPriority([a, other], "b" /* new */, "1", today);
  // x keeps its rank on its own day
  expect(next.find((t) => t.id === "x")!.custom_fields.daily_ranks).toEqual(["2026-05-24:1"]);
});
```

（同步調整 `onToday` / `onDay` 等 helper 改用 `daily_ranks`，並更新 `setMonthlyPriority` 與 `taskOps.reorder.test.ts` 的對應斷言。）

- [ ] **步驟 2：跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts -t "daily_ranks"`
Expected: FAIL

- [ ] **步驟 3：改 `setDailyPriority`**

`src/store/taskOps.ts`，import 補 `writeRank`、`dailyRankOn`、`monthlyRankOn`。`setDailyPriority` 改成：

```ts
export function setDailyPriority(tasks: Task[], id: string, n: Priority | null, today: string): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) => {
    if (t.id === id) {
      const ranks = writeRank(t.custom_fields.daily_ranks, today, n, {
        value: t.custom_fields.daily_priority,
        key: primaryDate(t),
      });
      return patch(t, { daily_ranks: ranks, daily_priority: undefined });
    }
    // eviction: clear the collider among THIS date's ranked tasks
    if (n !== null && dailyRankOn(t, today) === n) {
      const ranks = writeRank(t.custom_fields.daily_ranks, today, null, {
        value: t.custom_fields.daily_priority,
        key: primaryDate(t),
      });
      return patch(t, { daily_ranks: ranks, daily_priority: undefined });
    }
    return t;
  });
}
```

- [ ] **步驟 4：改 `setMonthlyPriority`（month 對稱）**

同 pattern，用 `t.custom_fields.monthly_ranks`、`monthlyRankOn`、`primaryMonth`、`monthly_ranks` / `monthly_priority`，scope 用 `month` 參數。

- [ ] **步驟 5：改 `reorderPriority`**

`reorderPriority` 內所有 `t.custom_fields[field]`（讀順位）換成「該 scope 的 rank」：daily → `dailyRankOn(t, scope)`，monthly → `monthlyRankOn(t, scope)`（用 axis 分支取一個 `rankOf(t)` 區域函式）。寫回時用 `writeRank(t.custom_fields[ranksField], scope, newRank, { value: t.custom_fields[legacyField], key: axis === "daily" ? primaryDate(t) : primaryMonth(t) })`，並同時清 `[legacyField]: undefined`。`ranksField` = `daily_ranks` / `monthly_ranks`；`legacyField` = `daily_priority` / `monthly_priority`。`nextFreeDailySlot` 內的 `t.custom_fields.daily_priority` 換成 `dailyRankOn(t, date)`。

- [ ] **步驟 6：store 同步欄位**

`src/store/tasks.ts`：`setDailyPriority` / `setMonthlyPriority` / `reorderPriority` 的 `enqueuePatch`，把送 `daily_priority` / `monthly_priority` 改成送 `daily_ranks` / `monthly_ranks`（整個陣列）＋ 對應清空舊欄位（送 `daily_priority: null`）。例：

```ts
await enqueuePatch(t.id, {
  daily_ranks: t.custom_fields.daily_ranks ?? [],
  daily_priority: null,
});
```

reorderPriority 的 `changed` 偵測改成比對 `daily_ranks` / `monthly_ranks`（與 `position`）。

- [ ] **步驟 7：跑測試 + build + e2e**

Run: `npx vitest run src/store && npm run build`
Expected: PASS（如有未更新的舊斷言一併修正）

- [ ] **步驟 8：commit**

```bash
git add src/store/taskOps.ts src/store/tasks.ts src/store/taskOps.test.ts src/store/taskOps.reorder.test.ts
git commit -m "feat(taskOps): write daily/monthly rank per-period, clear legacy"
```

---

### 任務 9：taskOps 搬移類 op 保留歷史（+ store）

讓搬移到別期間時，來源期間的 rank 條目保留（歷史），目標期間另算。

**檔案:**
- 修改: `src/store/taskOps.ts`（`moveToToday`、`demoteToMonth`、`promoteToMonth`、`planScheduleDay`、`moveToNextMonth`、`demoteToBacklog`）
- 修改: `src/store/tasks.ts`（對應 action 的 patch 欄位）
- 測試: `src/store/taskOps.test.ts`

- [ ] **步驟 1：改寫測試**

`moveToToday`：來源日 rank 保留、今天得到新 slot；`demoteToMonth`：該日 rank 條目保留、且不再寫 `daily_priority`。範例：

```ts
it("moveToToday keeps the source day's rank and assigns today a free slot", () => {
  const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"], daily_ranks: ["2026-05-20:2"] } })];
  const next = moveToToday(tasks, "a", today); // today = 2026-05-22
  const cf = next[0].custom_fields;
  expect(cf.daily_ranks).toContain("2026-05-20:2"); // source day preserved
  expect(cf.daily_ranks!.some((e) => e.startsWith(`${today}:`))).toBe(true); // today set
});

it("demoteToMonth dismisses the day but keeps that day's rank entry", () => {
  const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-05"], scheduled_dates: ["2026-05-21"], daily_ranks: ["2026-05-21:1"] } })];
  const next = demoteToMonth(tasks, "a", "2026-05");
  expect(next[0].custom_fields.daily_ranks).toContain("2026-05-21:1");
  expect(next[0].custom_fields.unscheduled_at).toBe("2026-05-21");
  expect(primaryDate(next[0])).toBeNull();
});
```

- [ ] **步驟 2：跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts -t "moveToToday keeps"`
Expected: FAIL

- [ ] **步驟 3：改 `moveToToday`**

把「保留/重指派 `daily_priority`」邏輯改成操作 `daily_ranks`：來源日條目不動；在 `today` 用 `nextFreeDailySlot(tasks, today, id)` 取 slot（滿則不設），透過 `writeRank` 寫入 today；清 `daily_priority`。free-slot 判斷需先把本任務 fold-in 後再算，或沿用既有「滿則 undefined」語意。

- [ ] **步驟 4：改 `demoteToMonth`**

移除「保留單值 `daily_priority`」的 hack：不再 set/keep `daily_priority`；`daily_ranks` 維持原樣（該日條目自然保留）。其餘（`unscheduled_at`、`scheduled_months`）不變。

- [ ] **步驟 5：改其餘搬移 op**

`promoteToMonth` / `planScheduleDay` / `moveToNextMonth` / `demoteToBacklog`：凡原本清 `daily_priority` / `monthly_priority` 的，改成「不動 `*_ranks`（保留歷史）」；換到新期間時新期間自然無 rank。`moveToNextMonth` 清掉的 `monthly_priority` 改為不動 `monthly_ranks`。

- [ ] **步驟 6：store 同步**

`src/store/tasks.ts`：`moveToToday` / `demoteToMonth` / `moveToNextMonth` / `demoteToBacklog` / `promoteToMonth` / `planScheduleDay` 的 `enqueuePatch`，把原本送 `daily_priority` / `monthly_priority` 的改成送 `daily_ranks` / `monthly_ranks`（更動時）＋清舊欄位（`daily_priority: null`）。

- [ ] **步驟 7：跑測試 + build + e2e**

Run: `npx vitest run src/store && npm run build && npm run test:e2e`
Expected: PASS（e2e 若有順位相關斷言一併更新）

- [ ] **步驟 8：commit**

```bash
git add src/store/taskOps.ts src/store/tasks.ts src/store/taskOps.test.ts
git commit -m "feat(taskOps): preserve source-period rank on moves"
```

---

### 任務 10：mock / e2e seed、WSPC schema 變更、手動驗收

**檔案:**
- 修改: `src/mock/data.ts`、`e2e/fixtures/wspc-fake.ts`
- 修改: 既有 e2e 斷言（若依賴順位顯示）
- 產出: 驗收報告（gitignored）

- [ ] **步驟 1：mock / fake seed 補欄位**

`src/mock/data.ts` 至少一筆任務帶 `daily_ranks`（示範跨天不同順位）；`e2e/fixtures/wspc-fake.ts` 的 seed 與 create / patch 流程支援 `daily_ranks` / `monthly_ranks`（fake WSPC 不檢查 schema，passthrough 即可）。

- [ ] **步驟 2：跑全測試**

Run: `npx vitest run && npm run build && npm run test:e2e`
Expected: 全綠

- [ ] **步驟 3：WSPC schema 變更（需先向使用者確認再執行）**

向使用者確認後，對正式 DeskTask type 執行 `todo_type_update`（id `typ_01KT1KDRV40GPSMS3P1MYP0B9G`），custom_fields 保留現有 9 欄並**新增**：

```
{ "key": "daily_ranks", "type": "string_array" }
{ "key": "monthly_ranks", "type": "string_array" }
```

（additive；舊 `daily_priority` / `monthly_priority` 不動。）

- [ ] **步驟 4：手動驗收（preview + AI agent）+ 驗收報告**

依 `.claude/rules/acceptance-report.md` 用 playwright-cli（共用 profile）驗收，報告寫到 gitignored 的 `docs/acceptance-reports/2026-06-26-per-day-priority/`。逐項對照 spec 驗收標準：
1. A 日設第 1 → 移到 B 日設第 3 → A 日仍顯示第 1（trail）、B 日第 3。
2. A 日 Top3 任務丟回月度 → 留在 A 日 Top3、灰、顯示當時順位 +「↩ 已退回本月」。
3. 月度：6 月設第 1、延到 7 月設第 2 → 兩月各自記得。
4. 既有任務（只有舊單值）未操作時在當前期間仍顯示原順位。

- [ ] **步驟 5：commit**

```bash
git add src/mock/data.ts e2e/fixtures/wspc-fake.ts e2e
git commit -m "test(per-day-priority): seed ranks + e2e for per-period priority"
```

---

## Self-Review 紀錄

- **spec 覆蓋:** 資料模型（任務 1、2、7）、lazy fallback（任務 2、8）、per-period 寫入 / 驅逐 / free-slot（任務 8）、搬移歷史保留（任務 9）、UI 全讀取點（任務 3–6）、schema 變更 + 驗收（任務 10）皆有對應 task。
- **型別一致:** `dailyRankOn` / `monthlyRankOn`（lib/tasks）、`writeRank` / `rankOn` / `parseRanks` / `encodeRanks`（lib/ranks）跨 task 命名一致。
- **無 placeholder:** 各 task 的關鍵邏輯有完整 code；UI 機械替換給精確 before/after 與 Grep 指令。
