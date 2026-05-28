# Slice 0 實作計畫:專案骨架與視覺落地

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標**:建立 `desk` 專案骨架,渲染 Plan 與 Today 兩模式的中高保真版型,desktop + mobile,所有資料寫死 mock,可 `npm run dev` 看到結果。

**架構**:單一 Cloudflare Workers package(`@cloudflare/vite-plugin`),React + TS + Base UI + CSS Modules + Design Tokens(light/dark)。Worker entry 是空殼,UI 直接讀 mock + 純函式衍生。

**Tech Stack**:React 18、TypeScript、Vite、`@cloudflare/vite-plugin`、`@base-ui/react`、TanStack Router、Vitest(只測純函式)、CSS Modules + CSS Custom Properties

**對應 Spec**:[docs/superpowers/specs/2026-05-27-slice-0-design.md](../specs/2026-05-27-slice-0-design.md)

**對應視覺規格**:[docs/claude-design/design_handoff_desk/HANDOFF.md](../../claude-design/design_handoff_desk/HANDOFF.md)

---

## 檔案結構總覽(規劃實作時建立)

```
desk/
├── index.html                          [建立 / 修改]
├── package.json                        [scaffold 建立 + 修改]
├── tsconfig.json                       [scaffold 建立 + 修改]
├── tsconfig.worker.json                [建立]
├── vite.config.ts                      [scaffold 建立 + 修改]
├── wrangler.jsonc                      [scaffold 建立 + 修改]
├── vitest.config.ts                    [建立]
├── .eslintrc.cjs                       [建立]
├── .prettierrc                         [建立]
│
├── worker/
│   └── index.ts                        [scaffold 建立 + 修改]
│
└── src/
    ├── main.tsx                        [scaffold 建立 + 修改]
    ├── app.tsx                         [建立]
    ├── router.tsx                      [建立]
    ├── routes/
    │   ├── __root.tsx                  [建立]
    │   ├── index.tsx                   [建立]   redirect 到 /today
    │   ├── plan.tsx                    [建立]
    │   └── today.tsx                   [建立]
    │
    ├── tokens/                         [全部建立]
    │   ├── index.css
    │   ├── colors.css
    │   ├── space.css
    │   ├── type.css
    │   ├── radius.css
    │   ├── shadow.css
    │   └── motion.css
    │
    ├── lib/                            [全部建立]
    │   ├── types.ts
    │   ├── tasks.ts
    │   ├── tasks.test.ts
    │   ├── theme.ts
    │   ├── theme.test.ts
    │   └── date.ts
    │
    ├── mock/                           [建立]
    │   └── data.ts
    │
    ├── ui/                             [全部建立]
    │   ├── Button/{Button.tsx, Button.module.css, index.ts}
    │   ├── Checkbox/{Checkbox.tsx, Checkbox.module.css, index.ts}
    │   ├── Chip/{Chip.tsx, Chip.module.css, index.ts}
    │   ├── SegmentedControl/{SegmentedControl.tsx, SegmentedControl.module.css, index.ts}
    │   ├── ProgressBar/{ProgressBar.tsx, ProgressBar.module.css, index.ts}
    │   ├── PaperTexture/{PaperTexture.tsx, PaperTexture.module.css, index.ts}
    │   ├── DeskLogo/{DeskLogo.tsx, DeskLogo.module.css, index.ts}
    │   └── index.ts
    │
    ├── features/                       [全部建立]
    │   ├── shell/{TopNav.tsx, TopNav.module.css, ThemeToggle.tsx, ModeToggle.tsx}
    │   ├── carryover/{CarryoverBanner.tsx, CarryoverBanner.module.css}
    │   ├── backlog/{BacklogSection.tsx, BacklogSection.module.css}
    │   ├── month/{MonthColumn.tsx, MonthHeroCard.tsx, MonthDigest.tsx, MonthRow.tsx, *.module.css}
    │   ├── week/{WeekColumn.tsx, WeekRail.tsx, DayChip.tsx, *.module.css}
    │   ├── day/{DayColumn.tsx, Top3Card.tsx, TaskRow.tsx, *.module.css}
    │   └── plan-view/{PlanLayout.tsx, TodayLayout.tsx, *.module.css}
    │
    └── pages/                          [全部建立]
        ├── PlanPage.tsx
        └── TodayPage.tsx
```

---

## Task 1:Scaffold 專案(Cloudflare React + Vite 範本)

**Files:**
- Create: `package.json`, `vite.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `worker/index.ts`, `index.html`, `src/main.tsx`(全部由 scaffold 產生,後續修改)

- [ ] **Step 1.1**:在專案 root 跑 scaffold

注意:`desk/` 目錄已存在(內有 `ROADMAP.md`、`docs/` 等)。Scaffold 會建立新的 `desk/` 子目錄,我們要把內容**搬到當前 root**。

```bash
# 在當前 worktree root 跑
npx --yes create-cloudflare@latest desk-scaffold --framework=react --no-deploy --no-git --type=web-framework
```

預期:`desk-scaffold/` 目錄被建立,內含 `src/`、`worker/`、`package.json`、`vite.config.ts`、`wrangler.jsonc` 等。

- [ ] **Step 1.2**:搬內容到 root,移除 scaffold 目錄

```bash
# 把 scaffold 內容搬到當前目錄(不覆蓋既有的 ROADMAP.md / docs/)
mv desk-scaffold/.gitignore .gitignore.scaffold 2>/dev/null || true
cp -r desk-scaffold/* .
cp -r desk-scaffold/.[!.]* . 2>/dev/null || true
rm -rf desk-scaffold
```

如果有 `.gitignore` 衝突,合併兩份內容(scaffold 的 `node_modules/`、`dist/`、`.wrangler/` 都要保留)。

- [ ] **Step 1.3**:確認檔案結構

預期 root 有以下檔案(scaffold 產生):
- `package.json`
- `vite.config.ts`
- `wrangler.jsonc`(或 `wrangler.json` / `wrangler.toml` — 若是後者要在 Step 1.6 改成 jsonc)
- `tsconfig.json`
- `tsconfig.worker.json`(若 scaffold 沒產,Step 1.7 自己建)
- `worker/index.ts`
- `src/main.tsx`、`src/App.tsx`(會在後面 task 替換掉)
- `index.html`
- `.gitignore`

並確認 `ROADMAP.md`、`docs/` 仍在。

- [ ] **Step 1.4**:`npm install` 然後 `npm run dev` 跑一次,確認能起來

```bash
npm install
npm run dev
```

預期:能看到 Vite + Workers runtime 啟動訊息,瀏覽器訪問 localhost 看到 scaffold 預設頁(Cloudflare logo / React counter 之類)。

按 `Ctrl+C` 停掉 dev server。

- [ ] **Step 1.5**:安裝本專案會用到的相依

```bash
npm install @base-ui-components/react @tanstack/react-router
npm install -D @tanstack/router-plugin @tanstack/router-devtools vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom prettier eslint-config-prettier
```

注意:Base UI npm package 名稱是 `@base-ui-components/react`(不是 `@base-ui/react`,這是 spec 簡寫)。

- [ ] **Step 1.6**:把 `wrangler.toml`(若是)改成 `wrangler.jsonc`

如果 scaffold 產的是 `wrangler.toml`,刪除它並建立 `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "desk",
  "compatibility_date": "2026-05-26",
  "main": "./worker/index.ts",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  }
}
```

如果已經是 `wrangler.jsonc`,確認內容符合上面格式;不符的話改成這樣。

- [ ] **Step 1.7**:確認 `tsconfig.worker.json` 存在,內容類似:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "WebWorker"],
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["worker/**/*.ts"]
}
```

- [ ] **Step 1.8**:設定 Vite plugin(替換 `vite.config.ts`)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 1.9**:加 path alias 到 `tsconfig.json`

確認 `tsconfig.json` 的 `compilerOptions` 有:

```jsonc
{
  "compilerOptions": {
    // ... existing options
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 1.10**:建立 `src/test-setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 1.11**:把 worker entry 改成 spec §9 的空殼

替換 `worker/index.ts`:

```ts
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not implemented", { status: 501 });
    }
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler;
```

- [ ] **Step 1.12**:設定 ESLint + Prettier

建立 `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

`.eslintrc.cjs`(如果 scaffold 已有 eslint.config.js / flat config,留下並加上 prettier):

```cjs
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react-refresh"],
  rules: {
    "react-refresh/only-export-components": "warn",
  },
};
```

- [ ] **Step 1.13**:加 npm scripts

修改 `package.json` 的 `scripts`,確保至少有:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "wrangler dev",
    "deploy": "vite build && wrangler deploy",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint src worker",
    "format": "prettier --write src worker"
  }
}
```

- [ ] **Step 1.14**:再跑一次 `npm run dev` 確認還能起來

```bash
npm run dev
```

預期:能起來。畫面可能是 scaffold 預設(我們還沒改 src/App.tsx),也可能因為 router plugin 還沒有 routes 報錯 — 都先忽略,Ctrl+C。

- [ ] **Step 1.15**:Commit

```bash
git add -A
git commit -m "feat(slice-0): scaffold Cloudflare Vite React project

