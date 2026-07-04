# Todo 讀取 SWR 快取 + 同步狀態指示 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 用前端 localStorage stale-while-revalidate 消除 Todo 冷開白畫面,背景 revalidate 失敗時守住舊資料並顯示「未同步」徽章。

**架構:** 用 zustand `persist` middleware 只持久化 `tasks`,把「有沒有資料可畫」跟「是不是正在抓」拆開(view 改看 `tasks.length` 而非 `status`)。新增 `synced` 旗標由 reload 結果驅動 TopNav 徽章。純前端,不動後端與寫入路徑。

**技術棧:** React、TypeScript、zustand v5(`persist` from `zustand/middleware`)、vitest / Testing Library、Playwright。

設計文件:[docs/superpowers/specs/2026-07-04-todo-read-swr-cache-design.md](../specs/2026-07-04-todo-read-swr-cache-design.md)

## 全域限制

- 程式碼與註解一律英文;文件敘述繁體中文。
- 型別檢查一律用 `npm run build`(= `tsc -b && vite build`),不要用 `tsc -p tsconfig.json --noEmit`(no-op 假綠)。
- 測試檔顯式 `import { describe, it, expect, ... } from "vitest"`(本專案不靠 global)。
- 安裝相依套件需 `npm install --legacy-peer-deps`(本計畫不需新增套件,zustand 已在)。
- 改到讀取載入路徑,除 `npx vitest run` 也要跑 e2e:`npm run test:e2e`。
- persist 的 localStorage key 固定為 `"desk-tasks"`。
- **絕對不要 persist `status`**:否則 hydration 後 `loadTasks` 的 load-once guard 會跳過背景 revalidate,快取永不更新。

## 檔案結構

| 檔案 | 責任 | 動作 |
|------|------|------|
| `src/store/tasks.ts` | 包 `persist`、加 `synced`、改 `reload` 失敗分支 | 修改 |
| `src/store/tasks.test.ts` | 上述行為的單元測試 | 修改 |
| `src/store/auth.ts` | `clear()` 清掉 persist storage | 修改 |
| `src/store/auth.test.ts` | `clear()` 清 storage 的測試 | 修改 |
| `src/routes/plan.tsx`、`src/routes/focus.tsx` | gating 改看 `tasks.length` | 修改 |
| `src/features/shell/SyncBadge.tsx` | 「未同步」徽章元件(讀 `synced`) | 新增 |
| `src/features/shell/SyncBadge.module.css` | 徽章樣式 | 新增 |
| `src/features/shell/SyncBadge.test.tsx` | 徽章顯隱測試 | 新增 |
| `src/features/shell/TopNav.tsx` | 掛上 `<SyncBadge />` | 修改 |
| `e2e/read-swr-cache.spec.ts` | 冷開快取可見 + 失敗徽章 e2e | 新增 |
| `docs/acceptance-reports/2026-07-04-todo-read-swr-cache/` | 手動驗收報告 | 新增 |

---

### 任務 1:store 加 persist、synced 旗標、reload SWR 失敗分支

**檔案:**
- 修改:`src/store/tasks.ts`
- 測試:`src/store/tasks.test.ts`

**介面:**
- 產出(後續任務會用到):
  - `TasksState` 新增欄位 `synced: boolean`(初值 `true`)。
  - `useTasksStore.persist`(persist middleware 掛上後自動具備),提供 `useTasksStore.persist.clearStorage()`,任務 2 會用。
  - persist 的 localStorage key 為 `"desk-tasks"`,`partialize` 只保留 `{ tasks }`。
  - `reload()` 行為:成功 → `synced=true`;失敗且 `tasks.length > 0` → `status="ready"`, `synced=false`, 保留 tasks;失敗且無 tasks → `status="error"`(同現況)。

- [ ] **步驟 1:寫失敗測試(persist 只存 tasks、synced 行為)**

