# 共享「新增任務模式」chip 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在日視圖、月視圖的新增任務列加一個共享的「計畫中 / 臨時」切換 chip(存 localStorage、跨輸入列即時同步),並把三個近乎重複的新增輸入抽成單一 `AddTaskBar` 元件。

**Architecture:** 新增 `src/lib/entryMode.ts`,用 module-level state + `useSyncExternalStore` 提供跨元件共享、可即時連動的全域模式;新增 `EntryModeChip` 與共用 `AddTaskBar`(取代三個 `Add*Input`);把 `is_adhoc` 由「呼叫端傳入」一路接到 `taskOps` 與 store,移除寫死值。Backlog 不帶 chip、行為不變。

**Tech Stack:** React 19 + TypeScript、Zustand、CSS Modules、Vitest + Testing Library、Playwright(e2e)。型別檢查一律 `npm run build`。

---

## 檔案結構

**新增:**
- `src/lib/entryMode.ts` — 全域 `entryMode` state、`useEntryMode` hook、`getEntryMode` / `setEntryMode` / `isAdhocOf`。
- `src/lib/entryMode.test.ts` — 上述單元測試。
- `src/ui/AddTaskBar/AddTaskBar.tsx` — 共用新增輸入列。
- `src/ui/AddTaskBar/AddTaskBar.module.css` — 由三個相同的 `Add*Input.module.css` 合併而來。
- `src/ui/AddTaskBar/AddTaskBar.test.tsx` — 共用元件測試。
- `src/ui/AddTaskBar/EntryModeChip.tsx` — 模式切換 chip。
- `src/ui/AddTaskBar/EntryModeChip.module.css` — chip 樣式(沿用 design token)。
- `src/ui/AddTaskBar/EntryModeChip.test.tsx` — chip 測試。
- `src/ui/AddTaskBar/index.ts` — barrel export。

**修改:**
- `src/store/taskOps.ts` — `addTodayTask` / `addMonthTask` 接收 `isAdhoc`。
- `src/store/taskOps.test.ts` — 對應更新呼叫。
- `src/store/tasks.ts` — store 的 `addTodayTask` / `addMonthTask` 接收 `isAdhoc`,移除寫死的 `is_adhoc`。
- `src/store/tasks.test.ts` — 對應更新呼叫與斷言。
- `src/features/day/DayColumn.tsx` — 改用 `AddTaskBar`。
- `src/features/month/MonthColumn.tsx` — 改用 `AddTaskBar`。
- `src/features/backlog/BacklogSection.tsx` — 改用 `AddTaskBar`(不帶 chip)。

**刪除(被 `AddTaskBar` 取代):**
- `src/features/day/AddTaskInput.tsx`、`AddTaskInput.module.css`、`AddTaskInput.test.tsx`
- `src/features/month/AddMonthTaskInput.tsx`、`AddMonthTaskInput.module.css`、`AddMonthTaskInput.test.tsx`
- `src/features/backlog/AddBacklogTaskInput.tsx`、`AddBacklogTaskInput.module.css`、`AddBacklogTaskInput.test.tsx`

**設計備註:配色沿用既有 design token。** spec 的 mockup 用青/琥珀只是概念示意;實作對齊 app 既有語彙——`計畫中` 用 accent token(`--color-accent-soft` / `--color-accent-text`)、`臨時` 用 flag token(`--color-flag-soft` / `--color-flag`,即現有「計劃外」用色)。

---

## Task 1:`entryMode` 全域共享 state

**Files:**
- Create: `src/lib/entryMode.ts`
- Test: `src/lib/entryMode.test.ts`

- [ ] **Step 1:寫失敗測試**