- npm create cloudflare with React framework
- Install Base UI, TanStack Router, Vitest, testing-library
- Configure wrangler.jsonc with SPA fallback + /api/* worker-first
- Configure vite.config.ts with TanStack Router + Cloudflare plugins
- Worker entry stubbed to return 501 for /api/*
- ESLint + Prettier setup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2:Design Tokens

**Files:**
- Create: `src/tokens/colors.css`, `space.css`, `type.css`, `radius.css`, `shadow.css`, `motion.css`, `index.css`
- Modify: `index.html`(加 Google Fonts link)、`src/main.tsx`(import tokens)

完整 token 規格見 [HANDOFF.md §4](../../claude-design/design_handoff_desk/HANDOFF.md)。下面只列關鍵 token,實作時依 HANDOFF 為準。

- [ ] **Step 2.1**:建立 `src/tokens/space.css`

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-14: 56px;
}
```

- [ ] **Step 2.2**:建立 `src/tokens/type.css`

```css
:root {
  --font-sans: "Geist", "Noto Sans TC", "Inter", -apple-system, system-ui, sans-serif;
  --font-serif: "Newsreader", "Noto Serif TC", "Source Serif 4", Georgia, serif;
  --font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;
  --font-hand: "Caveat", "Comic Sans MS", cursive;

  --text-base-size: 13px;

  --text-2xs: calc(var(--text-base-size) * 0.75);
  --text-xs: calc(var(--text-base-size) * 0.8);
  --text-sm: calc(var(--text-base-size) * 0.9);
  --text-base: var(--text-base-size);
  --text-md: calc(var(--text-base-size) * 1.1);
  --text-lg: calc(var(--text-base-size) * 1.25);
  --text-xl: calc(var(--text-base-size) * 1.5);
  --text-2xl: calc(var(--text-base-size) * 1.875);
  --text-3xl: calc(var(--text-base-size) * 2.5);
  --text-4xl: calc(var(--text-base-size) * 3);
  --text-5xl: calc(var(--text-base-size) * 3.75);
  --text-6xl: calc(var(--text-base-size) * 5);
}
```

- [ ] **Step 2.3**:建立 `src/tokens/radius.css`

```css
:root {
  --radius-none: 0;
  --radius-xs: 3px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 9999px;
}
```

- [ ] **Step 2.4**:建立 `src/tokens/motion.css`

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  --dur-fast: 120ms;
  --dur-base: 180ms;
  --dur-slow: 280ms;

  --breakpoint-tablet: 768px;
}
```

- [ ] **Step 2.5**:建立 `src/tokens/colors.css`(light + dark 兩套)

```css
:root,
[data-theme="light"] {
  --color-paper: oklch(0.965 0.018 78);
  --color-paper-alt: oklch(0.935 0.022 78);
  --color-paper-edge: oklch(0.895 0.026 78);
  --color-ink: oklch(0.24 0.018 50);
  --color-ink-soft: oklch(0.46 0.018 55);
  --color-ink-faint: oklch(0.62 0.018 60);
  --color-rule: oklch(0.85 0.025 75);
  --color-rule-faint: oklch(0.90 0.020 75);

  --color-accent: oklch(0.60 0.13 135);
  --color-accent-soft: oklch(0.93 0.05 135);
  --color-accent-text: oklch(0.42 0.13 135);

  --color-flag: oklch(0.58 0.18 32);
  --color-flag-soft: oklch(0.93 0.08 32);

  --color-carry-bg: oklch(0.94 0.035 80);
  --color-carry-bg-2: oklch(0.90 0.045 80);
  --color-carry-edge: oklch(0.78 0.060 75);
  --color-carry-text: oklch(0.42 0.070 70);
}

[data-theme="dark"] {
  --color-paper: oklch(0.18 0.012 60);
  --color-paper-alt: oklch(0.22 0.014 60);
  --color-paper-edge: oklch(0.14 0.012 60);
  --color-ink: oklch(0.92 0.015 75);
  --color-ink-soft: oklch(0.72 0.015 75);
  --color-ink-faint: oklch(0.55 0.015 75);
  --color-rule: oklch(0.32 0.018 65);
  --color-rule-faint: oklch(0.26 0.015 65);

  --color-accent: oklch(0.70 0.13 135);
  --color-accent-soft: oklch(0.28 0.06 135);
  --color-accent-text: oklch(0.82 0.13 135);

  --color-flag: oklch(0.70 0.18 32);
  --color-flag-soft: oklch(0.32 0.08 32);

  --color-carry-bg: oklch(0.26 0.035 70);
  --color-carry-bg-2: oklch(0.30 0.045 70);
  --color-carry-edge: oklch(0.40 0.060 70);
  --color-carry-text: oklch(0.78 0.070 70);
}
```

- [ ] **Step 2.6**:建立 `src/tokens/shadow.css`

```css
:root {
  --shadow-paper: 0 1px 0 var(--color-rule);
  --shadow-card: 0 1px 0 var(--color-paper-edge), 0 6px 16px oklch(0 0 0 / 0.04);
  --shadow-pop: 0 8px 24px oklch(0 0 0 / 0.12);
  --shadow-focus: 0 0 0 3px oklch(from var(--color-accent) l c h / 0.25);
}
```

- [ ] **Step 2.7**:建立 `src/tokens/index.css`

```css
@import "./colors.css";
@import "./space.css";
@import "./type.css";
@import "./radius.css";
@import "./shadow.css";
@import "./motion.css";

/* Reset + global */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

body {
  background: var(--color-paper-edge);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 2.8**:修改 `index.html`,加 Google Fonts(在 `<head>` 內)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Caveat:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 2.9**:修改 `src/main.tsx`,在最前面 import tokens

```ts
import "@/tokens/index.css";
// ... 其他 import
```

注意:`src/main.tsx` 的其他內容會在 Task 6 router 設好之後再大改,這裡只加 token import。

- [ ] **Step 2.10**:跑 `npm run dev` 確認 body 背景變成 paper-edge 色

```bash
npm run dev
```

預期:瀏覽器訪問,背景變成淡奶油色(light mode)。

- [ ] **Step 2.11**:Commit

```bash
git add -A
git commit -m "feat(slice-0): add design tokens (colors/space/type/radius/shadow/motion)

- 6 token files in src/tokens/ + index.css aggregator
- Light + dark color schemes (OKLCH), [data-theme] switching
- Type scale anchored at --text-base-size: 13px
- Google Fonts loaded via index.html

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3:Types(`src/lib/types.ts`)

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 3.1**:建立 `src/lib/types.ts`

```ts
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

export type TrailKind = "primary" | "forwarded" | "dismissed";

export type Priority = "1" | "2" | "3";

export type Layer = "backlog" | "monthly" | "daily";

export interface TaskCustomFields {
  scheduled_months?: string[];
  scheduled_dates?: string[];
  unscheduled_month?: string;
  unscheduled_at?: string;
  monthly_priority?: Priority;
  daily_priority?: Priority;
  is_adhoc?: "true" | "false";
  done_on?: string;
  position?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  custom_fields: TaskCustomFields;
}

export interface TaskWithTrail {
  task: Task;
  kind: TrailKind;
}
```

- [ ] **Step 3.2**:Commit

```bash
git add src/lib/types.ts
git commit -m "feat(slice-0): add Task type definitions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4:Derivation functions(`src/lib/tasks.ts` with TDD)

**Files:**
- Create: `src/lib/tasks.ts`, `src/lib/tasks.test.ts`

- [ ] **Step 4.1**:寫測試骨架 `src/lib/tasks.test.ts`

```ts
import { describe, it, expect } from "vitest";
import type { Task } from "./types";
import { primaryDate, primaryMonth, layer, tasksOnDate, tasksOnMonth } from "./tasks";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    id: overrides.id,
    title: overrides.title ?? `task-${overrides.id}`,
    status: overrides.status ?? "open",
    created_at: overrides.created_at ?? "2026-05-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-05-01T00:00:00Z",
    custom_fields: overrides.custom_fields ?? {},
    ...overrides,
  };
}

describe("primaryMonth", () => {
  it("returns null when scheduled_months is empty", () => {
    const t = makeTask({ id: "1", custom_fields: {} });
    expect(primaryMonth(t)).toBeNull();
  });

  it("returns last scheduled month when no unscheduled_month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-04", "2026-05"] },
    });
    expect(primaryMonth(t)).toBe("2026-05");
  });

  it("returns null when last <= unscheduled_month (in backlog)", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-04"],
        unscheduled_month: "2026-04",
      },
    });
    expect(primaryMonth(t)).toBeNull();
  });

  it("returns last when re-promoted after unscheduled", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-04", "2026-05"],
        unscheduled_month: "2026-04",
      },
    });
    expect(primaryMonth(t)).toBe("2026-05");
  });
});

describe("primaryDate", () => {
  it("returns null when scheduled_dates is empty", () => {
    const t = makeTask({ id: "1", custom_fields: {} });
    expect(primaryDate(t)).toBeNull();
  });

  it("returns last scheduled date when no unscheduled_at", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_dates: ["2026-05-20", "2026-05-22"] },
    });
    expect(primaryDate(t)).toBe("2026-05-22");
  });

  it("returns null when last <= unscheduled_at (dismissed)", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_dates: ["2026-05-20"],
        unscheduled_at: "2026-05-20",
      },
    });
    expect(primaryDate(t)).toBeNull();
  });
});

describe("layer", () => {
  it("returns 'backlog' when both primaries are null", () => {
    const t = makeTask({ id: "1", custom_fields: {} });
    expect(layer(t)).toBe("backlog");
  });

  it("returns 'monthly' when only primaryMonth is set", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-05"] },
    });
    expect(layer(t)).toBe("monthly");
  });

  it("returns 'daily' when primaryDate is set", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-05"],
        scheduled_dates: ["2026-05-22"],
      },
    });
    expect(layer(t)).toBe("daily");
  });
});

describe("tasksOnDate", () => {
  it("returns empty when no tasks scheduled on date", () => {
    const tasks = [makeTask({ id: "1", custom_fields: {} })];
    expect(tasksOnDate(tasks, "2026-05-22")).toEqual([]);
  });

  it("returns primary when date is last and after unscheduled_at", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_dates: ["2026-05-22"] },
    });
    expect(tasksOnDate([t], "2026-05-22")).toEqual([{ task: t, kind: "primary" }]);
  });

  it("returns forwarded for non-last occurrence", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_dates: ["2026-05-20", "2026-05-22"] },
    });
    expect(tasksOnDate([t], "2026-05-20")).toEqual([{ task: t, kind: "forwarded" }]);
    expect(tasksOnDate([t], "2026-05-22")).toEqual([{ task: t, kind: "primary" }]);
  });

  it("returns dismissed when last equals unscheduled_at", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_dates: ["2026-05-22"],
        unscheduled_at: "2026-05-22",
      },
    });
    expect(tasksOnDate([t], "2026-05-22")).toEqual([{ task: t, kind: "dismissed" }]);
  });
});

describe("tasksOnMonth", () => {
  it("returns primary when month is last and after unscheduled_month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-05"] },
    });
    expect(tasksOnMonth([t], "2026-05")).toEqual([{ task: t, kind: "primary" }]);
  });

  it("returns forwarded for non-last month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-04", "2026-05"] },
    });
    expect(tasksOnMonth([t], "2026-04")).toEqual([{ task: t, kind: "forwarded" }]);
  });

  it("returns dismissed when month equals unscheduled_month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-05"],
        unscheduled_month: "2026-05",
      },
    });
    expect(tasksOnMonth([t], "2026-05")).toEqual([{ task: t, kind: "dismissed" }]);
  });
});
```

- [ ] **Step 4.2**:跑測試確認失敗(因為 `tasks.ts` 還沒寫)

```bash
npm test -- --run
```

預期:所有測試 FAIL,因為 `./tasks` 還不存在或匯出不存在。

- [ ] **Step 4.3**:實作 `src/lib/tasks.ts`

```ts
import type { Task, TaskWithTrail, Layer, TrailKind } from "./types";

export function primaryMonth(t: Task): string | null {
  const arr = t.custom_fields.scheduled_months ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_month ?? "";
  return last > u ? last : null;
}

export function primaryDate(t: Task): string | null {
  const arr = t.custom_fields.scheduled_dates ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_at ?? "";
  return last > u ? last : null;
}

export function layer(t: Task): Layer {
  if (primaryDate(t)) return "daily";
  if (primaryMonth(t)) return "monthly";
  return "backlog";
}

export function tasksOnDate(all: Task[], date: string): TaskWithTrail[] {
  return all
    .filter((t) => t.custom_fields.scheduled_dates?.includes(date))
    .map((t): TaskWithTrail => {
      const arr = t.custom_fields.scheduled_dates!;
      const last = arr[arr.length - 1];
      const u = t.custom_fields.unscheduled_at ?? "";
      let kind: TrailKind;
      if (date === last && last > u) kind = "primary";
      else if (date === last && last === u) kind = "dismissed";
      else kind = "forwarded";
      return { task: t, kind };
    });
}

export function tasksOnMonth(all: Task[], month: string): TaskWithTrail[] {
  return all
    .filter((t) => t.custom_fields.scheduled_months?.includes(month))
    .map((t): TaskWithTrail => {
      const arr = t.custom_fields.scheduled_months!;
      const last = arr[arr.length - 1];
      const u = t.custom_fields.unscheduled_month ?? "";
      let kind: TrailKind;
      if (month === last && last > u) kind = "primary";
      else if (month === last && last === u) kind = "dismissed";
      else kind = "forwarded";
      return { task: t, kind };
    });
}

export function tasksInBacklog(all: Task[]): Task[] {
  return all.filter((t) => layer(t) === "backlog" && t.status !== "done" && t.status !== "cancelled");
}
```

- [ ] **Step 4.4**:跑測試確認 PASS

```bash
npm test -- --run
```

預期:所有測試 PASS。

- [ ] **Step 4.5**:Commit

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat(slice-0): derivation functions for task layer/trail

- primaryMonth / primaryDate / layer pure functions
- tasksOnDate / tasksOnMonth with TrailKind classification
- tasksInBacklog helper
- Full vitest coverage for all functions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5:Theme hook(`src/lib/theme.ts` with TDD)

**Files:**
- Create: `src/lib/theme.ts`, `src/lib/theme.test.ts`

- [ ] **Step 5.1**:寫測試 `src/lib/theme.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./theme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  it("defaults to 'auto' preference", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.pref).toBe("auto");
  });

  it("loads saved pref from localStorage", () => {
    localStorage.setItem("desk.theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.pref).toBe("dark");
    expect(result.current.resolved).toBe("dark");
  });

  it("setPref persists to localStorage and updates data-theme", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setPref("light");
    });
    expect(localStorage.getItem("desk.theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("auto resolves to dark when prefers-color-scheme is dark", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe("dark");
  });
});
```

- [ ] **Step 5.2**:跑測試確認失敗

```bash
npm test -- --run theme.test
```

預期:FAIL(找不到 `./theme`)。

- [ ] **Step 5.3**:實作 `src/lib/theme.ts`

```ts
import { useCallback, useEffect, useState } from "react";

export type ThemePref = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "desk.theme";

function readPref(): ThemePref {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "auto") return v;
  return "auto";
}

function resolveAuto(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(pref: ThemePref): ResolvedTheme {
  return pref === "auto" ? resolveAuto() : pref;
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
}

export function useTheme(): {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref(p: ThemePref): void;
} {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readPref()));

  // Apply on mount + when pref changes
  useEffect(() => {
    const r = resolve(pref);
    setResolved(r);
    applyTheme(r);
  }, [pref]);

  // Listen for system theme change when pref === auto
  useEffect(() => {
    if (pref !== "auto" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = resolveAuto();
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(STORAGE_KEY, p);
    setPrefState(p);
  }, []);

  return { pref, resolved, setPref };
}
```

- [ ] **Step 5.4**:跑測試確認 PASS

```bash
npm test -- --run theme.test
```

預期:全部 PASS。

- [ ] **Step 5.5**:Commit

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat(slice-0): useTheme hook (auto/light/dark + localStorage)

- Persist preference at desk.theme key
- Auto resolves via prefers-color-scheme
- Apply via [data-theme] attribute on documentElement
- Listen for system theme change when pref=auto

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6:Date utilities(`src/lib/date.ts`)

**Files:**
- Create: `src/lib/date.ts`

- [ ] **Step 6.1**:建立 `src/lib/date.ts`

```ts
/** Returns ISO date string YYYY-MM-DD in local time. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns YYYY-MM in local time. */
export function currentMonthISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Returns array of 7 ISO dates for the week containing `date` (Mon-Sun). */
export function weekOf(date: string): string[] {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const next = new Date(monday);
    next.setDate(monday.getDate() + i);
    out.push(todayISO(next));
  }
  return out;
}

/** Returns ISO week number (1-53) for a given date. */
export function isoWeek(date: string): number {
  const d = new Date(date + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

/** Returns formatted month name in English short form, e.g. "May 2026". */
export function formatMonth(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[m - 1]} ${y}`;
}