在 `src/store/tasks.test.ts` 檔尾新增(沿用檔案現有的 import;`vi`、`api`、`useTasksStore` 皆已引入):

```ts
describe("persist + synced (SWR)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useTasksStore.setState({ tasks: [], status: "idle", error: null, synced: true });
  });

  it("persists only tasks, not status", () => {
    useTasksStore.setState({
      tasks: [{ id: "p1", title: "P", status: "open", created_at: "x", updated_at: "x", custom_fields: {} }],
      status: "ready",
    });
    const stored = JSON.parse(localStorage.getItem("desk-tasks")!);
    expect(stored.state.tasks.map((t: { id: string }) => t.id)).toEqual(["p1"]);
    expect(stored.state.status).toBeUndefined();
  });

  it("sets synced=true after a successful reload", async () => {
    useTasksStore.setState({ synced: false });
    vi.spyOn(api, "fetchTodos").mockResolvedValue([
      { id: "r", title: "R", status: "open", created_at: "x", updated_at: "x", custom_fields: {} },
    ]);
    await useTasksStore.getState().reload();
    expect(useTasksStore.getState().synced).toBe(true);
  });

  it("keeps cached tasks and flags unsynced when reload fails with cache", async () => {
    useTasksStore.setState({
      tasks: [{ id: "cached", title: "C", status: "open", created_at: "x", updated_at: "x", custom_fields: {} }],
      status: "ready",
      synced: true,
    });
    vi.spyOn(api, "fetchTodos").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().reload();
    const s = useTasksStore.getState();
    expect(s.tasks.map((t) => t.id)).toEqual(["cached"]);
    expect(s.status).toBe("ready");
    expect(s.synced).toBe(false);
  });

  it("falls back to status=error when reload fails with no cache", async () => {
    useTasksStore.setState({ tasks: [], status: "idle", synced: true });
    vi.spyOn(api, "fetchTodos").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().reload();
    expect(useTasksStore.getState().status).toBe("error");
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: FAIL —「persists only tasks」會因 `localStorage.getItem("desk-tasks")` 為 `null` 而丟錯(persist 還沒掛);synced 相關會因 `synced` 為 `undefined` 而 assertion 失敗。

- [ ] **步驟 3:掛 persist middleware**

在 `src/store/tasks.ts` 檔頭,`import { create } from "zustand";` 之後新增:

```ts
import { persist } from "zustand/middleware";
```

`TasksState` interface 內,`tasks` 欄位附近新增:

```ts
  synced: boolean;
```

把 `export const useTasksStore = create<TasksState>()((set, get) => ({` 改為 persist 包裹形式,並在初始 state 加入 `synced: true`。也就是開頭改成:

```ts
export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      today: todayISO(),
      status: "idle",
      error: null,
      recentlyDeleted: null,
      synced: true,
```

檔尾原本的 `}));` 改為關閉 persist options:

```ts
    }),
    {
      name: "desk-tasks",
      partialize: (s) => ({ tasks: s.tasks }),
    },
  ),
);
```

- [ ] **步驟 4:改 `reload()` 的成功與失敗分支**

把 `reload()` 內容改為:

```ts
  async reload() {
    const seq = ++loadSeq;
    set({ status: "loading", error: null });
    try {
      const tasks = await fetchTodos();
      if (seq !== loadSeq) return;          // a newer load superseded this one
      set({ tasks, today: todayISO(), status: "ready", synced: true });
    } catch {
      if (seq !== loadSeq) return;
      // With cached tasks on screen, stay put and flag "unsynced" instead of
      // blanking to a full-screen error. Only cold-start-with-no-cache errors out.
      if (get().tasks.length > 0) {
        set({ status: "ready", synced: false });
      } else {
        set({ status: "error", error: "load_failed" });
      }
    }
  },
