# Slice 2c — UI 打磨實作計畫

> **給 agentic worker:** 必要 sub-skill:用 superpowers:subagent-driven-development(建議)或 superpowers:executing-plans 逐任務執行本計畫。步驟用 checkbox（`- [ ]`）語法追蹤。

**目標:** 把接 WSPC 過程中延後的 UI 遺留物一次打磨完成 —— 登入動線、AuthMenu dropdown、優先權改下拉選取、計畫外 ⇄ 計畫內雙向切換、touch 偵測、一週改星期日開始。

**架構:** 純前端 + 一處 worker PATCH 欄位補強。互動 / 邏輯部分走 TDD（vitest + Testing Library）；純視覺部分（卡片版型、狀態色、紙感）走實作 + 手動 preview 驗收。所有 todo 寫入沿用既有 store action 與 patch queue。

**技術棧:** React 18、TypeScript、Zustand、TanStack Router、`@base-ui/react@^1.5.0`（已用 ToggleGroup / Toggle / Checkbox，本片新增 Menu）、CSS Modules + design tokens、vitest。

**設計依據:** [docs/superpowers/specs/2026-06-06-slice-2c-ui-polish-design.md](docs/superpowers/specs/2026-06-06-slice-2c-ui-polish-design.md)

**指令慣例:**
- 跑單一測試檔:`npx vitest run <path>`
- 跑單一測試名:`npx vitest run <path> -t "<name>"`
- 全套件:`npm run test`（= `vitest`，watch 模式，CI 外用 `npx vitest run`）
- 型別檢查:`npx tsc -p tsconfig.json --noEmit`

---

## 任務總覽

| 任務 | 主題 | 性質 |
|---|---|---|
| 1 | `weekOf` 改星期日開始 | 純函式 TDD |
| 2 | `Menu` primitive（包 @base-ui menu） | 元件 + 測試 |
| 3 | worker PATCH 支援 `is_adhoc` + `TodoPatch` 型別 | 後端 TDD |
| 4 | store `setAdhoc` action + taskOp | 狀態 TDD |
| 5 | 優先權改 dropdown 選取 | 互動 TDD |
| 6 | 計畫外 ⇄ 計畫內 + 行尾動作收進 ⋯ menu | 互動 TDD |
| 7 | Touch hover-capability 偵測 | CSS + 手動 |
| 8 | LoginPage 重設計 + 四狀態 | 視覺 + 行為 TDD |
| 9 | AuthMenu dropdown + 主題移入 menu | 視覺 + 行為 TDD |
| 10 | 手動 preview 驗收 | 手動 |

---

## 任務 1:`weekOf` 改星期日開始

**檔案:**
- 修改:`src/lib/date.ts`（`weekOf`,第 21-35 行）
- 測試:`src/lib/date.test.ts`（目前無 `weekOf` 測試）

- [ ] **步驟 1:寫失敗測試**

在 `src/lib/date.test.ts` 末尾,先在最上方 import 補上 `weekOf`（改 `import { isValidDateParam, weekOf } from "./date";`）,再加:

```typescript
describe("weekOf (Sunday start)", () => {
  it("returns Sun..Sat for a Saturday", () => {
    // 2026-06-06 is Saturday
    const r = weekOf("2026-06-06");
    expect(r).toEqual([
      "2026-06-01", // Sun? no — see below
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
  });

  it("returns the same week for the Sunday itself", () => {
    // 2026-05-31 is Sunday
    const r = weekOf("2026-05-31");
    expect(r[0]).toBe("2026-05-31");
    expect(r[6]).toBe("2026-06-06");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-06-02 is Tuesday → week is 2026-05-31 .. 2026-06-06
    const r = weekOf("2026-06-02");
    expect(r[0]).toBe("2026-05-31");
    expect(r).toHaveLength(7);
  });
});
```

> 注意:`2026-06-06` 是星期六,所屬「週日起始週」應為 `2026-05-31`(日)到 `2026-06-06`(六)。第一個測試的陣列首項應是 `2026-05-31`。修正第一個測試的期望陣列為:

```typescript
    expect(r).toEqual([
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
    ]);
```

- [ ] **步驟 2:跑測試確認失敗**

執行:`npx vitest run src/lib/date.test.ts -t "weekOf"`
預期:FAIL（目前回傳的是週一起始,首項會是 `2026-06-01`）

- [ ] **步驟 3:改成週日起始的最小實作**

把 `src/lib/date.ts` 的 `weekOf` 改為:

```typescript
/** Returns array of 7 ISO dates for the week containing `date` (Sun-Sat). */
export function weekOf(date: string): string[] {
  const d = new Date(date + "T00:00:00");
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay()); // getDay() 0 = Sunday
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const next = new Date(sunday);
    next.setDate(sunday.getDate() + i);
    out.push(todayISO(next));
  }
  return out;
}
```

- [ ] **步驟 4:跑測試確認通過**

執行:`npx vitest run src/lib/date.test.ts`
預期:PASS（全部 weekOf 測試 + 既有 isValidDateParam 測試）

- [ ] **步驟 5:跑相關元件測試確認無回歸**

執行:`npx vitest run src/features/week`
預期:PASS（WeekRail / DayChip 讀 weekOf,排序改變但不應壞測試;若有寫死週一的斷言,一併更新為週日起始）

- [ ] **步驟 6:commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts
git commit -m "feat(date): week starts on Sunday"
```

---

## 任務 2:`Menu` primitive

建一個共用下拉選單,給任務 5（優先權）與任務 6（row 動作）共用。包 `@base-ui/react/menu`。

**檔案:**
- 建立:`src/ui/Menu/Menu.tsx`
- 建立:`src/ui/Menu/Menu.module.css`
- 建立:`src/ui/Menu/index.ts`
- 建立:`src/ui/Menu/Menu.test.tsx`

- [ ] **步驟 1:寫失敗測試**

`src/ui/Menu/Menu.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "./Menu";