/** Returns short weekday name in English: "Mon" / "Tue" / ... */
export function shortWeekday(date: string): string {
  const d = new Date(date + "T00:00:00");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

/** Returns day-of-month number, e.g. 22. */
export function dayOfMonth(date: string): number {
  return Number(date.split("-")[2]);
}
```

- [ ] **Step 6.2**:Commit(date utility 是輔助、Slice 0 用得少,不寫測試)

```bash
git add src/lib/date.ts
git commit -m "feat(slice-0): date utilities (today/weekOf/isoWeek/format)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7:Mock data(`src/mock/data.ts`)

**Files:**
- Create: `src/mock/data.ts`

- [ ] **Step 7.1**:建立 `src/mock/data.ts`

固定使用今天為 `2026-05-22`(週五),本月為 `2026-05`,以保證 mock 可重現:

```ts
import type { Task } from "@/lib/types";

export const MOCK_TODAY = "2026-05-22";
export const MOCK_THIS_MONTH = "2026-05";

function task(o: Partial<Task> & { id: string; title: string }): Task {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    status: o.status ?? "open",
    parent_id: o.parent_id ?? null,
    created_at: o.created_at ?? "2026-05-01T00:00:00Z",
    updated_at: o.updated_at ?? "2026-05-01T00:00:00Z",
    custom_fields: o.custom_fields ?? {},
  };
}

export const allTasks: Task[] = [
  // ---- Backlog (3 個) ----
  task({
    id: "b1",
    title: "整理書架",
    custom_fields: {},
  }),
  task({
    id: "b2",
    title: "學一個新樂器",
    custom_fields: {},
  }),
  task({
    id: "b3",
    title: "規劃秋季旅行",
    description: "想去日本東北",
    custom_fields: {},
  }),

  // ---- 本月 Top3 ----
  task({
    id: "m1",
    title: "推出 desk.yurenju.me MVP",
    description: "todo · 日曆 · mail 三合一",
    custom_fields: {
      scheduled_months: ["2026-05"],
      monthly_priority: "1",
      is_adhoc: "false",
    },
  }),
  task({
    id: "m2",
    title: "完成個人簡歷網站改版",
    description: "新 portfolio + 寫作分類",
    custom_fields: {
      scheduled_months: ["2026-05"],
      monthly_priority: "2",
      is_adhoc: "false",
    },
  }),
  task({
    id: "m3",
    title: "寫完 WSPC 整合技術筆記",
    description: "含 custom fields 範例",
    custom_fields: {
      scheduled_months: ["2026-05"],
      monthly_priority: "3",
      is_adhoc: "false",
    },
  }),

  // ---- 本月其他計劃內(5 個) ----
  task({
    id: "m4",
    title: "整理 2026 Q2 OKR",
    status: "done",
    custom_fields: {
      scheduled_months: ["2026-05"],
      is_adhoc: "false",
      done_on: "2026-05-05T18:00:00Z",
    },
  }),
  task({
    id: "m5",
    title: "讀完《Deep Work》最後三章",
    custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
  }),
  task({
    id: "m6",
    title: "規劃 7 月家庭旅行行程",
    custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
  }),
  task({
    id: "m7",
    title: "部落格更新 2 篇",
    custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
  }),
  task({
    id: "m8",
    title: "健身:每週 3 次",
    custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
  }),

  // ---- 本月計劃外(2 個,1 個 done) ----
  task({
    id: "m9",
    title: "修復 yurenju.me 部署 bug",
    status: "done",
    custom_fields: {
      scheduled_months: ["2026-05"],
      is_adhoc: "true",
      done_on: "2026-05-19T10:00:00Z",
    },
  }),
  task({
    id: "m10",
    title: "幫 J 看履歷",
    custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "true" },
  }),

  // ---- 今日 Top3 ----
  task({
    id: "d1",
    title: "完成 desk.yurenju.me todo MVP demo",
    description: "對應月度任務:推出 desk.yurenju.me MVP",
    parent_id: "m1",
    custom_fields: {
      scheduled_months: ["2026-05"],
      scheduled_dates: ["2026-05-22"],
      daily_priority: "1",
      is_adhoc: "false",
    },
  }),
  task({
    id: "d2",
    title: "寫週報 + 5 月中檢視",
    custom_fields: {
      scheduled_months: ["2026-05"],
      scheduled_dates: ["2026-05-22"],
      daily_priority: "2",
      is_adhoc: "false",
    },
  }),
  task({
    id: "d3",
    title: "retro:整理本週學習+下週主題",
    custom_fields: {
      scheduled_dates: ["2026-05-22"],
      daily_priority: "3",
      is_adhoc: "false",
    },
  }),

  // ---- 今日其他計劃內(2 個,1 個 done) ----
  task({
    id: "d4",
    title: "1hr 健身",
    status: "done",
    custom_fields: {
      scheduled_dates: ["2026-05-22"],
      is_adhoc: "false",
      done_on: "2026-05-22T07:30:00Z",
    },
  }),
  task({
    id: "d5",
    title: "讀 WSPC custom fields 文件",
    custom_fields: {
      scheduled_dates: ["2026-05-22"],
      is_adhoc: "false",
    },
  }),

  // ---- 今日計劃外(1 個) ----
  task({
    id: "d6",
    title: "回覆 Acme 客戶整合詢問",
    custom_fields: {
      scheduled_dates: ["2026-05-22"],
      is_adhoc: "true",
    },
  }),

  // ---- 順延軌跡範例 ----
  task({
    id: "t1",
    title: "回信給設計師",
    custom_fields: {
      scheduled_dates: ["2026-05-20", "2026-05-22"],
      is_adhoc: "false",
    },
  }),

  // ---- 略過軌跡範例 ----
  task({
    id: "t2",
    title: "整理舊照片",
    custom_fields: {
      scheduled_dates: ["2026-05-21"],
      unscheduled_at: "2026-05-21",
      is_adhoc: "false",
    },
  }),

  // ---- 為了讓週欄每天有內容,本週其他天也加些 task ----
  task({
    id: "w-mon",
    title: "打通 todo CRUD",
    status: "done",
    custom_fields: {
      scheduled_dates: ["2026-05-18"],
      daily_priority: "1",
      done_on: "2026-05-18T17:00:00Z",
    },
  }),
  task({
    id: "w-tue",
    title: "月/週/日骨架",
    status: "done",
    custom_fields: {
      scheduled_dates: ["2026-05-19"],
      daily_priority: "1",
      done_on: "2026-05-19T17:00:00Z",
    },
  }),
  task({
    id: "w-wed",
    title: "調查 IMAP gateway",
    status: "done",
    custom_fields: {
      scheduled_dates: ["2026-05-20"],
      daily_priority: "1",
      done_on: "2026-05-20T17:00:00Z",
    },
  }),
  task({
    id: "w-thu",
    title: "草稿:BFF 架構",
    status: "done",
    custom_fields: {
      scheduled_dates: ["2026-05-21"],
      daily_priority: "1",
      done_on: "2026-05-21T17:00:00Z",
    },
  }),
  task({
    id: "w-sat",
    title: "公園野餐",
    custom_fields: { scheduled_dates: ["2026-05-23"], daily_priority: "1" },
  }),
  task({
    id: "w-sun",
    title: "週計畫",
    custom_fields: { scheduled_dates: ["2026-05-24"], daily_priority: "1" },
  }),
];

/** Carryover banner mock content. */
export const MOCK_CARRYOVER_DAY = {
  fromDate: "2026-05-21",
  count: 3,
};

export const MOCK_CARRYOVER_MONTH = {
  fromMonth: "2026-04",
  count: 2,
};
```

- [ ] **Step 7.2**:Commit

```bash
git add src/mock/data.ts
git commit -m "feat(slice-0): mock data covering all task layers and trail kinds

- 3 backlog, 3 monthly top3 + 5 other (incl. 1 done) + 2 adhoc (incl. 1 done)
- 3 daily top3, 2 other (incl. 1 done), 1 adhoc, 1 forwarded, 1 dismissed
- Weekday fillers for week column
- Carryover mock constants
- Fixed today = 2026-05-22 (Friday)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8:Router 與 root layout

**Files:**
- Create: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/plan.tsx`, `src/routes/today.tsx`, `src/router.tsx`, `src/app.tsx`
- Modify: `src/main.tsx`

TanStack Router 使用 file-based routing(由 `TanStackRouterVite` plugin 在 dev 時 codegen)。檔案位置在 `src/routes/`。

- [ ] **Step 8.1**:建立 `src/routes/__root.tsx`

```tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TopNav } from "@/features/shell/TopNav";

export const Route = createRootRoute({
  component: () => (
    <>
      <TopNav />
      <Outlet />
    </>
  ),
});
```

- [ ] **Step 8.2**:建立 `src/routes/index.tsx`(redirect 到 /today)

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/today" });
  },
});
```

- [ ] **Step 8.3**:建立 `src/routes/plan.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/pages/PlanPage";