```

- [ ] **步驟 5:跑測試確認通過**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: PASS(含既有測試;「sets status=error when load fails」因 tasks 為空仍走 error 分支,維持綠)。

- [ ] **步驟 6:型別檢查**

Run: `npm run build`
Expected: 通過(無型別錯)。

- [ ] **步驟 7:commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(tasks): persist tasks + SWR reload with synced flag"
```

---

### 任務 2:登出時清掉 persist storage

**檔案:**
- 修改:`src/store/auth.ts`
- 測試:`src/store/auth.test.ts`

**介面:**
- 消費(來自任務 1):`useTasksStore.persist.clearStorage()`。

- [ ] **步驟 1:寫失敗測試**

在 `src/store/auth.test.ts` 的 `describe("useAuthStore", ...)` 內新增一個測試(檔案已 import `useTasksStore`):

```ts
  it("clear() wipes persisted tasks from localStorage", () => {
    useTasksStore.setState({
      tasks: [{ id: "x", title: "X", status: "open", created_at: "x", updated_at: "x", custom_fields: {} }],
    });
    expect(localStorage.getItem("desk-tasks")).not.toBeNull();
    useAuthStore.getState().clear();
    expect(localStorage.getItem("desk-tasks")).toBeNull();
  });
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/store/auth.test.ts`
Expected: FAIL —`clear()` 尚未清 storage,`localStorage.getItem("desk-tasks")` 仍非 null。

- [ ] **步驟 3:實作**

在 `src/store/auth.ts` 的 `clear()` 內,`clearTasks()` 之後、`set(...)` 之前加一行:

```ts
  clear() {
    useTasksStore.getState().clearTasks();
    useTasksStore.persist.clearStorage();
    set({ me: null, status: "unauthenticated" });
  },
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npx vitest run src/store/auth.test.ts`
Expected: PASS。

- [ ] **步驟 5:commit**

```bash
git add src/store/auth.ts src/store/auth.test.ts
git commit -m "feat(auth): clear persisted tasks cache on logout"
```

---

### 任務 3:view gating 改看 tasks 長度(SWR 不閃骨架屏)

**檔案:**
- 修改:`src/routes/plan.tsx`、`src/routes/focus.tsx`

**介面:**
- 消費:`useTasksStore` 的 `status`、`tasks`(現有)。
- 說明:本任務是純 gating 條件調整。SWR 的實際「快取先畫、不閃骨架」由任務 6 的 e2e 覆蓋(bare-render view 會 mount `<Link>` 需 RouterProvider,不適合單元測試,見 `src/routes/-focus.test.tsx` 註解)。既有 view 測試在 tasks 為空、fetch pending 下仍停在骨架屏,行為不變、應維持綠。

- [ ] **步驟 1:改 `plan.tsx` gating**

`src/routes/plan.tsx` 第 16 行:

```ts
  if (status === "loading" || status === "idle") return <LoadSkeleton />;
```

改為:

```ts
  // Only cold-start with an empty cache shows the skeleton; a warm cache renders
  // immediately while the background revalidate runs (SWR).
  if ((status === "loading" || status === "idle") && tasks.length === 0) return <LoadSkeleton />;
```

- [ ] **步驟 2:改 `focus.tsx` gating**

`src/routes/focus.tsx` 第 19 行做相同修改:

```ts
  if ((status === "loading" || status === "idle") && tasks.length === 0) return <LoadSkeleton />;
```

(`focus.tsx` 已在元件內 `const tasks = useTasksStore((s) => s.tasks);`,無需另加。)

- [ ] **步驟 3:跑既有 view 測試確認未回歸**

Run: `npx vitest run src/routes/-focus.test.tsx src/routes/-focus-date-route.test.tsx src/routes/-plan.test.tsx`
Expected: PASS(這些測試在 tasks 空 + fetch pending 下仍走骨架屏,不受影響)。

- [ ] **步驟 4:型別檢查**

Run: `npm run build`
Expected: 通過。

- [ ] **步驟 5:commit**