describe("Menu", () => {
  it("opens on trigger click and fires item onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        ariaLabel="動作"
        trigger={<button type="button">⋯</button>}
        items={[
          { key: "a", label: "移到計畫內", onSelect },
          { key: "b", label: "刪除", onSelect: () => {}, danger: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "⋯" }));
    await user.click(await screen.findByRole("menuitem", { name: "移到計畫內" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("marks the selected item", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        ariaLabel="優先權"
        trigger={<button type="button">2</button>}
        items={[
          { key: "1", label: "今日第一", onSelect: () => {} },
          { key: "2", label: "今日第二", onSelect: () => {}, selected: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "2" }));
    const selected = await screen.findByRole("menuitem", { name: /今日第二/ });
    expect(selected).toHaveAttribute("aria-checked", "true");
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

執行:`npx vitest run src/ui/Menu/Menu.test.tsx`
預期:FAIL with "Cannot find module './Menu'"

- [ ] **步驟 3:實作 Menu**

`src/ui/Menu/Menu.tsx`:

```typescript
import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactNode } from "react";
import styles from "./Menu.module.css";

export interface MenuItemSpec {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
  danger?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItemSpec[];
  ariaLabel?: string;
}

export function Menu({ trigger, items, ariaLabel }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger as React.ReactElement} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="end" className={styles.positioner}>
          <BaseMenu.Popup className={styles.popup} aria-label={ariaLabel}>
            {items.map((it) => (
              <BaseMenu.Item
                key={it.key}
                disabled={it.disabled}
                aria-checked={it.selected ? "true" : undefined}
                className={[styles.item, it.danger && styles.danger, it.selected && styles.selected]
                  .filter(Boolean)
                  .join(" ")}
                onClick={it.onSelect}
              >
                {it.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
```

> 若 `@base-ui/react@1.5` 的 `Menu.Trigger render` prop 簽名與此不符,改用 `<BaseMenu.Trigger>{trigger}</BaseMenu.Trigger>` 形式;以 `npx tsc` 的型別錯誤為準調整。`Menu.Item` 的觸發在 base-ui 是 `onClick`。

`src/ui/Menu/Menu.module.css`:

```css
.positioner {
  z-index: 50;
}
.popup {
  min-width: 160px;
  background: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop, 0 4px 16px rgba(0, 0, 0, 0.12));
  padding: 4px 0;
}
.item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  /* Touch-friendly hit target — see Task 7 */
  min-height: 44px;
  padding: 0 var(--space-4);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--color-ink);
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
}
.item[data-highlighted],
.item:hover {
  background: var(--color-paper-alt);
}
.selected {
  font-weight: 600;
  color: var(--color-accent, #3a6ea5);
}
.danger {
  color: var(--color-flag, #c1432e);
}
```

`src/ui/Menu/index.ts`:

```typescript
export { Menu } from "./Menu";
export type { MenuProps, MenuItemSpec } from "./Menu";
```

- [ ] **步驟 4:跑測試確認通過**

執行:`npx vitest run src/ui/Menu/Menu.test.tsx`
預期:PASS。若 aria 屬性對不上,依 base-ui 實際 render 調整斷言（例如改查 `data-selected`）。

- [ ] **步驟 5:型別檢查**

執行:`npx tsc -p tsconfig.json --noEmit`
預期:無錯誤。

- [ ] **步驟 6:commit**

```bash
git add src/ui/Menu
git commit -m "feat(ui): add Menu primitive over base-ui menu"
```

---

## 任務 3:worker PATCH 支援 `is_adhoc` + `TodoPatch` 型別

計畫外 ⇄ 計畫內要把 `is_adhoc` 寫回 WSPC。`is_adhoc` 已是 DeskTask 既有 custom field（create 時已在用），這裡只是補上 PATCH 寫入路徑,不改資料模型。

**檔案:**
- 修改:`worker/routes/todo.ts`（`handlePatchTodo`,第 49-82 行）
- 測試:`worker/routes/todo.test.ts`
- 修改:`src/lib/api/todo.ts`（`TodoPatch`,第 27-32 行）

- [ ] **步驟 1:寫失敗測試（worker）**

在 `worker/routes/todo.test.ts` 既有 PATCH 測試群組中新增（沿用該檔現有的 mock 風格;若該檔尚無 PATCH 測試,參考既有 list/create 測試的 env / session stub 寫法）:

```typescript
it("maps is_adhoc into customFields on PATCH", async () => {
  // arrange: spy on patchTodo (../wspc) and a valid session, as existing tests do
  // act: PATCH /api/todo/<id> with body { is_adhoc: "false" }
  // assert: patchTodo called with customFields.is_adhoc === "false"
});
```

> 用該檔既有測試已建立的 `patchTodo` spy / session stub 機制填入 arrange/act/assert（與既有 `daily_priority` PATCH 測試對稱）。斷言核心:`expect(patchTodoSpy).toHaveBeenCalledWith(expect.anything(), id, expect.objectContaining({ customFields: expect.objectContaining({ is_adhoc: "false" }) }))`。

- [ ] **步驟 2:跑測試確認失敗**

執行:`npx vitest run worker/routes/todo.test.ts -t "is_adhoc"`
預期:FAIL（目前 handler 不讀 `is_adhoc`）

- [ ] **步驟 3:實作 —— handler 接受 `is_adhoc`**

在 `worker/routes/todo.ts` 的 `handlePatchTodo`,把 body 型別與解析、customFields 映射各補一行:

body 型別（兩處,宣告與 cast）加:
```typescript
      is_adhoc?: "true" | "false";
```

customFields 映射區（第 72-74 行附近）加:
```typescript
    if ("is_adhoc" in body) customFields.is_adhoc = body.is_adhoc ?? null;
```

- [ ] **步驟 4:跑測試確認通過**

執行:`npx vitest run worker/routes/todo.test.ts`
預期:PASS

- [ ] **步驟 5:擴充 `TodoPatch` 型別**

`src/lib/api/todo.ts` 的 `TodoPatch`（第 27-32 行）加一欄:

```typescript
export interface TodoPatch {
  status?: TaskStatus;
  daily_priority?: string | null;
  done_on?: string | null;
  title?: string;
  is_adhoc?: "true" | "false";
}
```

- [ ] **步驟 6:型別檢查 + commit**

執行:`npx tsc -p tsconfig.json --noEmit` 與 `npx tsc -p tsconfig.worker.json --noEmit`
預期:無錯誤。

```bash
git add worker/routes/todo.ts worker/routes/todo.test.ts src/lib/api/todo.ts
git commit -m "feat(todo): support is_adhoc in PATCH"
```

---

## 任務 4:store `setAdhoc` action + taskOp

**檔案:**
- 修改:`src/store/taskOps.ts`（新增 `setAdhoc`）
- 測試:`src/store/taskOps.test.ts`
- 修改:`src/store/tasks.ts`（新增 action）
- 測試:`src/store/tasks.test.ts`

- [ ] **步驟 1:寫失敗測試（純 op）**

`src/store/taskOps.test.ts` 新增:

```typescript
import { setAdhoc } from "./taskOps";

describe("setAdhoc", () => {
  it("sets is_adhoc to the given value", () => {
    const tasks = [
      { id: "x", title: "t", status: "open", created_at: "", updated_at: "",
        custom_fields: { is_adhoc: "true" } },
    ] as never as import("@/lib/types").Task[];
    const next = setAdhoc(tasks, "x", false);
    expect(next.find((t) => t.id === "x")!.custom_fields.is_adhoc).toBe("false");
  });

  it("returns the same array when id is missing", () => {
    const tasks: import("@/lib/types").Task[] = [];
    expect(setAdhoc(tasks, "nope", true)).toBe(tasks);
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

執行:`npx vitest run src/store/taskOps.test.ts -t "setAdhoc"`
預期:FAIL with "setAdhoc is not a function"

- [ ] **步驟 3:實作 op**

`src/store/taskOps.ts` 末尾新增（沿用檔案內既有的 `patch` helper）:

```typescript
export function setAdhoc(tasks: Task[], id: string, isAdhoc: boolean): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) =>
    t.id === id ? patch(t, { is_adhoc: isAdhoc ? "true" : "false" }) : t,
  );
}
```

- [ ] **步驟 4:跑測試確認通過**

執行:`npx vitest run src/store/taskOps.test.ts`
預期:PASS

- [ ] **步驟 5:寫失敗測試（store action,樂觀 + 回滾）**

`src/store/tasks.test.ts` 新增（沿用該檔既有 mock 風格:spy `patchTodoApi`、`resetTodoQueue`、seed store）:

```typescript
it("setAdhoc optimistically toggles and patches via queue", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
  await useTasksStore.getState().setAdhoc("d5", false);
  expect(
    useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc,
  ).toBe("false");
});

it("setAdhoc rolls back on failure", async () => {
  vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
  const before = allTasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc;
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
  await useTasksStore.getState().setAdhoc("d5", false);
  expect(
    useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc,
  ).toBe(before);
  expect(useTasksStore.getState().error).toBe("save_failed");
});
```

> `d5` 在 mock 是計畫內(無 is_adhoc 或為 "false");若 mock 的 `is_adhoc` 初值不同,把斷言對齊實際 mock 值即可。需要時改用一個已知 `is_adhoc: "true"` 的 mock id。

- [ ] **步驟 6:跑測試確認失敗**

執行:`npx vitest run src/store/tasks.test.ts -t "setAdhoc"`
預期:FAIL with "setAdhoc is not a function"

- [ ] **步驟 7:實作 store action**

`src/store/tasks.ts`:介面（第 22-38 行區）加宣告 `setAdhoc: (id: string, isAdhoc: boolean) => Promise<void>;`,import 區加入 `setAdhoc as setAdhocOp`,並在 store 物件新增（仿 `editTitle` 的樂觀 + 回滾結構）:

```typescript
  async setAdhoc(id, isAdhoc) {
    const prev = get().tasks;
    set({ tasks: setAdhocOp(prev, id, isAdhoc), error: null });
    try {
      await enqueuePatch(id, { is_adhoc: isAdhoc ? "true" : "false" });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },
```

import 行改為:
```typescript
import {
  addTodayTask,
  deleteTask,
  editTitle,
  restoreTask as restoreTaskOp,
  setAdhoc as setAdhocOp,
  setDailyPriority,
  toggleDone,
} from "./taskOps";
```

- [ ] **步驟 8:跑測試確認通過 + commit**

執行:`npx vitest run src/store/tasks.test.ts src/store/taskOps.test.ts`
預期:PASS

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(store): setAdhoc action with optimistic update + rollback"
```

---

## 任務 5:優先權改 dropdown 選取

把 `cyclePriority`（循環）換成 `setPriority(value)`（直接選），PriorityRing 改為開 Menu。

**檔案:**
- 修改:`src/features/day/useTaskRow.ts`
- 測試:`src/features/day/useTaskRow.test.ts`（重寫 priority 相關測試）
- 修改:`src/ui/PriorityRing/PriorityRing.tsx`
- 修改:`src/features/day/TaskRow.tsx`（priority 區改用 Menu）
- 測試:`src/features/day/TaskRow.test.tsx`（更新 ring 測試）

- [ ] **步驟 1:重寫 useTaskRow 的失敗測試**

把 `src/features/day/useTaskRow.test.ts` 中所有 `cyclePriority` 測試替換為 `setPriority` 版本:

```typescript
it("setPriority sets the chosen slot", async () => {
  await act(async () => {
    const s = useTasksStore.getState();
    await s.setDailyPriority("d1", null);
    await s.setDailyPriority("d2", null);
    await s.setDailyPriority("d3", null);
  });
  const { result } = renderHook(() => useTaskRow("d5"));
  await act(async () => result.current.setPriority("1"));
  expect(
    useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
  ).toBe("1");
});

it("setPriority evicts the previous occupant of the chosen slot", async () => {
  await act(async () => {
    const s = useTasksStore.getState();
    await s.setDailyPriority("d1", "1");
  });
  const { result } = renderHook(() => useTaskRow("d5"));
  await act(async () => result.current.setPriority("1"));
  const tasks = useTasksStore.getState().tasks;
  expect(tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("1");
  expect(tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBeUndefined();
});

it("setPriority(null) removes the priority", async () => {
  await act(async () => useTasksStore.getState().setDailyPriority("d1", "1"));
  const { result } = renderHook(() => useTaskRow("d1"));
  await act(async () => result.current.setPriority(null));
  expect(
    useTasksStore.getState().tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority,
  ).toBeUndefined();
});
```

- [ ] **步驟 2:跑測試確認失敗**

執行:`npx vitest run src/features/day/useTaskRow.test.ts -t "setPriority"`
預期:FAIL with "setPriority is not a function"

- [ ] **步驟 3:實作 setPriority,移除循環邏輯**

`src/features/day/useTaskRow.ts`:刪除 `nextPriority`、`nextFreeSlot`、`PRIORITY_SLOTS` 與 `cyclePriority`,並把回傳改為:

```typescript
    setPriority: (n: Priority | null) => setDailyPriority(id, n),
```

並把不再使用的 import（`primaryDate`、`Priority` 視情況保留 `Priority`,`primaryDate` 移除）清掉。`setDailyPriority` 已在 store 解構取得;確認檔案頂部仍 `import type { Priority, Task } from "@/lib/types";`（保留 `Priority`,可移除 `Task` 若不再用）。

- [ ] **步驟 4:跑測試確認通過**

執行:`npx vitest run src/features/day/useTaskRow.test.ts`
預期:PASS

- [ ] **步驟 5:PriorityRing 改為可當 Menu trigger**

`src/ui/PriorityRing/PriorityRing.tsx`:保留外觀,但讓它能被 Menu 當 trigger（forwardRef + 不再強制自帶 onClick 行為）。改為:

```typescript
import { forwardRef, type ButtonHTMLAttributes } from "react";
import type { Priority } from "@/lib/types";
import styles from "./PriorityRing.module.css";

export interface PriorityRingProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: Priority | null;
}

export const PriorityRing = forwardRef<HTMLButtonElement, PriorityRingProps>(
  function PriorityRing({ value, className, ...rest }, ref) {
    const isSet = value !== null;
    return (
      <button
        ref={ref}
        type="button"
        className={[styles.ring, isSet ? styles.solid : styles.empty, className]
          .filter(Boolean)
          .join(" ")}
        aria-label={isSet ? `今日重點第 ${value}` : "設為今日重點"}
        {...rest}
      >
        {isSet ? value : "+"}
      </button>
    );
  },
);
```

- [ ] **步驟 6:更新 TaskRow ring 測試**

`src/features/day/TaskRow.test.tsx` 的 ring 測試改為:點 ring 開 menu、點「今日第一」項,斷言 priority 變 "1":

```typescript
it("opens a priority menu and sets the chosen slot", async () => {
  const user = userEvent.setup();
  const TestComponent = () => {
    const task = useTasksStore((s) => s.tasks.find((t) => t.id === "d5"))!;
    return <TaskRow task={task} kind="primary" interactive showRing />;
  };
  await useTasksStore.getState().setDailyPriority("d1", null);
  await useTasksStore.getState().setDailyPriority("d2", null);
  await useTasksStore.getState().setDailyPriority("d3", null);
  render(<TestComponent />);
  await user.click(screen.getByRole("button", { name: "設為今日重點" }));
  await user.click(await screen.findByRole("menuitem", { name: /今日第一/ }));
  expect(
    useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
  ).toBe("1");
});
```

- [ ] **步驟 7:TaskRow 用 Menu 包 PriorityRing**

`src/features/day/TaskRow.tsx`:把 `showRing && editable` 區塊改為用 `Menu`,items 為四項:

```typescript
{showRing && editable && (
  <Menu
    ariaLabel="今日重點"
    trigger={<PriorityRing value={task.custom_fields.daily_priority ?? null} />}
    items={[
      { key: "1", label: "① 今日第一", onSelect: () => row.setPriority("1"),
        selected: task.custom_fields.daily_priority === "1" },
      { key: "2", label: "② 今日第二", onSelect: () => row.setPriority("2"),
        selected: task.custom_fields.daily_priority === "2" },
      { key: "3", label: "③ 今日第三", onSelect: () => row.setPriority("3"),
        selected: task.custom_fields.daily_priority === "3" },
      { key: "none", label: "— 移除重點", onSelect: () => row.setPriority(null) },
    ]}
  />
)}
```

import 區加 `import { Menu } from "@/ui/Menu";`。移除對 `row.cyclePriority` 的引用。

- [ ] **步驟 8:跑測試確認通過 + 型別檢查**

執行:`npx vitest run src/features/day/TaskRow.test.tsx src/features/day/useTaskRow.test.ts`
預期:PASS
執行:`npx tsc -p tsconfig.json --noEmit`
預期:無錯誤

- [ ] **步驟 9:commit**

```bash
git add src/features/day/useTaskRow.ts src/features/day/useTaskRow.test.ts src/ui/PriorityRing/PriorityRing.tsx src/features/day/TaskRow.tsx src/features/day/TaskRow.test.tsx
git commit -m "feat(today): priority ring opens a dropdown instead of cycling"
```

---

## 任務 6:計畫外 ⇄ 計畫內 + 行尾動作收進 ⋯ menu

把行尾 ✎ 🗑 與「移到計畫內 / 標為計畫外」收進單一 ⋯ overflow menu。

**檔案:**
- 修改:`src/features/day/useTaskRow.ts`（新增 `toggleAdhoc`）
- 修改:`src/features/day/TaskRow.tsx`（行尾改 ⋯ menu）
- 測試:`src/features/day/TaskRow.test.tsx`

- [ ] **步驟 1:在 useTaskRow 暴露 toggleAdhoc**

`src/features/day/useTaskRow.ts`:解構 store 新增 `const setAdhoc = useTasksStore((s) => s.setAdhoc);`,回傳新增:

```typescript
    toggleAdhoc: () => {
      const isAdhoc = current?.custom_fields.is_adhoc === "true";
      setAdhoc(id, !isAdhoc);
    },
```

- [ ] **步驟 2:寫失敗測試（TaskRow ⋯ menu）**

`src/features/day/TaskRow.test.tsx` 新增。注意:現有測試用 `getByLabelText("刪除")` / `getByLabelText("編輯")` 直接點按鈕,改 menu 後這些動作移到 ⋯ menu 內,**既有 delete / edit 測試需同步改為先開 ⋯ menu**:

```typescript
it("moves an adhoc task to planned via the overflow menu", async () => {
  const user = userEvent.setup();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  // pick a mock task that is adhoc; if d5 is not adhoc, set it first
  await useTasksStore.getState().setAdhoc("d5", true);
  render(rowFor("d5"));
  await user.click(screen.getByLabelText("更多動作"));
  await user.click(await screen.findByRole("menuitem", { name: /移到計畫內/ }));
  expect(
    useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc,
  ).toBe("false");
});

it("marks a planned task as unplanned via the overflow menu", async () => {
  const user = userEvent.setup();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  await useTasksStore.getState().setAdhoc("d5", false);
  render(rowFor("d5"));
  await user.click(screen.getByLabelText("更多動作"));
  await user.click(await screen.findByRole("menuitem", { name: /標為計畫外/ }));
  expect(
    useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc,
  ).toBe("true");
});
```

把既有「deletes when the trash button is clicked」「edits the title via the edit button」改為先 `await user.click(screen.getByLabelText("更多動作"))` 再點 menu 內的「刪除」/「編輯」menuitem。

- [ ] **步驟 3:跑測試確認失敗**

執行:`npx vitest run src/features/day/TaskRow.test.tsx -t "overflow"`
預期:FAIL（無「更多動作」按鈕）

- [ ] **步驟 4:TaskRow 行尾改 ⋯ menu**

`src/features/day/TaskRow.tsx`:把現有 `editable && !row.isEditing` 的 `.actions`（兩個 iconBtn）整段換成單一 ⋯ Menu:

```typescript
{editable && !row.isEditing && (
  <Menu
    ariaLabel="更多動作"
    trigger={
      <button type="button" className={styles.iconBtn} aria-label="更多動作">
        ⋯
      </button>
    }
    items={[
      isAdhoc
        ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
        : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
      { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
      { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
    ]}
  />
)}
```

`isAdhoc` 變數已存在（第 18 行）。`Menu` 已於任務 5 import。

- [ ] **步驟 5:跑測試確認通過**

執行:`npx vitest run src/features/day/TaskRow.test.tsx`
預期:PASS（含改寫後的 edit / delete 測試）

- [ ] **步驟 6:型別檢查 + commit**

執行:`npx tsc -p tsconfig.json --noEmit`
預期:無錯誤

```bash
git add src/features/day/useTaskRow.ts src/features/day/TaskRow.tsx src/features/day/TaskRow.test.tsx
git commit -m "feat(today): overflow menu with adhoc toggle, edit, delete"
```

---

## 任務 7:Touch hover-capability 偵測

把「動作常駐顯示」的條件從寬度斷點改成 hover 能力偵測。

**檔案:**
- 修改:`src/features/day/TaskRow.module.css`（第 87-91 行）

- [ ] **步驟 1:改 CSS 偵測條件**

`src/features/day/TaskRow.module.css`:把預設 `.actions { opacity: 0 }` + `.row:hover .actions { opacity: 1 }` 改為「有 hover 才隱藏 + hover 顯示」,並把 `@media (max-width: 640px)` 整段替換為 `@media (hover: none)`:

```css
.actions {
  display: flex;
  gap: 4px;
  opacity: 1; /* default visible (touch / no-hover) */
  transition: opacity 0.12s ease;
}
@media (hover: hover) and (pointer: fine) {
  .actions {
    opacity: 0;
  }
  .row:hover .actions {
    opacity: 1;
  }
}
```

> 邏輯反轉:預設可見（涵蓋 touch / 無 hover），僅在「真的能 hover 的精準指標裝置」上才改為 hover 顯示。刪除原 `@media (max-width: 640px)` 區塊。

- [ ] **步驟 2:跑既有測試確認無回歸**

執行:`npx vitest run src/features/day/TaskRow.test.tsx`
預期:PASS（jsdom 無 hover 媒體查詢,動作預設可見,測試照常找得到 ⋯ 鈕）

- [ ] **步驟 3:commit**

```bash
git add src/features/day/TaskRow.module.css
git commit -m "feat(today): reveal row actions by hover capability, not width"
```

> Menu 項目觸控目標（≥44px）已在任務 2 的 `Menu.module.css` 設定。視覺驗收留待任務 10。

---

## 任務 8:LoginPage 重設計 + 四狀態

行為（四狀態文案 + 重試重新發起）走 TDD;版型 / 紙感 / 狀態色走實作 + 任務 10 手動驗收。

**檔案:**
- 修改:`src/pages/LoginPage.tsx`
- 建立:`src/pages/LoginPage.module.css`
- 測試:`src/pages/LoginPage.test.tsx`

- [ ] **步驟 1:寫失敗測試（文案 + 重試）**

`src/pages/LoginPage.test.tsx` 新增（沿用該檔 `mockFetchSequence` helper）:

```typescript
it("shows expired state with a 'restart' action that re-initiates device flow", async () => {
  vi.useFakeTimers();
  const fetchSpy = mockFetchSequence([
    new Response(JSON.stringify({
      verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD",
      user_code: "ABCD", polling_id: "pid-1", interval: 1, expires_in: 600,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response(JSON.stringify({ state: "expired" }), {
      status: 200, headers: { "Content-Type": "application/json" } }),
    // restart → a fresh login POST
    new Response(JSON.stringify({
      verification_uri_complete: "https://app.wspc.ai/device?user_code=WXYZ",
      user_code: "WXYZ", polling_id: "pid-2", interval: 1, expires_in: 600,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response(JSON.stringify({ state: "pending" }), {
      status: 200, headers: { "Content-Type": "application/json" } }),
  ]);
  render(<LoginPage onAuthenticated={() => {}} />);
  await vi.runAllTimersAsync();
  expect(await screen.findByText(/已過期/)).toBeInTheDocument();
  const restart = screen.getByRole("button", { name: /重新產生驗證碼/ });
  await restart.click?.();
  vi.useRealTimers();
  // a new login POST happened → new code eventually shows
  expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes("/api/auth/login"))).toBe(true);
});
```

> 重點斷言是「expired 顯示對應文案 + 有重新產生驗證碼按鈕」與「點它會重新 POST /api/auth/login」。userEvent 與 fake timers 混用較脆;以 `findByText` + 直接呼叫按鈕 onClick 為主,必要時改用 `@testing-library/user-event` 的 `advanceTimers` 選項。denied / error 兩狀態加對稱的「有按鈕」斷言即可（不必每個都驗證重啟全程）。

既有四個測試保留,但 denied 測試的斷言文案對齊新文案（`/已被拒絕/`），error 對齊（`/系統錯誤/`），pending link 文案保持 `/在 WSPC 開啟授權頁/`。

- [ ] **步驟 2:跑測試確認失敗**

執行:`npx vitest run src/pages/LoginPage.test.tsx`
預期:FAIL（無重試按鈕 / 文案不符）

- [ ] **步驟 3:重構 LoginPage —— 抽出可重啟的 device flow + 狀態 UI**

`src/pages/LoginPage.tsx`:把 effect 內的「POST login + 啟動 polling」抽成一個可重複呼叫的 `start()`（用 `useCallback` + 一個 `restartNonce` state 或直接函式呼叫重設 state 後重跑）。失敗三狀態各加按鈕,共用 `start()`:

關鍵結構（保留原 polling 邏輯,僅包裝成可重啟 + 換 UI）:

```typescript
// state: init / state 同現有;新增 restart = () => { setInit(null); setState("idle"); startRef.current(); }
// 把現有 useEffect 內的 (async login + poll) 抽成 start()，
// useEffect 首次呼叫 start()，cleanup 維持 cancelled + clearTimeout。
```

UI（取代第 102-121 行）改為套 CSS Module 的卡片 + Button primitive:

```tsx
import { Button } from "@/ui/Button";
import styles from "./LoginPage.module.css";
// ...
if (!init && state !== "error") {
  return <main className={styles.page}><div className={styles.card}>準備登入中⋯</div></main>;
}
return (
  <main className={styles.page}>
    <div className={styles.card}>
      <h1 className={styles.title}>登入 WSPC</h1>
      {init && (
        <>
          <p className={styles.lead}>
            點下方按鈕到 WSPC，核對畫面上的碼與下方一致後按 Approve，本頁會自動進入。
          </p>
          <Button
            variant="primary"
            render={
              <a href={init.verificationUriComplete} target="_blank" rel="noopener noreferrer" />
            }
          >
            在 WSPC 開啟授權頁 ↗
          </Button>
          <div className={styles.code}>
            <span className={styles.codeLabel}>核對碼</span>
            <span className={styles.codeValue}>{init.userCode}</span>
          </div>
        </>
      )}
      {state === "pending" && <p className={styles.statusPending}>⟳ 等待授權中⋯</p>}
      {state === "denied" && (
        <div className={styles.statusDanger}>
          <p>授權已被拒絕。</p>
          <Button variant="primary" onClick={restart}>重新登入</Button>
        </div>
      )}
      {state === "expired" && (
        <div className={styles.statusWarn}>
          <p>驗證碼已過期。</p>
          <Button variant="primary" onClick={restart}>重新產生驗證碼</Button>
        </div>
      )}
      {state === "error" && (
        <div className={styles.statusMuted}>
          <p>系統錯誤，請稍後再試。</p>
          <Button variant="primary" onClick={restart}>重試</Button>
        </div>
      )}
    </div>
  </main>
);
```

> 若 `Button` 不支援 `render` prop（任務 2 同類問題）,改為在 `<a>` 上直接套 button 樣式 class,或包一層;以 `Button.tsx` 實際簽名為準（目前 Button 只接受標準 button props,故 link 版用 `<a className={buttonClass}>`,從 Button.module.css 借 class，或在 LoginPage.module.css 自定 primary 按鈕樣式）。**採後者最穩:在 LoginPage.module.css 自定 `.primaryLink` 樣式,`<a>` 直接套用,不依賴 Button 的 render prop。**

`src/pages/LoginPage.module.css`:置中卡片 + 紙感 + 狀態色（用 tokens;warn/danger 若 tokens 未定義,於本檔以 CSS 變數 fallback）:

```css
.page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--color-paper);
}
.card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-7) var(--space-6);
  background: var(--color-paper-alt);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop, 0 8px 32px rgba(0, 0, 0, 0.1));
  text-align: center;
}
.title { font-family: var(--font-sans); font-size: var(--text-xl); color: var(--color-ink); }
.lead { font-size: var(--text-sm); color: var(--color-ink-soft); max-width: 28ch; }
.primaryLink {
  display: inline-block;
  background: var(--color-accent, #3a6ea5);
  color: #fff;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-base);
  font-weight: 600;
  text-decoration: none;
}
.code { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.codeLabel {
  font-size: var(--text-2xs); letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-ink-faint);
}
.codeValue {
  font-family: var(--font-mono); font-size: var(--text-lg); font-weight: 700;
  letter-spacing: 0.18em; color: var(--color-ink);
}
.statusPending { color: var(--color-ink-soft); font-size: var(--text-sm); }
.statusDanger { color: var(--color-flag, #c1432e); display: flex; flex-direction: column; gap: var(--space-2); align-items: center; }
.statusWarn { color: var(--color-warn, #9a7b2e); display: flex; flex-direction: column; gap: var(--space-2); align-items: center; }
.statusMuted { color: var(--color-ink-soft); display: flex; flex-direction: column; gap: var(--space-2); align-items: center; }
```

> 若上述 token 名（`--color-line`、`--color-ink-soft`、`--radius-lg`、`--text-xl` 等）與 `src/tokens/*.css` 實際命名不符,執行時先 grep `src/tokens` 對齊正確變數名再填入。

把 pending link 換成 `.primaryLink` 的 `<a>`:

```tsx
<a className={styles.primaryLink} href={init.verificationUriComplete}
   target="_blank" rel="noopener noreferrer">在 WSPC 開啟授權頁 ↗</a>
```

並移除步驟中誤用的 `Button render` 版本。denied/expired/error 的重試用 `Button variant="primary"`（標準 button,沒有 render prop 問題）。

- [ ] **步驟 4:跑測試確認通過**

執行:`npx vitest run src/pages/LoginPage.test.tsx`
預期:PASS。`link` role 查詢改為 `screen.getByRole("link", { name: /在 WSPC 開啟授權頁/ })` 仍成立。

- [ ] **步驟 5:型別檢查 + commit**

執行:`npx tsc -p tsconfig.json --noEmit`
預期:無錯誤

```bash
git add src/pages/LoginPage.tsx src/pages/LoginPage.module.css src/pages/LoginPage.test.tsx
git commit -m "feat(login): redesigned card layout, verify-code, four states with restart"
```

---

## 任務 9:AuthMenu dropdown + 主題移入 menu

已登入改 avatar + dropdown（email / 主題 SegmentedControl / 登出）;未登入「登入 WSPC」改 Button;主題切換已登入時移入 menu,未登入時獨立留在 nav。

**檔案:**
- 修改:`src/features/shell/AuthMenu.tsx`
- 建立:`src/features/shell/AuthMenu.module.css`
- 測試:`src/features/shell/AuthMenu.test.tsx`
- 修改:`src/features/shell/TopNav.tsx`（未登入才顯示獨立 ThemeToggle）

- [ ] **步驟 1:更新失敗測試**

`src/features/shell/AuthMenu.test.tsx`:已登入測試改為「點開 menu 才看到登出 + 主題」。新增主題在 menu 內的斷言:

```typescript
it("shows display name; logout + theme live inside the dropdown", async () => {
  useAuthStore.setState({
    me: { userId: "u-1", email: "a@b", displayName: "Alice" },
    status: "authenticated",
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  renderWithRouter();
  // name is visible on the trigger
  expect(await screen.findByText("Alice")).toBeInTheDocument();
  // open the menu
  await userEvent.click(screen.getByRole("button", { name: /Alice|帳號選單/ }));
  // theme control + email + logout inside
  expect(await screen.findByText("a@b")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  const logout = screen.getByRole("menuitem", { name: /登出/ });
  await userEvent.click(logout);
  expect(useAuthStore.getState().me).toBeNull();
  expect(useAuthStore.getState().status).toBe("unauthenticated");
});

it("shows a login button when unauthenticated", async () => {
  useAuthStore.setState({ me: null, status: "unauthenticated" });
  renderWithRouter();
  const link = await screen.findByRole("link", { name: /登入 WSPC/ });
  expect(link).toHaveAttribute("href", "/login");
});
```

> 主題用既有 `SegmentedControl`，其 `ariaLabel="Theme"` 會 render 成 `role="group"`（base-ui ToggleGroup）。若實際 role 不是 group,改用 `findByText("Auto")` 之類定位。登出若放在 menu 內用 `menuitem` role；若實作上登出是一般 button 則改 `getByRole("button", { name: /登出/ })`。

- [ ] **步驟 2:跑測試確認失敗**

執行:`npx vitest run src/features/shell/AuthMenu.test.tsx`
預期:FAIL

- [ ] **步驟 3:實作 AuthMenu dropdown**

`src/features/shell/AuthMenu.tsx`:

```typescript
import { Link } from "@tanstack/react-router";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useAuthStore } from "@/store/auth";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/ui/Button";
import styles from "./AuthMenu.module.css";

export function AuthMenu() {
  const status = useAuthStore((s) => s.status);
  const me = useAuthStore((s) => s.me);
  const clear = useAuthStore((s) => s.clear);

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <Button variant="primary" size="sm" render={<Link to="/login" />}>
        登入 WSPC
      </Button>
    );
  }

  const label = me?.displayName ?? me?.email ?? "";
  const initial = label.slice(0, 1).toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clear();
  }

  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className={styles.trigger} aria-label="帳號選單">
        <span className={styles.avatar}>{initial}</span>
        <span className={styles.name}>{label}</span>
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner align="end" sideOffset={6} className={styles.positioner}>
          <BaseMenu.Popup className={styles.popup}>
            {me?.email && <div className={styles.email}>{me.email}</div>}
            <div className={styles.themeRow}>
              <span className={styles.sectionLabel}>主題</span>
              <ThemeToggle />
            </div>
            <BaseMenu.Item className={styles.logout} onClick={logout}>
              登出
            </BaseMenu.Item>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
```

> 若 `Button` 無 `render` prop,未登入改為 `<Link to="/login" className={buttonPrimaryClass}>登入 WSPC</Link>`，class 取自 Button.module.css 或在 AuthMenu.module.css 自定 `.loginBtn`。以 `npx tsc` 為準。`SegmentedControl` 點擊不應關閉 menu —— base-ui Menu 內放互動元件時，若點擊被 menu 吞掉，將 ThemeToggle 包在 `<div onClick={(e) => e.stopPropagation()}>` 內。

`src/features/shell/AuthMenu.module.css`（精簡,細節留任務 10 調）:

```css
.trigger {
  display: inline-flex; align-items: center; gap: var(--space-2);
  border: none; background: transparent; cursor: pointer;
  color: var(--color-ink); font-family: var(--font-sans); font-size: var(--text-sm);
  padding: 4px 6px; border-radius: var(--radius-md);
}
.trigger:hover { background: var(--color-paper-alt); }
.avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--color-accent, #3a6ea5); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: var(--text-xs); font-weight: 600;
}
.positioner { z-index: 50; }
.popup {
  min-width: 200px; background: var(--color-paper); border: 1px solid var(--color-line);
  border-radius: var(--radius-md); box-shadow: var(--shadow-pop, 0 4px 16px rgba(0,0,0,.12));
  padding: var(--space-2) 0;
}
.email { padding: 4px var(--space-4) var(--space-2); font-size: var(--text-xs); color: var(--color-ink-faint); }
.themeRow {
  display: flex; flex-direction: column; gap: 6px;
  padding: var(--space-2) var(--space-4); border-top: 1px solid var(--color-line);
}
.sectionLabel { font-size: var(--text-2xs); letter-spacing: .06em; text-transform: uppercase; color: var(--color-ink-faint); }
.logout {
  display: block; width: 100%; text-align: left; cursor: pointer;
  padding: var(--space-2) var(--space-4); margin-top: 4px; border-top: 1px solid var(--color-line);
  font-size: var(--text-base); color: var(--color-ink); background: transparent; border-left: none; border-right: none; border-bottom: none;
}
.logout:hover { background: var(--color-paper-alt); }
.name { max-width: 14ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **步驟 4:TopNav 未登入才獨立顯示 ThemeToggle**

`src/features/shell/TopNav.tsx`:`.actions` 區改為已登入時主題在 menu 內、未登入時主題獨立。最小改法:讓 ThemeToggle 只在未登入時 render。

```typescript
import { useAuthStore } from "@/store/auth";
// ...
export function TopNav() {
  const status = useAuthStore((s) => s.status);
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
        {status !== "authenticated" && <ThemeToggle />}
      </div>
    </header>
  );
}
```

- [ ] **步驟 5:跑測試確認通過**

執行:`npx vitest run src/features/shell/AuthMenu.test.tsx`
預期:PASS（依 base-ui 實際 role 調整查詢）

- [ ] **步驟 6:型別檢查 + commit**

執行:`npx tsc -p tsconfig.json --noEmit`
預期:無錯誤

```bash
git add src/features/shell/AuthMenu.tsx src/features/shell/AuthMenu.module.css src/features/shell/AuthMenu.test.tsx src/features/shell/TopNav.tsx
git commit -m "feat(shell): auth dropdown with theme + logout; login button when signed out"
```

---

## 任務 10:手動 preview 驗收

自動化測試涵蓋不到的視覺 / 互動,由 AI agent 開 preview 操作驗收;需要真實登入時請使用者協助。

- [ ] **步驟 1:全套件 + 型別最終確認**

執行:`npx vitest run`
預期:全 PASS
執行:`npx tsc -p tsconfig.json --noEmit` 與 `npx tsc -p tsconfig.worker.json --noEmit`
預期:無錯誤

- [ ] **步驟 2:開 preview**

用 `preview_start` 啟動,取得預覽 URL。

- [ ] **步驟 3:對照驗收標準逐項操作**

依 spec「驗收標準」1–10 逐項以 `preview_*` 工具操作驗證:

1. 登入頁卡片 / 紙感 / primary 按鈕主角 / 核對碼無複製鈕（light + dark 各看一次）
2. denied / expired / error 三狀態色 + 文案 + 重試（可暫時改 `/api/auth/status` mock 或請使用者觸發）
3. 已登入 header avatar + 名字,menu 內 email / 主題 / 登出
4. 未登入主題獨立可切;已登入主題在 menu 內
5. 登入 / 登出 / 切主題不跳動閃爍
6. priority ring 開 dropdown、設 ①②③ / 移除、騰位正確
7. 計畫外 ⇄ 計畫內經 ⋯ menu 換區
8. 縮小視窗 / 模擬 touch:⋯ 常駐可見、menu 觸控目標夠大
9. WeekRail 一週從星期日開始
10. 窄視窗登入卡片與 header 排版正常

> **需要真實 WSPC 登入時**（驗收 3–7 要真資料）:device flow 需在 WSPC 端按 Approve —— **請使用者協助完成登入**後再續跑。

- [ ] **步驟 4:修正手動驗收發現的視覺問題**

對驗收中發現的觀感 / 排版問題做針對性修正,每修一處跑相關測試後 commit:

```bash
git commit -m "fix(2c): <針對性視覺修正描述>"
```

- [ ] **步驟 5:更新 ROADMAP**

`ROADMAP.md`:把 Slice 2c 條目標題改為「UI 打磨（登入流程 + Today 互動）」,狀態改 ✅,checklist 補上優先權 dropdown、計畫外 ⇄ 計畫內、touch 偵測、一週改星期日開始四項。

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): mark Slice 2c done with expanded scope"
```

---

## 自我檢查結果

- **Spec 覆蓋**:A1 LoginPage→任務 8;A2 四狀態→任務 8;A3 AuthMenu→任務 9;A4 主題移入 menu + 未登入 fallback→任務 9;A5 loading/mobile→任務 10;B1 優先權 dropdown→任務 5;B2 計畫外⇄內→任務 4+6;B3 touch→任務 7（+任務 2 menu 觸控目標）;B4 週日開始→任務 1。手動測試→任務 10。全數有對應任務。
- **隱含相依**:B2 需 `is_adhoc` 能 persist → 補任務 3（spec「不做」表指的是「不改資料模型」,補既有欄位的 PATCH 路徑不違反）。
- **型別一致**:`setPriority(n: Priority | null)`、`setAdhoc(id, isAdhoc: boolean)`、`toggleAdhoc()`、`MenuItemSpec.onSelect`、`TodoPatch.is_adhoc` 跨任務一致。
- **風險備註**:`@base-ui/react@1.5` 的 Menu API（`Trigger render` / `Item onClick` / role 名）與 `Button` 是否支援 `render` prop,以 `npx tsc` 與實際 render 為準調整,計畫已在對應步驟標註 fallback。