`src/lib/entryMode.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  getEntryMode,
  setEntryMode,
  isAdhocOf,
  STORAGE_KEY,
  __subscribe as subscribeForTest,
} from "./entryMode";

beforeEach(() => {
  localStorage.clear();
  setEntryMode("planned"); // reset module-level state between tests
});

describe("entryMode", () => {
  it("defaults to planned", () => {
    expect(getEntryMode()).toBe("planned");
  });

  it("setEntryMode updates the value and persists to localStorage", () => {
    setEntryMode("adhoc");
    expect(getEntryMode()).toBe("adhoc");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("adhoc");
  });

  it("isAdhocOf maps modes to a boolean", () => {
    expect(isAdhocOf("adhoc")).toBe(true);
    expect(isAdhocOf("planned")).toBe(false);
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsub = subscribeForTest(() => {
      calls += 1;
    });
    setEntryMode("adhoc");
    expect(calls).toBe(1);
    unsub();
  });
});
```

- [ ] **Step 2:跑測試確認失敗**

Run: `npx vitest run src/lib/entryMode.test.ts`
Expected: FAIL（`./entryMode` 模組不存在 / 匯出不存在）

- [ ] **Step 3:實作 `src/lib/entryMode.ts`**

```typescript
import { useSyncExternalStore } from "react";

export type EntryMode = "planned" | "adhoc";

export const STORAGE_KEY = "desk.entryMode";

function readInitial(): EntryMode {
  if (typeof localStorage === "undefined") return "planned";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "adhoc" || v === "planned" ? v : "planned";
}

let current: EntryMode = readInitial();
const listeners = new Set<() => void>();

export function getEntryMode(): EntryMode {
  return current;
}

export function setEntryMode(mode: EntryMode): void {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable (private mode / SSR) — keep in-memory only.
  }
  listeners.forEach((l) => l());
}

export function isAdhocOf(mode: EntryMode): boolean {
  return mode === "adhoc";
}

// Exported for tests; not part of the component-facing API.
export function __subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useEntryMode(): [EntryMode, (mode: EntryMode) => void] {
  const mode = useSyncExternalStore(__subscribe, getEntryMode, getEntryMode);
  return [mode, setEntryMode];
}
```

- [ ] **Step 4:跑測試確認通過**

Run: `npx vitest run src/lib/entryMode.test.ts`
Expected: PASS（4 個 it 全綠）

- [ ] **Step 5:commit**

```bash
git add src/lib/entryMode.ts src/lib/entryMode.test.ts
git commit -m "feat(entryMode): shared planned/adhoc state with localStorage"
```

---

## Task 2:`EntryModeChip` 元件

**Files:**
- Create: `src/ui/AddTaskBar/EntryModeChip.tsx`
- Create: `src/ui/AddTaskBar/EntryModeChip.module.css`
- Test: `src/ui/AddTaskBar/EntryModeChip.test.tsx`

- [ ] **Step 1:寫失敗測試**

`src/ui/AddTaskBar/EntryModeChip.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryModeChip } from "./EntryModeChip";
import { setEntryMode } from "@/lib/entryMode";

beforeEach(() => {
  localStorage.clear();
  setEntryMode("planned");
});

describe("EntryModeChip", () => {
  it("shows planned label by default", () => {
    render(<EntryModeChip />);
    expect(screen.getByRole("button")).toHaveTextContent("計畫中");
  });

  it("toggles to adhoc on click", async () => {
    const user = userEvent.setup();
    render(<EntryModeChip />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("臨時");
  });

  it("keeps sibling chips in sync via shared state", async () => {
    const user = userEvent.setup();
    render(
      <>
        <EntryModeChip />
        <EntryModeChip />
      </>,
    );
    const chips = screen.getAllByRole("button");
    await user.click(chips[0]);
    expect(chips[0]).toHaveTextContent("臨時");
    expect(chips[1]).toHaveTextContent("臨時");
  });
});
```

- [ ] **Step 2:跑測試確認失敗**

Run: `npx vitest run src/ui/AddTaskBar/EntryModeChip.test.tsx`
Expected: FAIL（`./EntryModeChip` 不存在）

- [ ] **Step 3:實作 `EntryModeChip.tsx`**