```bash
git add src/routes/plan.tsx src/routes/focus.tsx
git commit -m "feat(views): render cached tasks during background revalidate"
```

---

### 任務 4:SyncBadge 元件 + 掛上 TopNav

**檔案:**
- 新增:`src/features/shell/SyncBadge.tsx`
- 新增:`src/features/shell/SyncBadge.module.css`
- 測試:`src/features/shell/SyncBadge.test.tsx`
- 修改:`src/features/shell/TopNav.tsx`

**介面:**
- 消費(來自任務 1):`useTasksStore((s) => s.synced)`。
- 產出:`SyncBadge` 元件(`synced === false` 時顯示「未同步」,否則 render `null`)。

- [ ] **步驟 1:寫失敗測試**

新增 `src/features/shell/SyncBadge.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SyncBadge } from "./SyncBadge";
import { useTasksStore } from "@/store/tasks";

describe("SyncBadge", () => {
  beforeEach(() => {
    useTasksStore.setState({ synced: true });
  });

  it("renders nothing when synced", () => {
    render(<SyncBadge />);
    expect(screen.queryByText("未同步")).toBeNull();
  });

  it("shows 未同步 when not synced", () => {
    useTasksStore.setState({ synced: false });
    render(<SyncBadge />);
    expect(screen.getByText("未同步")).toBeInTheDocument();
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/features/shell/SyncBadge.test.tsx`
Expected: FAIL —`./SyncBadge` 尚不存在(module not found)。

- [ ] **步驟 3:實作 SyncBadge 元件與樣式**

新增 `src/features/shell/SyncBadge.tsx`:

```tsx
import { useTasksStore } from "@/store/tasks";
import styles from "./SyncBadge.module.css";

// Shown when the on-screen data is not in sync with the server (background
// revalidate failed while a cache is present). Clears on the next successful sync.
export function SyncBadge() {
  const synced = useTasksStore((s) => s.synced);
  if (synced) return null;
  return (
    <span className={styles.badge} role="status" title="資料未與伺服器同步">
      未同步
    </span>
  );
}
```

新增 `src/features/shell/SyncBadge.module.css`:

```css
.badge {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--color-ink-faint);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-full, 999px);
  padding: 2px 8px;
  white-space: nowrap;
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npx vitest run src/features/shell/SyncBadge.test.tsx`
Expected: PASS。

- [ ] **步驟 5:掛進 TopNav**

`src/features/shell/TopNav.tsx` 加入 import 並放進 `.actions`(AuthMenu 之前):

```tsx
import { DeskLogo } from "@/ui/DeskLogo";
import { AuthMenu } from "./AuthMenu";
import { ModeToggle } from "./ModeToggle";
import { SyncBadge } from "./SyncBadge";
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
        <SyncBadge />
        <AuthMenu />
      </div>
    </header>
  );
}
```

- [ ] **步驟 6:型別檢查**

Run: `npm run build`
Expected: 通過。

- [ ] **步驟 7:commit**

```bash
git add src/features/shell/SyncBadge.tsx src/features/shell/SyncBadge.module.css src/features/shell/SyncBadge.test.tsx src/features/shell/TopNav.tsx
git commit -m "feat(shell): add unsynced badge to top nav"
```

---

### 任務 5:e2e —冷開快取可見 + 失敗徽章

**檔案:**
- 新增:`e2e/read-swr-cache.spec.ts`

**介面:**
- 消費:`e2e/fixtures/session.ts` 的 `gotoTodaySeeded`。

- [ ] **步驟 1:寫 e2e spec**