export const Route = createFileRoute("/plan")({
  component: PlanPage,
});
```

- [ ] **Step 8.4**:建立 `src/routes/today.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { TodayPage } from "@/pages/TodayPage";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});
```

- [ ] **Step 8.5**:建立 `src/app.tsx`

```tsx
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

export function App() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 8.6**:建立 `src/router.tsx`

```tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

注意:`routeTree.gen.ts` 由 `TanStackRouterVite` plugin 自動產生,第一次 `npm run dev` 時會生成。

- [ ] **Step 8.7**:替換 `src/main.tsx`

```tsx
import "@/tokens/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8.8**:暫時建立 placeholder `src/pages/PlanPage.tsx` 與 `TodayPage.tsx`

```tsx
// src/pages/PlanPage.tsx
export function PlanPage() {
  return <div style={{ padding: 24 }}>Plan mode (placeholder)</div>;
}
```

```tsx
// src/pages/TodayPage.tsx
export function TodayPage() {
  return <div style={{ padding: 24 }}>Today mode (placeholder)</div>;
}
```

- [ ] **Step 8.9**:暫時建立 placeholder `src/features/shell/TopNav.tsx`

```tsx
// src/features/shell/TopNav.tsx
export function TopNav() {
  return (
    <nav style={{ padding: 16, borderBottom: "1px solid var(--color-rule)" }}>
      desk (placeholder TopNav)
    </nav>
  );
}
```

- [ ] **Step 8.10**:跑 `npm run dev`,確認三條路由都通

```bash
npm run dev
```

預期:
- `/` 自動轉到 `/today`
- `/plan` 顯示 "Plan mode (placeholder)"
- `/today` 顯示 "Today mode (placeholder)"
- 頂部有 "desk (placeholder TopNav)"

- [ ] **Step 8.11**:Commit

```bash
git add -A
git commit -m "feat(slice-0): TanStack Router setup with /plan and /today routes

- File-based routing in src/routes/
- / redirects to /today
- Placeholder PlanPage, TodayPage, TopNav (to be replaced)
- routeTree.gen.ts auto-generated by Vite plugin

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9:UI primitive — Button

**Files:**
- Create: `src/ui/Button/Button.tsx`, `Button.module.css`, `index.ts`

- [ ] **Step 9.1**:建立 `src/ui/Button/Button.tsx`

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ghost", size = "md", className, children, ...rest },
  ref,
) {
  const cls = [styles.btn, styles[`v_${variant}`], styles[`s_${size}`], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} className={cls} {...rest}>
      {children}
    </button>
  );
});
```

- [ ] **Step 9.2**:建立 `src/ui/Button/Button.module.css`

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.btn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.s_sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
}

.s_md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-base);
}

.v_primary {
  background: var(--color-accent);
  color: var(--color-paper);
}

.v_primary:hover {
  background: var(--color-accent-text);
}

.v_ghost {
  background: transparent;
  color: var(--color-ink);
}

.v_ghost:hover {
  background: var(--color-paper-alt);
}

.v_danger {
  background: transparent;
  color: var(--color-flag);
  border-color: var(--color-flag-soft);
}

.v_danger:hover {
  background: var(--color-flag-soft);
}
```

- [ ] **Step 9.3**:建立 `src/ui/Button/index.ts`

```ts
export { Button, type ButtonProps } from "./Button";
```

- [ ] **Step 9.4**:Commit

```bash
git add src/ui/Button
git commit -m "feat(slice-0): Button primitive (primary/ghost/danger × sm/md)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10:UI primitive — Checkbox(hand-drawn ✓)

**Files:**
- Create: `src/ui/Checkbox/Checkbox.tsx`, `Checkbox.module.css`, `index.ts`

對應 HANDOFF §5.2:Caveat 字體 ✓ + 旋轉 -8deg。

- [ ] **Step 10.1**:建立 `src/ui/Checkbox/Checkbox.tsx`

```tsx
import { forwardRef } from "react";
import { Checkbox as BaseCheckbox } from "@base-ui-components/react/checkbox";
import styles from "./Checkbox.module.css";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  variant?: "primary" | "accent";
  className?: string;
  "aria-label"?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { variant = "primary", className, ...rest },
  ref,
) {
  return (
    <BaseCheckbox.Root
      ref={ref}
      className={[styles.root, styles[`v_${variant}`], className].filter(Boolean).join(" ")}
      {...rest}
    >
      <BaseCheckbox.Indicator className={styles.indicator}>
        <span className={styles.mark}>✓</span>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
});
```

- [ ] **Step 10.2**:建立 `src/ui/Checkbox/Checkbox.module.css`

```css
.root {
  width: 22px;
  height: 22px;
  border: 1.5px solid var(--color-rule);
  border-radius: var(--radius-xs);
  background: var(--color-paper);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.root:hover {
  border-color: var(--color-ink-faint);
}

.root[data-checked="true"] {
  background: var(--color-ink);
  border-color: var(--color-ink);
}

.v_accent.root[data-checked="true"] {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.mark {
  font-family: var(--font-hand);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-paper);
  line-height: 1;
  transform: rotate(-8deg) translate(0.5px, -1px);
}

.root:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

- [ ] **Step 10.3**:建立 `src/ui/Checkbox/index.ts`

```ts
export { Checkbox, type CheckboxProps } from "./Checkbox";
```

- [ ] **Step 10.4**:Commit

```bash
git add src/ui/Checkbox
git commit -m "feat(slice-0): Checkbox primitive with hand-drawn ✓ (Caveat, -8deg)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11:UI primitive — Chip(UnplannedChip / PlannedRefChip / GenericChip)

**Files:**
- Create: `src/ui/Chip/Chip.tsx`, `Chip.module.css`, `index.ts`

- [ ] **Step 11.1**:建立 `src/ui/Chip/Chip.tsx`

```tsx
import type { ReactNode } from "react";
import styles from "./Chip.module.css";

export interface ChipProps {
  variant: "unplanned" | "plannedRef" | "neutral";
  children: ReactNode;
  className?: string;
}

export function Chip({ variant, children, className }: ChipProps) {
  return (
    <span
      className={[styles.chip, styles[`v_${variant}`], className].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}

export function UnplannedChip({ label = "+ 計劃外" }: { label?: string }) {
  return <Chip variant="unplanned">{label}</Chip>;
}

export function PlannedRefChip({ order }: { order: "1" | "2" | "3" }) {
  return <Chip variant="plannedRef">{order}</Chip>;
}
```

- [ ] **Step 11.2**:建立 `src/ui/Chip/Chip.module.css`

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.v_unplanned {
  background: var(--color-flag-soft);
  color: var(--color-flag);
}