```tsx
import { useEntryMode } from "@/lib/entryMode";
import styles from "./EntryModeChip.module.css";

export function EntryModeChip() {
  const [mode, setMode] = useEntryMode();
  const isAdhoc = mode === "adhoc";
  return (
    <button
      type="button"
      className={[styles.chip, isAdhoc ? styles.adhoc : styles.planned].join(" ")}
      aria-pressed={isAdhoc}
      aria-label={
        isAdhoc ? "新增模式:臨時,點擊切換為計畫中" : "新增模式:計畫中,點擊切換為臨時"
      }
      onClick={() => setMode(isAdhoc ? "planned" : "adhoc")}
    >
      {isAdhoc ? "⚡ 臨時" : "📅 計畫中"}
    </button>
  );
}
```

- [ ] **Step 4:實作 `EntryModeChip.module.css`**

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex: none;
  min-height: 32px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
}
.planned {
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
}
.adhoc {
  background: var(--color-flag-soft);
  color: var(--color-flag);
}
```

- [ ] **Step 5:跑測試確認通過**

Run: `npx vitest run src/ui/AddTaskBar/EntryModeChip.test.tsx`
Expected: PASS（3 個 it 全綠）

- [ ] **Step 6:commit**

```bash
git add src/ui/AddTaskBar/EntryModeChip.tsx src/ui/AddTaskBar/EntryModeChip.module.css src/ui/AddTaskBar/EntryModeChip.test.tsx
git commit -m "feat(EntryModeChip): clickable planned/adhoc toggle chip"
```

---

## Task 3:共用 `AddTaskBar` 元件

**Files:**
- Create: `src/ui/AddTaskBar/AddTaskBar.tsx`
- Create: `src/ui/AddTaskBar/AddTaskBar.module.css`
- Create: `src/ui/AddTaskBar/index.ts`
- Test: `src/ui/AddTaskBar/AddTaskBar.test.tsx`

`AddTaskBar.module.css` 內容:三個 `Add*Input.module.css` 已確認位元組相同,直接沿用其內容:

```css
.bar {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  margin-top: 8px;
  border: 1.5px solid var(--color-rule);
  border-radius: 7px;
  background: var(--color-paper-alt);
}
.bar:focus-within {
  border-color: var(--color-flag, #c1432e);
}
.box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--color-rule);
  border-radius: 4px;
  flex: none;
}
.input {
  flex: 1;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  outline: none;
}
```

- [ ] **Step 1:寫失敗測試**

`src/ui/AddTaskBar/AddTaskBar.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddTaskBar } from "./AddTaskBar";
import { setEntryMode } from "@/lib/entryMode";

beforeEach(() => {
  localStorage.clear();
  setEntryMode("planned");
});