新增 `e2e/read-swr-cache.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

const THREE_THINGS = "今天最重要的三件事";

test("reload renders cached tasks before the network responds (SWR)", async ({ page }) => {
  await gotoTodaySeeded(page);
  await expect(page.getByText(THREE_THINGS)).toBeVisible();

  // Block the todo revalidation so ONLY the localStorage cache can drive render.
  await page.route("**/api/todo", () => {
    /* never fulfill: request hangs */
  });
  await page.reload();

  // The TodayLayout heading only renders past the skeleton, so its visibility
  // while /api/todo is pending proves the cache drove the first paint.
  await expect(page.getByText(THREE_THINGS)).toBeVisible({ timeout: 3000 });
});

test("shows 未同步 badge when revalidation fails but cache is present", async ({ page }) => {
  await gotoTodaySeeded(page);

  await page.route("**/api/todo", (r) => r.abort());
  await page.reload();

  await expect(page.getByText(THREE_THINGS)).toBeVisible();
  await expect(page.getByText("未同步")).toBeVisible();
});
```

- [ ] **步驟 2:跑 e2e**

先確認 preview dev server 沒在跑(見記憶:e2e 與 preview 會搶 port)。
Run: `npm run test:e2e -- read-swr-cache`
Expected: 兩條均 PASS。

- [ ] **步驟 3:commit**

```bash
git add e2e/read-swr-cache.spec.ts
git commit -m "test(e2e): cold-open cache visibility + unsynced badge"
```

---

### 任務 6:手動驗收 + 產生驗收報告

**檔案:**
- 新增:`docs/acceptance-reports/2026-07-04-todo-read-swr-cache/`(報告 + `assets/` 截圖)

**說明:** 全程用 `playwright-cli`(共用 profile `~/.desk-dev/pw-profile`,見 CLAUDE.md)驗收並落地報告。報告格式與截圖流程見 [.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md)。

- [ ] **步驟 1:跑完整測試套件**

Run: `npx vitest run`
Expected: 全綠。

Run: `npm run build`
Expected: 通過。

Run: `npm run test:e2e`
Expected: 全綠(含新 spec)。

- [ ] **步驟 2:啟動 preview 並探測登入狀態**

用 `preview_start` 開預覽,以共用 profile 開頁。已登入 → 直接驗收;未登入 → 告知使用者走 device flow 後再續。

- [ ] **步驟 3:逐項手動驗收(對照 spec 驗收標準)**

1. 冷開(重整頁面):白畫面消失、上次 tasks 立即出現、不閃骨架屏。
2. 背景 reload 完成:畫面無縫換成最新。
3. 模擬 wspc 失敗 / 離線(DevTools 或阻斷 `/api/todo`):畫面守住舊資料、TopNav「未同步」徽章出現;恢復後徽章消失。
4. 登出後重登(或換帳號):不會閃到前一份快取。

每項用 `playwright-cli screenshot --filename` 落地截圖到報告 `assets/`。

- [ ] **步驟 4:寫驗收報告**

依 `.claude/rules/acceptance-report.md` 範本,把報告寫到 `docs/acceptance-reports/2026-07-04-todo-read-swr-cache/`(gitignored),逐項標 PASS/FAIL 並嵌入截圖。

- [ ] **步驟 5:commit(僅程式碼與計畫勾選狀態;報告目錄 gitignored 不入版控)**

```bash
git add docs/superpowers/plans/2026-07-04-todo-read-swr-cache.md
git commit -m "docs(plan): mark todo read SWR cache acceptance done"
```

---

## 自我檢查

- **spec 覆蓋**:持久化範圍(任務 1 partialize)、拆開有資料/正在抓(任務 3 gating)、同步狀態徽章(任務 1 synced + 任務 4 SyncBadge)、登出清快取(任務 2)、四種錯誤情境(任務 1 reload 分支 + 任務 5 e2e)、測試策略(任務 1/2/4 單元、任務 5 e2e、任務 6 手動)—— 皆有對應任務。
- **placeholder 掃描**:無 TBD / 「適當處理」;每個 code 步驟都有完整程式碼。
- **型別一致**:`synced: boolean`、`useTasksStore.persist.clearStorage()`、key `"desk-tasks"`、`partialize: (s) => ({ tasks: s.tasks })` 在各任務間名稱一致。