.v_plannedRef {
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  min-width: 22px;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.v_neutral {
  background: var(--color-paper-alt);
  color: var(--color-ink-soft);
}
```

- [ ] **Step 11.3**:建立 `src/ui/Chip/index.ts`

```ts
export { Chip, UnplannedChip, PlannedRefChip, type ChipProps } from "./Chip";
```

- [ ] **Step 11.4**:Commit

```bash
git add src/ui/Chip
git commit -m "feat(slice-0): Chip primitives (unplanned/plannedRef/neutral)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12:UI primitive — SegmentedControl

**Files:**
- Create: `src/ui/SegmentedControl/SegmentedControl.tsx`, `.module.css`, `index.ts`

用於 ModeToggle 與 ThemeToggle。

- [ ] **Step 12.1**:建立 `src/ui/SegmentedControl/SegmentedControl.tsx`

```tsx
import { ToggleGroup } from "@base-ui-components/react/toggle-group";
import { Toggle } from "@base-ui-components/react/toggle";
import type { ReactNode } from "react";
import styles from "./SegmentedControl.module.css";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: SegmentedControlOption<T>[];
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values) => {
        const next = values[0];
        if (next && next !== value) onValueChange(next as T);
      }}
      aria-label={ariaLabel}
      className={[styles.root, styles[`s_${size}`], className].filter(Boolean).join(" ")}
    >
      {options.map((opt) => (
        <Toggle key={opt.value} value={opt.value} className={styles.item}>
          {opt.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
```

- [ ] **Step 12.2**:建立 `src/ui/SegmentedControl/SegmentedControl.module.css`

```css
.root {
  display: inline-flex;
  background: var(--color-paper-alt);
  border-radius: var(--radius-pill);
  padding: 3px;
  gap: 2px;
}

.item {
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  font-weight: 600;
  color: var(--color-ink-soft);
  border-radius: var(--radius-pill);
  transition: background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.s_md .item {
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
}

.s_sm .item {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}

.item[data-pressed="true"] {
  background: var(--color-accent);
  color: var(--color-paper);
}

.item:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

- [ ] **Step 12.3**:建立 `src/ui/SegmentedControl/index.ts`

```ts
export { SegmentedControl, type SegmentedControlProps, type SegmentedControlOption } from "./SegmentedControl";
```

- [ ] **Step 12.4**:Commit

```bash
git add src/ui/SegmentedControl
git commit -m "feat(slice-0): SegmentedControl (Base UI ToggleGroup wrapper)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13:UI primitive — ProgressBar

**Files:**
- Create: `src/ui/ProgressBar/ProgressBar.tsx`, `.module.css`, `index.ts`

- [ ] **Step 13.1**:建立 `src/ui/ProgressBar/ProgressBar.tsx`

```tsx
import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  value: number; // 0-1
  variant?: "accent" | "ink";
  ariaLabel?: string;
  className?: string;
}

export function ProgressBar({ value, variant = "accent", ariaLabel, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={[styles.track, className].filter(Boolean).join(" ")}
    >
      <div className={[styles.fill, styles[`v_${variant}`]].join(" ")} style={{ width: `${pct}%` }} />
    </div>
  );
}
```

- [ ] **Step 13.2**:建立 `src/ui/ProgressBar/ProgressBar.module.css`

```css
.track {
  position: relative;
  width: 100%;
  height: 3px;
  background: var(--color-rule-faint);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width var(--dur-slow) var(--ease-out);
}

.v_accent {
  background: var(--color-accent);
}

.v_ink {
  background: var(--color-ink-soft);
}
```

- [ ] **Step 13.3**:建立 `src/ui/ProgressBar/index.ts`

```ts
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";
```

- [ ] **Step 13.4**:Commit

```bash
git add src/ui/ProgressBar
git commit -m "feat(slice-0): ProgressBar primitive

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14:UI primitive — PaperTexture

**Files:**
- Create: `src/ui/PaperTexture/PaperTexture.tsx`, `.module.css`, `index.ts`

- [ ] **Step 14.1**:建立 `src/ui/PaperTexture/PaperTexture.tsx`

```tsx
import styles from "./PaperTexture.module.css";

export interface PaperTextureProps {
  opacity?: number;
  className?: string;
}

export function PaperTexture({ opacity = 0.4, className }: PaperTextureProps) {
  return (
    <svg
      aria-hidden
      className={[styles.overlay, className].filter(Boolean).join(" ")}
      style={{ opacity }}
    >
      <filter id="paper-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-noise)" />
    </svg>
  );
}
```

- [ ] **Step 14.2**:建立 `src/ui/PaperTexture/PaperTexture.module.css`

```css
.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  mix-blend-mode: multiply;
}
```

- [ ] **Step 14.3**:建立 `src/ui/PaperTexture/index.ts`

```ts
export { PaperTexture, type PaperTextureProps } from "./PaperTexture";
```

- [ ] **Step 14.4**:Commit

```bash
git add src/ui/PaperTexture
git commit -m "feat(slice-0): PaperTexture (SVG fractal-noise overlay)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15:UI primitive — DeskLogo

**Files:**
- Create: `src/ui/DeskLogo/DeskLogo.tsx`, `.module.css`, `index.ts`

- [ ] **Step 15.1**:建立 `src/ui/DeskLogo/DeskLogo.tsx`

```tsx
import styles from "./DeskLogo.module.css";

export interface DeskLogoProps {
  showWordmark?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function DeskLogo({ showWordmark = true, size = "md", className }: DeskLogoProps) {
  return (
    <div className={[styles.root, styles[`s_${size}`], className].filter(Boolean).join(" ")}>
      <NotebookMark className={styles.mark} />
      {showWordmark && <span className={styles.wordmark}>desk</span>}
    </div>
  );
}

function NotebookMark({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="26"
      viewBox="0 0 22 26"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect x="3" y="2" width="18" height="22" rx="1.5" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="1.5" />
      <line x1="3" y1="2" x2="3" y2="24" stroke="var(--color-flag)" strokeWidth="2" />
      <circle cx="3" cy="6" r="1" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="0.8" />
      <circle cx="3" cy="13" r="1" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="0.8" />
      <circle cx="3" cy="20" r="1" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="0.8" />
    </svg>
  );
}
```

- [ ] **Step 15.2**:建立 `src/ui/DeskLogo/DeskLogo.module.css`

```css
.root {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.mark {
  flex-shrink: 0;
}

.wordmark {
  font-family: var(--font-serif);
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--color-ink);
}

.s_md .wordmark {
  font-size: var(--text-xl);
}

.s_sm .wordmark {
  font-size: var(--text-md);
}
```

- [ ] **Step 15.3**:建立 `src/ui/DeskLogo/index.ts`

```ts
export { DeskLogo, type DeskLogoProps } from "./DeskLogo";
```

- [ ] **Step 15.4**:建立 `src/ui/index.ts`(re-export 所有 primitives)

```ts
export * from "./Button";
export * from "./Checkbox";
export * from "./Chip";
export * from "./SegmentedControl";
export * from "./ProgressBar";
export * from "./PaperTexture";
export * from "./DeskLogo";
```

- [ ] **Step 15.5**:Commit

```bash
git add src/ui
git commit -m "feat(slice-0): DeskLogo (notebook mark + serif wordmark) + ui/index.ts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16:TopNav(Brand + ModeToggle + ThemeToggle)

**Files:**
- Create: `src/features/shell/ModeToggle.tsx`, `ThemeToggle.tsx`, `TopNav.module.css`
- Modify: `src/features/shell/TopNav.tsx`(替換 placeholder)

- [ ] **Step 16.1**:建立 `src/features/shell/ModeToggle.tsx`

```tsx
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SegmentedControl } from "@/ui/SegmentedControl";

type Mode = "plan" | "today";

export function ModeToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const current: Mode = location.pathname.startsWith("/plan") ? "plan" : "today";

  return (
    <SegmentedControl<Mode>
      value={current}
      onValueChange={(v) => navigate({ to: v === "plan" ? "/plan" : "/today" })}
      ariaLabel="Mode"
      options={[
        { value: "plan", label: "規劃" },
        { value: "today", label: "今天" },
      ]}
    />
  );
}
```

- [ ] **Step 16.2**:建立 `src/features/shell/ThemeToggle.tsx`

```tsx
import { useTheme, type ThemePref } from "@/lib/theme";
import { SegmentedControl } from "@/ui/SegmentedControl";

export function ThemeToggle() {
  const { pref, setPref } = useTheme();

  return (
    <SegmentedControl<ThemePref>
      value={pref}
      onValueChange={setPref}
      size="sm"
      ariaLabel="Theme"
      options={[
        { value: "auto", label: "Auto" },
        { value: "light", label: "亮" },
        { value: "dark", label: "暗" },
      ]}
    />
  );
}
```

- [ ] **Step 16.3**:替換 `src/features/shell/TopNav.tsx`

```tsx
import { DeskLogo } from "@/ui/DeskLogo";
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
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 16.4**:建立 `src/features/shell/TopNav.module.css`

```css
.root {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: var(--space-3) var(--space-6);
  background: var(--color-paper);
  border-bottom: 1px solid var(--color-rule);
}

.brand {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.subdomain {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--color-ink-faint);
  letter-spacing: 0.04em;
}

.mode {
  display: flex;
  justify-content: center;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .root {
    grid-template-columns: 1fr;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
  }
  .subdomain {
    display: none;
  }
}
```

- [ ] **Step 16.5**:跑 `npm run dev`,驗證 TopNav

```bash
npm run dev
```

預期:
- 頂部出現 desk logo + subdomain + [規劃 | 今天] segmented control + theme toggle
- 點 [規劃] / [今天] 切換 URL
- 點 theme toggle 切 light / dark / auto,背景色 / 文字色變化

- [ ] **Step 16.6**:Commit

```bash
git add -A
git commit -m "feat(slice-0): TopNav with ModeToggle and ThemeToggle

- ModeToggle uses router to switch /plan ↔ /today
- ThemeToggle drives useTheme hook (auto/light/dark)
- DeskLogo + subdomain on left
- Mobile: stacks vertically, hides subdomain

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17:CarryoverBanner(靜態示意)

**Files:**
- Create: `src/features/carryover/CarryoverBanner.tsx`, `.module.css`

- [ ] **Step 17.1**:建立 `src/features/carryover/CarryoverBanner.tsx`

```tsx
import styles from "./CarryoverBanner.module.css";

export interface CarryoverBannerProps {
  /** 例:從昨天 / 從上月 */
  fromLabel: string;
  /** 例:5/21(四)有 3 件沒做完 */
  summary: string;
  /** 例:3 */
  count: number;
  /** 例:["→ 三件事", "→ 計劃內", "略過"] */
  actions: [string, string, string];
}