describe("AddTaskBar", () => {
  it("submits the title with the current mode and clears the field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    const input = screen.getByLabelText("新增");
    await user.type(input, "買菜{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("買菜", "planned");
    expect(input).toHaveValue("");
  });

  it("passes adhoc once the chip is toggled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button")); // toggle chip → adhoc
    await user.type(screen.getByLabelText("新增"), "臨時事{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("臨時事", "adhoc");
  });

  it("does not submit a blank title", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("新增"), "   {Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ignores Enter while composing (IME)", () => {
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    const input = screen.getByLabelText("新增");
    fireEvent.change(input, { target: { value: "注音" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the chip and omits mode when withMode is false", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" onSubmit={onSubmit} />);
    expect(screen.queryByRole("button")).toBeNull();
    await user.type(screen.getByLabelText("新增"), "backlog 事{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("backlog 事", undefined);
  });
});
```

- [ ] **Step 2:跑測試確認失敗**

Run: `npx vitest run src/ui/AddTaskBar/AddTaskBar.test.tsx`
Expected: FAIL（`./AddTaskBar` 不存在）

- [ ] **Step 3:實作 `AddTaskBar.tsx`**

```tsx
import { useState } from "react";
import { useEntryMode, type EntryMode } from "@/lib/entryMode";
import { EntryModeChip } from "./EntryModeChip";
import styles from "./AddTaskBar.module.css";

export interface AddTaskBarProps {
  placeholder: string;
  ariaLabel: string;
  withMode?: boolean;
  onSubmit: (title: string, mode?: EntryMode) => void;
}

export function AddTaskBar({ placeholder, ariaLabel, withMode = false, onSubmit }: AddTaskBarProps) {
  const [value, setValue] = useState("");
  const [mode] = useEntryMode();

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    onSubmit(value, withMode ? mode : undefined);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
      {withMode && <EntryModeChip />}
    </div>
  );
}
```

- [ ] **Step 4:實作 `index.ts`**

```typescript
export { AddTaskBar } from "./AddTaskBar";
export type { AddTaskBarProps } from "./AddTaskBar";
```

- [ ] **Step 5:跑測試確認通過**

Run: `npx vitest run src/ui/AddTaskBar/AddTaskBar.test.tsx`
Expected: PASS（5 個 it 全綠）

- [ ] **Step 6:commit**

```bash
git add src/ui/AddTaskBar/AddTaskBar.tsx src/ui/AddTaskBar/AddTaskBar.module.css src/ui/AddTaskBar/index.ts src/ui/AddTaskBar/AddTaskBar.test.tsx
git commit -m "feat(AddTaskBar): shared add-task input with optional mode chip"
```

---

## Task 4:把 `is_adhoc` 接進 `taskOps` 與 store

這一步讓 optimistic 本地 task 與送後端的 `is_adhoc` 都依呼叫端決定。為了讓每一步都能編譯通過(此時舊的 `Add*Input` 仍存在、仍以 2 個參數呼叫 store),新參數**先給預設值**保留現行行為;Task 5 改完所有呼叫端後再移除預設值。

**Files:**
- Modify: `src/store/taskOps.ts`
- Modify: `src/store/taskOps.test.ts`
- Modify: `src/store/tasks.ts`
- Modify: `src/store/tasks.test.ts`

- [ ] **Step 1:更新 `taskOps.ts` 的 `addTodayTask` / `addMonthTask`**

`src/store/taskOps.ts`,把這兩個函式改成接收 `isAdhoc`(附預設值):

```typescript
export function addTodayTask(
  tasks: Task[],
  title: string,
  today: string,
  id: string,
  now: string,
  isAdhoc = true,
): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_dates: [today], is_adhoc: isAdhoc ? "true" : "false" },
  };
  return [...tasks, task];
}

export function addMonthTask(
  tasks: Task[],
  title: string,
  month: string,
  id: string,
  now: string,
  isAdhoc = false,
): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_months: [month], is_adhoc: isAdhoc ? "true" : "false" },
  };
  return [...tasks, task];
}
```

- [ ] **Step 2:在 `taskOps.test.ts` 加 is_adhoc 斷言**

`src/store/taskOps.test.ts` 的 `addTodayTask` describe 區塊內,新增一個 it(放在現有測試之後):

```typescript
  it("respects the isAdhoc flag", () => {
    const planned = addTodayTask([], "計畫的事", "2026-05-22", "p", NOW, false);
    expect(planned[0].custom_fields.is_adhoc).toBe("false");
    const adhoc = addTodayTask([], "臨時的事", "2026-05-22", "a", NOW, true);
    expect(adhoc[0].custom_fields.is_adhoc).toBe("true");
  });
```

`addMonthTask` describe 區塊內,新增:

```typescript
  it("respects the isAdhoc flag", () => {
    const adhoc = addMonthTask([], "月中臨時", "2026-05", "a", NOW, true);
    expect(adhoc[0].custom_fields.is_adhoc).toBe("true");
  });
```

- [ ] **Step 3:更新 store 的 `addTodayTask` / `addMonthTask`**

`src/store/tasks.ts`:

介面(`interface TasksState`)兩行改成:

```typescript
  addTodayTask: (title: string, date: string, isAdhoc?: boolean) => Promise<void>;
  addMonthTask: (title: string, month: string, isAdhoc?: boolean) => Promise<void>;
```

`addTodayTask` 實作:

```typescript
  async addTodayTask(title, date, isAdhoc = true) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addTodayTask(prev, trimmed, date, tempId, now(), isAdhoc), error: null });
    try {
      const created = await postTodo({
        title: trimmed,
        scheduled_dates: [date],
        is_adhoc: isAdhoc ? "true" : "false",
      });
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },
```

`addMonthTask` 實作:

```typescript
  async addMonthTask(title, month, isAdhoc = false) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addMonthTaskOp(prev, trimmed, month, tempId, now(), isAdhoc), error: null });
    try {
      const created = await postTodo({
        title: trimmed,
        scheduled_months: [month],
        is_adhoc: isAdhoc ? "true" : "false",
      });
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },
```

- [ ] **Step 4:在 `tasks.test.ts` 加 is_adhoc 斷言**

`src/store/tasks.test.ts`,在現有 `addMonthTask adds a month-scoped task` 測試之後新增:

```typescript
  it("addMonthTask marks the task adhoc when requested", async () => {
    useTasksStore.setState({ tasks: [], status: "ready", error: null });
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-ma",
      title: "月中臨時",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "true" },
    });
    await useTasksStore.getState().addMonthTask("月中臨時", "2026-05", true);
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-ma");
    expect(added?.custom_fields.is_adhoc).toBe("true");
  });

  it("addTodayTask marks the task planned when requested", async () => {
    useTasksStore.setState({ tasks: [], status: "ready", error: null, today: MOCK_TODAY });
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-tp",
      title: "計畫的事",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: [MOCK_TODAY], is_adhoc: "false" },
    });
    await useTasksStore.getState().addTodayTask("計畫的事", MOCK_TODAY, false);
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-tp");
    expect(added?.custom_fields.is_adhoc).toBe("false");
  });
```

- [ ] **Step 5:跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts src/store/tasks.test.ts`
Expected: PASS（含新增的 is_adhoc 斷言)

- [ ] **Step 6:型別檢查**

Run: `npm run build`
Expected: 成功(舊的 `Add*Input` 仍以 2 參數呼叫,靠預設值通過)

- [ ] **Step 7:commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(tasks): thread is_adhoc through addToday/addMonth task ops"
```

---

## Task 5:接上呼叫端、刪除舊元件

把三個使用點改用 `AddTaskBar`,刪掉舊的 `Add*Input`(含 css 與測試),並移除 Task 4 加的參數預設值(此時所有呼叫端都已顯式傳值)。

**Files:**
- Modify: `src/features/day/DayColumn.tsx`
- Modify: `src/features/month/MonthColumn.tsx`
- Modify: `src/features/backlog/BacklogSection.tsx`
- Modify: `src/store/taskOps.ts`(移除預設值)
- Modify: `src/store/tasks.ts`(移除預設值)
- Delete: `src/features/day/AddTaskInput.tsx`、`AddTaskInput.module.css`、`AddTaskInput.test.tsx`
- Delete: `src/features/month/AddMonthTaskInput.tsx`、`AddMonthTaskInput.module.css`、`AddMonthTaskInput.test.tsx`
- Delete: `src/features/backlog/AddBacklogTaskInput.tsx`、`AddBacklogTaskInput.module.css`、`AddBacklogTaskInput.test.tsx`

- [ ] **Step 1:改 `DayColumn.tsx`**

把第 9 行的 import:

```tsx
import { AddTaskInput } from "./AddTaskInput";
```

改成:

```tsx
import { AddTaskBar } from "@/ui/AddTaskBar";
import { isAdhocOf } from "@/lib/entryMode";
```

第 5 行附近已有 `import { useTasksStore } from "@/store/tasks";`。在元件本體取得 action(放在 `storeToday` 那行附近):

```tsx
  const addTodayTask = useTasksStore((s) => s.addTodayTask);
```

把第 157 行 `{isInteractive && <AddTaskInput date={selectedDate} />}` 改成:

```tsx
      {isInteractive && (
        <AddTaskBar
          placeholder="+ 加一件這天的事…"
          ariaLabel="新增這天的事"
          withMode
          onSubmit={(title, mode) => addTodayTask(title, selectedDate, isAdhocOf(mode ?? "planned"))}
        />
      )}