export function CarryoverBanner({ fromLabel, summary, count, actions }: CarryoverBannerProps) {
  return (
    <div className={styles.root}>
      <div className={styles.icon} aria-hidden>
        ↩
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          {fromLabel} · <strong>{count} 件待處理</strong>
        </div>
        <div className={styles.summary}>{summary}</div>
      </div>
      <div className={styles.actions}>
        {actions.map((a, i) => (
          <button key={i} type="button" className={styles.action} disabled>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 17.2**:建立 `src/features/carryover/CarryoverBanner.module.css`

```css
.root {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-carry-bg);
  border: 1px dashed var(--color-carry-edge);
  border-radius: var(--radius-sm);
  color: var(--color-carry-text);
}

.icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-carry-bg-2);
  border-radius: var(--radius-pill);
  font-size: var(--text-md);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-carry-text);
  opacity: 0.85;
}

.summary {
  font-family: var(--font-serif);
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--color-ink);
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.action {
  background: transparent;
  border: 1px solid var(--color-carry-edge);
  color: var(--color-carry-text);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  cursor: not-allowed;
  opacity: 0.7;
}

@media (max-width: 767px) {
  .root {
    grid-template-columns: auto 1fr;
  }
  .actions {
    grid-column: 1 / -1;
    flex-wrap: wrap;
  }
}
```

- [ ] **Step 17.3**:Commit

```bash
git add src/features/carryover
git commit -m "feat(slice-0): CarryoverBanner (static, buttons disabled)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18:TaskRow + Top3Card

**Files:**
- Create: `src/features/day/TaskRow.tsx`, `TaskRow.module.css`, `Top3Card.tsx`, `Top3Card.module.css`

- [ ] **Step 18.1**:建立 `src/features/day/TaskRow.tsx`

```tsx
import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import styles from "./TaskRow.module.css";

export interface TaskRowProps {
  task: Task;
  kind: TrailKind;
  /** Plan/Today/Month 三層用同一 row,但是否顯示 adhoc chip 由呼叫者決定 */
  showAdhocChip?: boolean;
}

export function TaskRow({ task, kind, showAdhocChip }: TaskRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";

  return (
    <div className={[styles.row, styles[`k_${kind}`], isDone && styles.done].filter(Boolean).join(" ")}>
      <Checkbox checked={isDone} disabled />
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{task.title}</span>
          {kind === "forwarded" && <span className={styles.trail}>↪ 已順延</span>}
          {kind === "dismissed" && <span className={styles.trail}>· 已略過</span>}
        </div>
        {task.description && <div className={styles.desc}>{task.description}</div>}
      </div>
      {showAdhocChip && isAdhoc && <UnplannedChip />}
    </div>
  );
}
```

- [ ] **Step 18.2**:建立 `src/features/day/TaskRow.module.css`

```css
.row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.titleRow {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.title {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--color-ink);
}

.desc {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-ink-soft);
}

.trail {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
}

.done .title {
  color: var(--color-ink-faint);
  text-decoration: line-through;
}

.k_forwarded .title,
.k_dismissed .title {
  color: var(--color-ink-faint);
}

.k_dismissed .title {
  text-decoration: line-through;
}
```

- [ ] **Step 18.3**:建立 `src/features/day/Top3Card.tsx`

```tsx
import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { PlannedRefChip } from "@/ui/Chip";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  tasks: Task[]; // ordered by priority 1, 2, 3
  title: string;
  variant?: "accent" | "plain";
  /** 顯示「對應月度任務:xxx」這種 link reference */
  showParentRef?: boolean;
  parentTitleById?: Record<string, string>;
}

export function Top3Card({
  tasks,
  title,
  variant = "accent",
  showParentRef,
  parentTitleById,
}: Top3CardProps) {
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.list}>
        {tasks.map((t) => {
          const order = (t.custom_fields.daily_priority ?? t.custom_fields.monthly_priority) as
            | "1"
            | "2"
            | "3"
            | undefined;
          const parentTitle =
            showParentRef && t.parent_id && parentTitleById ? parentTitleById[t.parent_id] : null;
          return (
            <li key={t.id} className={styles.item}>
              {order && <span className={styles.ring}>{order}</span>}
              <div className={styles.itemBody}>
                <div className={styles.itemTitle}>{t.title}</div>
                {parentTitle && (
                  <div className={styles.parentRef}>
                    <PlannedRefChip order={order ?? "1"} />
                    <span className={styles.parentRefText}>{parentTitle}</span>
                  </div>
                )}
              </div>
              <Checkbox variant="accent" checked={t.status === "done"} disabled />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 18.4**:建立 `src/features/day/Top3Card.module.css`

```css
.card {
  border-radius: var(--radius-sm);
  padding: var(--space-4);
}

.v_accent {
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent);
}

.v_plain {
  background: var(--color-paper);
  border: 1px solid var(--color-rule);
}

.heading {
  margin: 0 0 var(--space-3) 0;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-accent-text);
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: var(--space-3);
}

.ring {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-paper);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.itemBody {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.itemTitle {
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--color-ink);
}

.parentRef {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-ink-soft);
}

.parentRefText {
  font-family: var(--font-sans);
}
```

- [ ] **Step 18.5**:Commit

```bash
git add src/features/day
git commit -m "feat(slice-0): TaskRow (3 kinds) + Top3Card with ring

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19:DayColumn(Plan 第三欄 + Today 主視圖共用)

**Files:**
- Create: `src/features/day/DayColumn.tsx`, `DayColumn.module.css`

- [ ] **Step 19.1**:建立 `src/features/day/DayColumn.tsx`

```tsx
import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { dayOfMonth, shortWeekday } from "@/lib/date";
import { TaskRow } from "./TaskRow";
import { Top3Card } from "./Top3Card";
import styles from "./DayColumn.module.css";

export interface DayColumnProps {
  allTasks: Task[];
  selectedDate: string;
  variant: "plan-narrow" | "today-hero";
}

export function DayColumn({ allTasks, selectedDate, variant }: DayColumnProps) {
  const entries = useMemo(() => tasksOnDate(allTasks, selectedDate), [allTasks, selectedDate]);

  const primary = entries.filter((e) => e.kind === "primary");

  const top3 = primary
    .filter((e) => e.task.custom_fields.daily_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.daily_priority) - Number(b.task.custom_fields.daily_priority),
    )
    .map((e) => e.task);

  const otherPlanned = primary
    .filter((e) => !e.task.custom_fields.daily_priority && e.task.custom_fields.is_adhoc !== "true");

  const adhoc = primary.filter((e) => e.task.custom_fields.is_adhoc === "true");

  const trails = entries.filter((e) => e.kind !== "primary");

  // parent title lookup for Top3 link references
  const parentTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of allTasks) map[t.id] = t.title;
    return map;
  }, [allTasks]);

  return (
    <div className={[styles.col, styles[`v_${variant}`]].join(" ")}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          {shortWeekday(selectedDate).toUpperCase()} · {variant === "today-hero" ? "今天" : ""}
        </div>
        <h2 className={styles.bigDate}>
          {monthShort(selectedDate)} {dayOfMonth(selectedDate)}
        </h2>
      </div>

      {top3.length > 0 && (
        <Top3Card
          tasks={top3}
          title="今天最重要的三件事"
          variant="accent"
          showParentRef
          parentTitleById={parentTitleById}
        />
      )}

      {otherPlanned.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            其他計劃內 <span className={styles.count}>{otherPlanned.length}</span>
          </header>
          {otherPlanned.map((e) => (
            <TaskRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}

      {adhoc.length > 0 && (
        <section className={styles.section}>
          <header className={[styles.sectionHead, styles.adhocHead].join(" ")}>
            今天臨時加的 <span className={styles.count}>{adhoc.length}</span>
          </header>
          {adhoc.map((e) => (
            <TaskRow key={e.task.id} task={e.task} kind={e.kind} showAdhocChip />
          ))}
        </section>
      )}

      {trails.length > 0 && (
        <section className={styles.section}>
          {trails.map((e) => (
            <TaskRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}
    </div>
  );
}

function monthShort(iso: string): string {
  const [, m] = iso.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[m - 1];
}
```

- [ ] **Step 19.2**:建立 `src/features/day/DayColumn.module.css`

```css
.col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-paper);
  border-radius: var(--radius-sm);
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
}

.bigDate {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  letter-spacing: -0.04em;
  color: var(--color-ink);
  line-height: 0.95;
}

.v_plan-narrow .bigDate {
  font-size: var(--text-3xl);
}

.v_today-hero .bigDate {
  font-size: var(--text-6xl);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sectionHead {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-ink-soft);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--color-rule-faint);
}

.count {
  font-family: var(--font-mono);
  font-weight: 400;
  color: var(--color-ink-faint);
}

.adhocHead {
  color: var(--color-flag);
}
```

- [ ] **Step 19.3**:Commit

```bash
git add src/features/day
git commit -m "feat(slice-0): DayColumn (Plan-narrow + Today-hero variants)

- Renders top3, other-planned, adhoc, trails sections
- Variant controls hero date size

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20:Backlog section + Month components

**Files:**
- Create: `src/features/backlog/BacklogSection.tsx`, `.module.css`, `src/features/month/MonthColumn.tsx`, `MonthHeroCard.tsx`, `MonthRow.tsx`, `MonthDigest.tsx` 及其 css

- [ ] **Step 20.1**:建立 `src/features/backlog/BacklogSection.tsx`

```tsx
import { useState } from "react";
import type { Task } from "@/lib/types";
import { tasksInBacklog } from "@/lib/tasks";
import { TaskRow } from "@/features/day/TaskRow";
import styles from "./BacklogSection.module.css";

export interface BacklogSectionProps {
  allTasks: Task[];
  defaultOpen?: boolean;
}

export function BacklogSection({ allTasks, defaultOpen = false }: BacklogSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const items = tasksInBacklog(allTasks);

  return (
    <section className={styles.root}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.icon}>📥</span>
        <span className={styles.label}>Backlog</span>
        <span className={styles.count}>({items.length})</span>
        <span className={styles.chevron}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className={styles.list}>
          {items.map((t) => (
            <TaskRow key={t.id} task={t} kind="primary" />
          ))}
          {items.length === 0 && <div className={styles.empty}>Backlog 是空的</div>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 20.2**:建立 `src/features/backlog/BacklogSection.module.css`

```css
.root {
  border: 1px dashed var(--color-rule);
  border-radius: var(--radius-sm);
  background: var(--color-paper-alt);
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  background: transparent;
  border: none;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-ink-soft);
  text-align: left;
}

.head:hover {
  color: var(--color-ink);
}

.icon {
  font-size: var(--text-md);
}

.label {
  font-weight: 600;
}

.count {
  font-family: var(--font-mono);
  color: var(--color-ink-faint);
}

.chevron {
  margin-left: auto;
}

.list {
  padding: 0 var(--space-4) var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 0;
}

.empty {
  padding: var(--space-2) 0;
  color: var(--color-ink-faint);
  font-size: var(--text-sm);
}
```

- [ ] **Step 20.3**:建立 `src/features/month/MonthHeroCard.tsx`

```tsx
import type { Task } from "@/lib/types";
import { Top3Card } from "@/features/day/Top3Card";

export interface MonthHeroCardProps {
  top3: Task[];
}

export function MonthHeroCard({ top3 }: MonthHeroCardProps) {
  return <Top3Card tasks={top3} title="本月最重要的三件事" variant="plain" />;
}
```

- [ ] **Step 20.4**:建立 `src/features/month/MonthRow.tsx`

```tsx
import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import styles from "./MonthRow.module.css";

export interface MonthRowProps {
  task: Task;
  kind: TrailKind;
}

export function MonthRow({ task, kind }: MonthRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";

  return (
    <div className={[styles.row, isDone && styles.done].filter(Boolean).join(" ")}>
      <Checkbox checked={isDone} disabled />
      <span className={styles.title}>{task.title}</span>
      {kind === "forwarded" && <span className={styles.trail}>↪</span>}
      {kind === "dismissed" && <span className={styles.trail}>·略過</span>}
      {isAdhoc && <UnplannedChip />}
    </div>
  );
}
```

- [ ] **Step 20.5**:建立 `src/features/month/MonthRow.module.css`

```css
.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);
}

.title {
  flex: 1;
  color: var(--color-ink);
}

.done .title {
  color: var(--color-ink-faint);
  text-decoration: line-through;
}

.trail {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--color-ink-faint);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
```

- [ ] **Step 20.6**:建立 `src/features/month/MonthColumn.tsx`

```tsx
import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnMonth } from "@/lib/tasks";
import { formatMonth } from "@/lib/date";
import { BacklogSection } from "@/features/backlog/BacklogSection";
import { MonthHeroCard } from "./MonthHeroCard";
import { MonthRow } from "./MonthRow";
import styles from "./MonthColumn.module.css";

export interface MonthColumnProps {
  allTasks: Task[];
  month: string; // "YYYY-MM"
}

export function MonthColumn({ allTasks, month }: MonthColumnProps) {
  const entries = useMemo(() => tasksOnMonth(allTasks, month), [allTasks, month]);
  const primary = entries.filter((e) => e.kind === "primary");

  const top3 = primary
    .filter((e) => e.task.custom_fields.monthly_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.monthly_priority) -
        Number(b.task.custom_fields.monthly_priority),
    )
    .map((e) => e.task);

  const otherPlanned = primary.filter(
    (e) => !e.task.custom_fields.monthly_priority && e.task.custom_fields.is_adhoc !== "true",
  );
  const adhoc = primary.filter((e) => e.task.custom_fields.is_adhoc === "true");
  const trails = entries.filter((e) => e.kind !== "primary");

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>MONTH · 規劃</div>
        <h2 className={styles.title}>{formatMonth(month)}</h2>
      </header>

      <BacklogSection allTasks={allTasks} />

      {top3.length > 0 && <MonthHeroCard top3={top3} />}

      {otherPlanned.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>其他計劃內</header>
          {otherPlanned.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}

      {adhoc.length > 0 && (
        <section className={styles.section}>
          <header className={[styles.sectionHead, styles.adhocHead].join(" ")}>計劃外</header>
          {adhoc.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}

      {trails.length > 0 && (
        <section className={styles.section}>
          {trails.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 20.7**:建立 `src/features/month/MonthColumn.module.css`

```css
.col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-paper);
  border-radius: var(--radius-sm);
}

.head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
}

.title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-3xl);
  font-weight: 500;
  letter-spacing: -0.04em;
  color: var(--color-ink);
  line-height: 1.05;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sectionHead {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-ink-soft);
  padding-bottom: var(--space-1);
  margin-bottom: var(--space-1);
  border-bottom: 1px solid var(--color-rule-faint);
}

.adhocHead {
  color: var(--color-flag);
}
```

- [ ] **Step 20.8**:建立 `src/features/month/MonthDigest.tsx`

```tsx
import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnMonth } from "@/lib/tasks";
import { formatMonth, dayOfMonth } from "@/lib/date";
import { ProgressBar } from "@/ui/ProgressBar";
import { Top3Card } from "@/features/day/Top3Card";
import { MonthRow } from "./MonthRow";
import styles from "./MonthDigest.module.css";

export interface MonthDigestProps {
  allTasks: Task[];
  month: string;
  today: string;
}

export function MonthDigest({ allTasks, month, today }: MonthDigestProps) {
  const entries = useMemo(() => tasksOnMonth(allTasks, month), [allTasks, month]);
  const primary = entries.filter((e) => e.kind === "primary");

  const top3 = primary
    .filter((e) => e.task.custom_fields.monthly_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.monthly_priority) -
        Number(b.task.custom_fields.monthly_priority),
    )
    .map((e) => e.task);

  const others = primary.filter((e) => !e.task.custom_fields.monthly_priority);

  // 月份進度:今天 / 該月天數
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const dayN = dayOfMonth(today);
  const pct = dayN / daysInMonth;

  const completed = primary.filter((e) => e.task.status === "done").length;

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>MONTH</div>
        <h3 className={styles.title}>{formatMonth(month)}</h3>
        <div className={styles.meta}>
          DAY {dayN} / {daysInMonth}
        </div>
      </header>

      <div className={styles.progressRow}>
        <ProgressBar value={pct} ariaLabel="本月進度" />
        <div className={styles.progressLabel}>
          月份過了 {Math.round(pct * 100)}%,計劃內已完成 {completed}/{primary.length}
        </div>
      </div>

      {top3.length > 0 && <Top3Card tasks={top3} title="本月三件大事" variant="plain" />}

      {others.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>其他 ({others.length})</header>
          {others.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 20.9**:建立 `src/features/month/MonthDigest.module.css`

```css
.col {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-paper);
  border-radius: var(--radius-sm);
}

.head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
}

.title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-2xl);
  font-weight: 500;
  letter-spacing: -0.04em;
  color: var(--color-ink);
}

.meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-ink-faint);
  letter-spacing: 0.04em;
}

.progressRow {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.progressLabel {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-ink-soft);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sectionHead {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-ink-soft);
  padding-bottom: var(--space-1);
  margin-bottom: var(--space-1);
  border-bottom: 1px solid var(--color-rule-faint);
}
```

- [ ] **Step 20.10**:Commit

```bash
git add src/features/backlog src/features/month
git commit -m "feat(slice-0): BacklogSection + MonthColumn + MonthDigest

- BacklogSection: collapsible, defaults closed
- MonthColumn: Plan mode left col (Backlog + MonthHero + others + adhoc + trails)
- MonthDigest: Today mode right col (compact, progress bar)
- MonthRow: compact row used by both

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21:Week components(WeekColumn / WeekRail / DayChip)

**Files:**
- Create: `src/features/week/WeekColumn.tsx`, `WeekRail.tsx`, `DayChip.tsx`, 及其 css

- [ ] **Step 21.1**:建立 `src/features/week/WeekColumn.tsx`

```tsx
import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek } from "@/lib/date";
import styles from "./WeekColumn.module.css";

export interface WeekColumnProps {
  allTasks: Task[];
  selectedDate: string;
}

export function WeekColumn({ allTasks, selectedDate }: WeekColumnProps) {
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>WEEK · 規劃</div>
        <h2 className={styles.title}>第 {isoWeek(selectedDate)} 週</h2>
        <div className={styles.meta}>
          {dayOfMonth(week[0])}/{Number(week[0].slice(5, 7))} – {dayOfMonth(week[6])}/
          {Number(week[6].slice(5, 7))} · 每日三件事
        </div>
      </header>

      <ul className={styles.list}>
        {week.map((date) => {
          const entries = tasksOnDate(allTasks, date);
          const primary = entries.filter((e) => e.kind === "primary");
          const top3 = primary
            .filter((e) => e.task.custom_fields.daily_priority)
            .sort(
              (a, b) =>
                Number(a.task.custom_fields.daily_priority) -
                Number(b.task.custom_fields.daily_priority),
            )
            .slice(0, 3);
          const isSelected = date === selectedDate;
          return (
            <li
              key={date}
              className={[styles.day, isSelected && styles.selected].filter(Boolean).join(" ")}
            >
              <div className={styles.dayBox}>
                <div className={styles.dayNum}>{dayOfMonth(date)}</div>
                <div className={styles.dayWk}>{shortWeekday(date).toUpperCase()}</div>
              </div>
              <ol className={styles.tasks}>
                {top3.map((e, i) => (
                  <li
                    key={e.task.id}
                    className={[styles.task, e.task.status === "done" && styles.done]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className={styles.taskOrder}>{i + 1}.</span> {e.task.title}
                  </li>
                ))}
                {top3.length === 0 && <li className={styles.empty}>—</li>}
              </ol>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 21.2**:建立 `src/features/week/WeekColumn.module.css`

```css
.col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-paper);
  border-radius: var(--radius-sm);
}

.head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
}