```

- [ ] **Step 2:改 `MonthColumn.tsx`**

把 `import { AddMonthTaskInput } from "./AddMonthTaskInput";` 改成:

```tsx
import { AddTaskBar } from "@/ui/AddTaskBar";
import { isAdhocOf } from "@/lib/entryMode";
```

取得 action(在元件本體現有 `useTasksStore` 取用處附近):

```tsx
  const addMonthTask = useTasksStore((s) => s.addMonthTask);
```

把第 123 行 `<AddMonthTaskInput month={month} />` 改成:

```tsx
      <AddTaskBar
        placeholder="+ 加一件這個月要做的事…"
        ariaLabel="新增本月任務"
        withMode
        onSubmit={(title, mode) => addMonthTask(title, month, isAdhocOf(mode ?? "planned"))}
      />
```

> 註:若 `MonthColumn` 尚未引入 `useTasksStore`,於檔頭加 `import { useTasksStore } from "@/store/tasks";`。

- [ ] **Step 3:改 `BacklogSection.tsx`**

把第 5 行 `import { AddBacklogTaskInput } from "./AddBacklogTaskInput";` 改成:

```tsx
import { AddTaskBar } from "@/ui/AddTaskBar";
import { useTasksStore } from "@/store/tasks";
```

在元件本體取得 action:

```tsx
  const addBacklogTask = useTasksStore((s) => s.addBacklogTask);
```

把第 37 行 `<AddBacklogTaskInput />` 改成(不帶 `withMode`):

```tsx
          <AddTaskBar
            placeholder="+ 加一件想做但還沒排的事…"
            ariaLabel="新增 backlog 任務"
            onSubmit={(title) => addBacklogTask(title)}
          />
```

> 註:若 `BacklogSection` 已 import `useTasksStore` 則不重複加。

- [ ] **Step 4:刪除舊元件、css 與測試**

```bash
git rm src/features/day/AddTaskInput.tsx src/features/day/AddTaskInput.module.css src/features/day/AddTaskInput.test.tsx
git rm src/features/month/AddMonthTaskInput.tsx src/features/month/AddMonthTaskInput.module.css src/features/month/AddMonthTaskInput.test.tsx
git rm src/features/backlog/AddBacklogTaskInput.tsx src/features/backlog/AddBacklogTaskInput.module.css src/features/backlog/AddBacklogTaskInput.test.tsx
```

- [ ] **Step 5:移除 Task 4 的參數預設值**

`src/store/taskOps.ts`:`isAdhoc = true` → `isAdhoc: boolean`;`isAdhoc = false` → `isAdhoc: boolean`(兩個函式)。

`src/store/tasks.ts`:`async addTodayTask(title, date, isAdhoc = true)` → `async addTodayTask(title, date, isAdhoc)`;`async addMonthTask(title, month, isAdhoc = false)` → `async addMonthTask(title, month, isAdhoc)`。介面的 `isAdhoc?: boolean` 改為 `isAdhoc: boolean`(移除 `?`)。

> 注意:`taskOps.test.ts` 仍有不傳 `isAdhoc` 的舊呼叫(例如 `addTodayTask([], "回電話", "2026-05-22", "new-id", NOW)`)。移除預設值後這些會型別錯,需補上布林參數:今天類補 `true`、月類補 `false`,以維持原斷言語意。逐一檢查 `src/store/taskOps.test.ts` 與 `src/store/tasks.test.ts` 中對這兩個函式的呼叫並補齊。

- [ ] **Step 6:跑全部單元測試 + 型別檢查**

Run: `npx vitest run`
Expected: PASS(無殘留對已刪除元件的 import)

Run: `npm run build`
Expected: 成功(無未補 `isAdhoc` 的呼叫)

- [ ] **Step 7:commit**

```bash
git add -A
git commit -m "refactor(add-task): replace three inputs with shared AddTaskBar + chip"
```

---

## Task 6:e2e —— chip 行為與分區

預設模式為「計畫中」會改變舊行為:在日視圖直接打字新增,任務落「其他計劃內」而非「臨時加的」。本 task 新增涵蓋 chip 的 e2e,並確認既有 e2e 仍綠。

**Files:**
- Modify: `e2e/today-interaction.spec.ts`

- [ ] **Step 1:新增 chip 行為測試**

在 `e2e/today-interaction.spec.ts` 末端新增(沿用現有 `getByPlaceholder` 與 section 文案):

```typescript
test("adds a planned task by default, and an adhoc one after toggling the chip", async ({
  page,
}) => {
  const input = page.getByPlaceholder("+ 加一件這天的事…");

  // Default mode is planned → lands in 其他計劃內.
  await input.fill("計畫內的事");
  await input.press("Enter");
  const plannedSection = page
    .getByText("其他計劃內")
    .locator("xpath=ancestor::section[1]");
  await expect(plannedSection.getByText("計畫內的事")).toBeVisible();

  // Toggle the chip to 臨時, then add → lands in 今天臨時加的.
  await page.getByRole("button", { name: /新增模式/ }).click();
  await input.fill("臨時的事");
  await input.press("Enter");
  const adhocSection = page
    .getByText("今天臨時加的")
    .locator("xpath=ancestor::section[1]");
  await expect(adhocSection.getByText("臨時的事")).toBeVisible();
});

test("the mode chip persists across reload", async ({ page }) => {
  await page.getByRole("button", { name: /新增模式/ }).click();
  await expect(page.getByRole("button", { name: /新增模式:臨時/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /新增模式:臨時/ })).toBeVisible();
});
```

- [ ] **Step 2:停掉可能佔用 port 的 preview dev server,再跑 e2e**

> e2e 與 preview 會搶同一個 port,先確認沒有 preview dev server 在跑(見專案 CLAUDE.md / memory)。

Run: `npm run test:e2e`
Expected: PASS(新測試綠;既有 `adds a task and persists it across reload` 等仍綠)

- [ ] **Step 3:commit**

```bash
git add e2e/today-interaction.spec.ts
git commit -m "test(e2e): entry-mode chip controls planned/adhoc placement"
```

---

## Task 7:手動驗收 + 產生驗收報告

依專案慣例,最後一個 task 全程用 `playwright-cli` 對真實 WSPC 驗收,把報告寫到 gitignored 的 `docs/acceptance-reports/2026-06-13-task-entry-mode-chip/`(截圖在底下 `assets/`)。報告格式、截圖落地流程見 [.claude/rules/acceptance-report.md](.claude/rules/acceptance-report.md)。

- [ ] **Step 1:啟動 preview、探測登入狀態**

用共享 profile 開:`playwright-cli open --persistent --profile ~/.desk-dev/pw-profile <preview-url>`。已登入則直接驗收;未登入請使用者協助走一次 device flow。

- [ ] **Step 2:逐項對照 spec 驗收標準操作並截圖**

對照 [spec 驗收標準](../specs/2026-06-13-task-entry-mode-chip-design.md):
1. 日 / 月新增列顯示 chip;Backlog 無 chip。
2. chip 預設「計畫中」;切換後重整仍記得。
3. 同畫面任一 chip 切換,其他即時同步(Plan 頁多輸入列)。
4. 切「計畫中」新增 → 落計畫區;切「臨時」→ 落臨時區(日與月各驗一次)。
5. 觀感:配色對比、觸控目標、窄畫面不破版(`playwright-cli` 設窄 viewport 截圖)。

- [ ] **Step 3:寫驗收報告**

把結果與截圖寫進 `docs/acceptance-reports/2026-06-13-task-entry-mode-chip/`,逐項標 PASS / FAIL。

- [ ] **Step 4:最終回歸**

Run: `npm run build && npx vitest run && npm run test:e2e`
Expected: 三者全綠。

---

## 完成定義

- 日 / 月新增列有共享 chip、Backlog 沒有。
- chip 預設「計畫中」、記憶上次選擇、跨輸入列即時同步。
- 新增任務的 `is_adhoc` 依 chip 決定,落到正確分區。
- 三個新增輸入統一為 `AddTaskBar`,舊元件已刪。
- `npm run build`、`npx vitest run`、`npm run test:e2e` 全綠,驗收報告完成。