.title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-3xl);
  font-weight: 500;
  letter-spacing: -0.04em;
  color: var(--color-ink);
  line-height: 1.05;
}

.meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-ink-faint);
  letter-spacing: 0.04em;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.day {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-rule-faint);
}

.day:first-child {
  border-top: none;
}

.selected {
  background: var(--color-accent-soft);
  border-radius: var(--radius-sm);
  padding-left: var(--space-3);
  padding-right: var(--space-3);
  border-top: none;
}

.selected + .day {
  border-top: none;
}

.dayBox {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--font-serif);
  color: var(--color-ink);
}

.dayNum {
  font-size: var(--text-xl);
  font-weight: 500;
  line-height: 1;
}

.dayWk {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--color-ink-faint);
  letter-spacing: 0.04em;
  margin-top: 2px;
}

.tasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.task {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-ink);
}

.taskOrder {
  font-family: var(--font-mono);
  color: var(--color-ink-faint);
  margin-right: var(--space-1);
}

.done {
  color: var(--color-ink-faint);
  text-decoration: line-through;
}

.empty {
  color: var(--color-ink-faint);
  font-size: var(--text-sm);
}
```

- [ ] **Step 21.3**:建立 `src/features/week/WeekRail.tsx`

```tsx
import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek } from "@/lib/date";
import styles from "./WeekRail.module.css";

export interface WeekRailProps {
  allTasks: Task[];
  selectedDate: string;
  today: string;
}

export function WeekRail({ allTasks, selectedDate, today }: WeekRailProps) {
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  return (
    <aside className={styles.rail}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>WEEK {isoWeek(selectedDate)}</div>
        <div className={styles.range}>
          {dayOfMonth(week[0])}/{Number(week[0].slice(5, 7))} – {dayOfMonth(week[6])}/
          {Number(week[6].slice(5, 7))}
        </div>
      </header>

      <ul className={styles.list}>
        {week.map((date) => {
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const entries = tasksOnDate(allTasks, date);
          const primary = entries.filter((e) => e.kind === "primary");
          const top3 = primary
            .filter((e) => e.task.custom_fields.daily_priority)
            .sort(
              (a, b) =>
                Number(a.task.custom_fields.daily_priority) -
                Number(b.task.custom_fields.daily_priority),
            )
            .slice(0, 3);
          return (
            <li
              key={date}
              className={[
                styles.day,
                isSelected && styles.selected,
                isToday && styles.today,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.dayHeader}>
                <span className={styles.num}>{dayOfMonth(date)}</span>
                <span className={styles.wk}>{shortWeekday(date).toUpperCase()}</span>
                {isToday && <span className={styles.todayTag}>今天</span>}
              </div>
              <ul className={styles.tasks}>
                {top3.map((e) => (
                  <li
                    key={e.task.id}
                    className={[styles.task, e.task.status === "done" && styles.done]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {e.task.title}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 21.4**:建立 `src/features/week/WeekRail.module.css`

```css
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
}

.head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--color-ink-faint);
}

.range {
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--color-ink);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.day {
  padding-left: var(--space-3);
  border-left: 2px solid transparent;
}

.day.selected {
  border-left-color: var(--color-accent);
}

.dayHeader {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.num {
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  color: var(--color-ink);
}

.wk {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  letter-spacing: 0.04em;
  color: var(--color-ink-faint);
}

.todayTag {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--color-accent-text);
  letter-spacing: 0.04em;
}

.tasks {
  list-style: none;
  margin: 2px 0 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.task {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-ink-soft);
}

.done {
  text-decoration: line-through;
  color: var(--color-ink-faint);
}
```

- [ ] **Step 21.5**:建立 `src/features/week/DayChip.tsx`(mobile WeekRail 用)

```tsx
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { dayOfMonth, shortWeekday } from "@/lib/date";
import styles from "./DayChip.module.css";

export interface DayChipProps {
  date: string;
  today: string;
  selected: boolean;
  allTasks: Task[];
}

export function DayChip({ date, today, selected, allTasks }: DayChipProps) {
  const count = tasksOnDate(allTasks, date).filter((e) => e.kind === "primary").length;
  const isToday = date === today;
  return (
    <div
      className={[
        styles.chip,
        selected && styles.selected,
        isToday && styles.today,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.wk}>{shortWeekday(date).toUpperCase()}</div>
      <div className={styles.num}>{dayOfMonth(date)}</div>
      <div className={styles.count}>{count} 件</div>
    </div>
  );
}
```

- [ ] **Step 21.6**:建立 `src/features/week/DayChip.module.css`

```css
.chip {
  width: 56px;
  flex-shrink: 0;
  background: var(--color-paper);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.wk {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  letter-spacing: 0.04em;
  color: var(--color-ink-faint);
}

.num {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-ink);
  line-height: 1;
}

.count {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--color-ink-soft);
}

.today {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}

.today .num,
.today .wk {
  color: var(--color-accent-text);
}

.selected {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 21.7**:Commit

```bash
git add src/features/week
git commit -m "feat(slice-0): WeekColumn + WeekRail + DayChip

- WeekColumn: Plan mode middle col (7 days × top3)
- WeekRail: Today mode left col (vertical day stack)
- DayChip: mobile Today bottom horizontal chip

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22:Page layouts(PlanLayout、PlanPage、TodayPage)

**Files:**
- Create: `src/features/plan-view/PlanLayout.tsx`, `TodayLayout.tsx`, 各自的 css
- Modify: `src/pages/PlanPage.tsx`, `TodayPage.tsx`(替換 placeholder)

- [ ] **Step 22.1**:建立 `src/features/plan-view/PlanLayout.tsx`

```tsx
import { useState } from "react";
import type { Task } from "@/lib/types";
import { CarryoverBanner } from "@/features/carryover/CarryoverBanner";
import { MonthColumn } from "@/features/month/MonthColumn";
import { WeekColumn } from "@/features/week/WeekColumn";
import { DayColumn } from "@/features/day/DayColumn";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { MOCK_CARRYOVER_MONTH } from "@/mock/data";
import styles from "./PlanLayout.module.css";

export interface PlanLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  month: string;
}

type MobileTab = "month" | "week" | "day";

export function PlanLayout({ allTasks, selectedDate, month }: PlanLayoutProps) {
  const [tab, setTab] = useState<MobileTab>("month");

  return (
    <main className={styles.page}>
      <CarryoverBanner
        fromLabel="從上月延續"
        summary={`${MOCK_CARRYOVER_MONTH.fromMonth} 沒做完的任務`}
        count={MOCK_CARRYOVER_MONTH.count}
        actions={["→ 本月三件事", "→ 本月其他", "丟回 backlog"]}
      />

      {/* Desktop: three columns; Mobile: tab switcher */}
      <div className={styles.mobileTabs}>
        <SegmentedControl<MobileTab>
          value={tab}
          onValueChange={setTab}
          size="sm"
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
          ]}
        />
      </div>

      <div className={styles.grid}>
        <div className={[styles.cell, tab !== "month" && styles.mobileHidden].filter(Boolean).join(" ")}>
          <MonthColumn allTasks={allTasks} month={month} />
        </div>
        <div className={[styles.cell, tab !== "week" && styles.mobileHidden].filter(Boolean).join(" ")}>
          <WeekColumn allTasks={allTasks} selectedDate={selectedDate} />
        </div>
        <div className={[styles.cell, tab !== "day" && styles.mobileHidden].filter(Boolean).join(" ")}>
          <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="plan-narrow" />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 22.2**:建立 `src/features/plan-view/PlanLayout.module.css`

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

.mobileTabs {
  display: none;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-4);
}

.cell {
  min-width: 0;
}

@media (max-width: 767px) {
  .page {
    padding: var(--space-3) var(--space-4);
  }
  .mobileTabs {
    display: flex;
    justify-content: center;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .mobileHidden {
    display: none;
  }
}
```

- [ ] **Step 22.3**:建立 `src/features/plan-view/TodayLayout.tsx`

```tsx
import type { Task } from "@/lib/types";
import { CarryoverBanner } from "@/features/carryover/CarryoverBanner";
import { WeekRail } from "@/features/week/WeekRail";
import { DayColumn } from "@/features/day/DayColumn";
import { MonthDigest } from "@/features/month/MonthDigest";
import { DayChip } from "@/features/week/DayChip";
import { weekOf } from "@/lib/date";
import { MOCK_CARRYOVER_DAY } from "@/mock/data";
import styles from "./TodayLayout.module.css";

export interface TodayLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  today: string;
  month: string;
}

export function TodayLayout({ allTasks, selectedDate, today, month }: TodayLayoutProps) {
  const week = weekOf(selectedDate);

  return (
    <main className={styles.page}>
      <CarryoverBanner
        fromLabel="從昨天延續"
        summary={`${MOCK_CARRYOVER_DAY.fromDate.slice(5)}(四)有 ${MOCK_CARRYOVER_DAY.count} 件沒做完`}
        count={MOCK_CARRYOVER_DAY.count}
        actions={["→ 三件事", "→ 計劃內", "略過"]}
      />

      <div className={styles.grid}>
        <aside className={[styles.cell, styles.left].join(" ")}>
          <WeekRail allTasks={allTasks} selectedDate={selectedDate} today={today} />
        </aside>
        <section className={[styles.cell, styles.center].join(" ")}>
          <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="today-hero" />
        </section>
        <aside className={[styles.cell, styles.right].join(" ")}>
          <MonthDigest allTasks={allTasks} month={month} today={today} />
        </aside>
      </div>

      {/* Mobile: horizontal day chips at bottom */}
      <div className={styles.mobileChips}>
        {week.map((date) => (
          <DayChip
            key={date}
            date={date}
            today={today}
            selected={date === selectedDate}
            allTasks={allTasks}
          />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 22.4**:建立 `src/features/plan-view/TodayLayout.module.css`

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

.grid {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: var(--space-4);
}

.cell {
  min-width: 0;
}

.mobileChips {
  display: none;
}

@media (max-width: 767px) {
  .page {
    padding: var(--space-3) var(--space-4);
    padding-bottom: var(--space-12);
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .left {
    display: none;
  }
  .right {
    order: 99;
  }
  .mobileChips {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding: var(--space-3) 0;
    position: sticky;
    bottom: 0;
    background: var(--color-paper-edge);
  }
}
```

- [ ] **Step 22.5**:替換 `src/pages/PlanPage.tsx`

```tsx
import { PlanLayout } from "@/features/plan-view/PlanLayout";
import { allTasks, MOCK_TODAY, MOCK_THIS_MONTH } from "@/mock/data";

export function PlanPage() {
  return <PlanLayout allTasks={allTasks} selectedDate={MOCK_TODAY} month={MOCK_THIS_MONTH} />;
}
```

- [ ] **Step 22.6**:替換 `src/pages/TodayPage.tsx`

```tsx
import { TodayLayout } from "@/features/plan-view/TodayLayout";
import { allTasks, MOCK_TODAY, MOCK_THIS_MONTH } from "@/mock/data";

export function TodayPage() {
  return (
    <TodayLayout
      allTasks={allTasks}
      selectedDate={MOCK_TODAY}
      today={MOCK_TODAY}
      month={MOCK_THIS_MONTH}
    />
  );
}
```

- [ ] **Step 22.7**:跑 `npm run dev`,做完整視覺檢查

```bash
npm run dev
```

確認下列項目:

- [ ] `/today` 顯示完整 Today mode 三欄
- [ ] `/plan` 顯示完整 Plan mode 三欄
- [ ] Plan mode 中欄 Week 的 22 號(週五)有 selected 樣式
- [ ] Today mode 中欄是 May 22 大字
- [ ] 月度 Top3 顯示三件、計劃內 5 件、計劃外 2 件(其中已完成的有刪除線)
- [ ] 今日 Top3 顯示三件、計劃內 2 件(含 1 件已完成)、計劃外 1 件(紅 chip)
- [ ] 軌跡 task(`t1` 順延、`t2` 略過)顯示對應樣式
- [ ] Backlog 摺疊頭顯示 "Backlog (3)",點擊展開顯示 3 個 backlog task,再點摺疊
- [ ] CarryoverBanner 顯示,按鈕看起來 disabled
- [ ] TopNav [規劃 \| 今天] 切換正常
- [ ] ThemeToggle 切 Light / Dark 全頁顏色變化正確
- [ ] 縮窗到 mobile (< 768px):
  - Plan mode 出現 [Month / Week / Day] tab,一次顯示一欄
  - Today mode WeekRail 消失,底部出現 7 個 DayChip 水平排
- [ ] Hand-drawn ✓ 在已完成的 Checkbox 上顯示(Caveat 字體 + 旋轉)
- [ ] DeskLogo 的紅色裝訂線 + 三孔顯示

如果有視覺問題,在當下 fix(調 CSS / token)然後繼續。

- [ ] **Step 22.8**:Commit

```bash
git add -A
git commit -m "feat(slice-0): PlanLayout + TodayLayout + page integration

- PlanPage uses PlanLayout (Monthly+Week+SelectedDay)
- TodayPage uses TodayLayout (WeekRail+DayColumn+MonthDigest)
- Mobile: Plan uses tab switcher; Today shows bottom DayChip rail
- CarryoverBanner mounted at top of both modes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 23:Acceptance 驗證 + build / lint 通過

**Files:**
- (無新增,只做驗證)

- [ ] **Step 23.1**:跑 lint

```bash
npm run lint
```

預期:無 error;有 warning 看情況決定要不要處理。

- [ ] **Step 23.2**:跑測試全集

```bash
npm test -- --run
```

預期:全部 PASS。

- [ ] **Step 23.3**:跑 build

```bash
npm run build
```

預期:無 TS error,輸出到 `dist/`。

- [ ] **Step 23.4**:跑 wrangler preview 驗證 production-like 環境

```bash
npm run preview
```

預期:能訪問 localhost 看到完整 app。Ctrl+C 停。

- [ ] **Step 23.5**:逐項對照 spec §10 Acceptance Criteria

對照 [docs/superpowers/specs/2026-05-27-slice-0-design.md §10](../specs/2026-05-27-slice-0-design.md),把所有 acceptance bullet 跑一次,若有不符,當下 fix 並 commit。

- [ ] **Step 23.6**:Format + 最終 commit

```bash
npm run format
git add -A
git diff --cached --quiet || git commit -m "chore(slice-0): final format pass + acceptance verification

All Slice 0 acceptance criteria from spec §10 verified.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 完成

Slice 0 結束時:

- `npm run dev` 起得來,localhost 看到完整 desk 兩模式視覺
- 視覺中高保真度,desktop + mobile 都有版型
- Mock data 涵蓋所有任務狀態與軌跡樣式
- 程式碼骨架就位:tokens、types、derivation function、router、UI primitives、features、pages
- 無 mutation、無 WSPC、無 auth — 為 Slice 1+ 接手做好準備

下一步:由 `superpowers:finishing-a-development-branch` 處理 PR / merge,或直接進 Slice 1 brainstorming。
