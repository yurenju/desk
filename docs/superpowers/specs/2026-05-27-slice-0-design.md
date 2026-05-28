# Slice 0 設計文件:專案骨架與視覺落地

**日期**:2026-05-27
**對應 ROADMAP 階段**:第一階段 Slice 0
**狀態**:設計確認完畢,待寫實作計畫

---

## 1. 範圍總覽

### 目標

建立 `desk` 專案骨架,渲染兩種模式(Plan / Today)的中高保真版型,desktop 與 mobile 都有,所有資料寫死 mock。**不**接 WSPC、**不**做 task mutation。

這是專案第一個可以 `npm run dev` 看到的版本。目的是在沒有任何後端干擾下,確認設計 token、版型、視覺語言對不對,**為後續 slice 提供穩定的視覺基礎**。

### 完成的單一畫面

| Route | 內容 |
|---|---|
| `/` | 自動轉址到 `/today` |
| `/plan` | Plan mode 三欄:Monthly(含 Backlog 摺疊區)/ Week / Selected Day |
| `/today` | Today mode 三欄:WeekRail / DayView / MonthDigest |

兩個 route 頂部都有 TopNav([規劃 \| 今天] SegmentedControl + ThemeToggle)與一條 hard-coded CarryoverBanner。

### 非目標

- Task CRUD(新增 / 編輯 / 刪除 / 完成切換)
- 拖曳排序與跨欄移動
- Plan mode 點 Week 切第三欄的互動(只有靜態示意)
- CarryoverBanner 的三個動作按鈕(只是視覺)
- WSPC / API 呼叫(`worker/index.ts` 是空殼,`/api/*` 一律回 501)
- Auth / Cookie
- Zustand 或其他 state store(只有 theme preference 用 localStorage)
- Motion 動畫(只用 CSS transition 處理 hover)
- 自動化測試
- 年規劃、月底 review 介面、鍵盤快捷鍵、設定頁、空狀態、錯誤狀態、載入骨架

---

## 2. 技術選型

| 層 | 決定 | 備註 |
|---|---|---|
| Scaffold | `npm create cloudflare@latest -- desk --framework=react` | Cloudflare 官方範本起手 |
| Package manager | **npm** | 無 monorepo 需求,pnpm workspaces 用不到;與 Cloudflare 範本對齊 |
| Framework | React 18 + TypeScript + Vite | |
| Vite plugin | `@cloudflare/vite-plugin` | client + worker 同一個 dev server、同一 port、HMR 跨兩端 |
| Primitives | Base UI(`@base-ui/react`) | 不使用 Tailwind、不使用 shadcn |
| Styling | CSS Modules + CSS Custom Properties | |
| Tokens | `src/tokens/*.css`;light + dark 兩套,`[data-theme]` 切換 | 對應 HANDOFF §4 |
| Router | TanStack Router | type-safe params,未來 `/plan/2026-05` 之類加 param 更順 |
| State | 不引入 Zustand;theme preference 用 localStorage + hook | YAGNI,Slice 1 有 mutation 時再加 |
| Animation | 不引入 motion;hover 用 CSS transition | YAGNI |
| Cloudflare config | `wrangler.jsonc`(非 `wrangler.toml`) | Cloudflare 現行慣例 |
| Worker(Slice 0) | `worker/index.ts` 存在但 `/api/*` 一律回 501 | Vite plugin 需要 worker entry 存在,Slice 2 才填內容 |
| Fonts | Google Fonts via `<link>`(Geist / Newsreader / Caveat / Noto Sans TC / Noto Serif TC) | |
| Testing | 不寫測試,Slice 1+ 補 | |
| Lint / Format | ESLint + Prettier | 標準 TS 設定,不過度客製 |

### BFF 架構決定

採單一 package(方案 X),非 monorepo。理由:

1. **Cloudflare Workers 是唯一後端,沒有跨 host 部署需求** — 個人專案不需「換 host」彈性
2. **BFF 模式天然吃同源** — Slice 2 寫加密 HttpOnly Cookie + Device Flow 時,client 跟 worker 同源能省 CORS / cookie SameSite 一堆雷
3. **共用 code 會頻繁** — `Task` types、derivation function 將來 client 跟 worker 都會用,單 package 直接 import,比 monorepo workspace package 簡單
4. **與 Cloudflare 官方範本對齊** — `@cloudflare/vite-plugin` 的設計就是為這個結構

---

## 3. 目錄結構

對齊 Cloudflare 官方範本(`worker/` 在根目錄、`src/` 是 React client):

```
desk/
├── index.html
├── package.json
├── tsconfig.json              # client (DOM lib)
├── tsconfig.worker.json       # worker (WebWorker lib)
├── vite.config.ts             # @cloudflare/vite-plugin
├── wrangler.jsonc
├── .eslintrc.cjs
├── .prettierrc
├── ROADMAP.md                 # 已存在
├── docs/                      # 已存在
│
├── worker/
│   └── index.ts               # 空殼:/api/* → 501,其他走 asset fallback
│
└── src/                       # React client
    ├── main.tsx               # router 啟動 + theme provider 掛載
    ├── app.tsx                # router root layout
    │
    ├── tokens/
    │   ├── index.css          # @import 全部
    │   ├── colors.css         # light + dark
    │   ├── space.css
    │   ├── type.css
    │   ├── radius.css
    │   ├── shadow.css
    │   └── motion.css
    │
    ├── lib/
    │   ├── theme.ts           # useTheme(auto / light / dark + localStorage)
    │   ├── date.ts            # 月/週/日邊界(Slice 0 用最少)
    │   ├── types.ts           # Task, TaskStatus, TrailKind 等
    │   └── tasks.ts           # primaryDate / primaryMonth / layer / tasksOnDate / tasksOnMonth
    │
    ├── mock/
    │   └── data.ts            # mock DeskTask[]
    │
    ├── ui/                    # 設計系統(Base UI 包裝 + 自寫)
    │   ├── Button/
    │   ├── Checkbox/          # hand-drawn ✓ 變體
    │   ├── Chip/              # UnplannedChip / PlannedRefChip / GenericChip
    │   ├── SegmentedControl/  # ModeToggle 與 ThemeToggle 共用
    │   ├── ProgressBar/
    │   ├── PaperTexture/      # SVG fractal-noise 疊層
    │   ├── DeskLogo/
    │   └── index.ts
    │
    ├── features/
    │   ├── shell/
    │   │   └── TopNav.tsx     # Brand / ModeToggle / ThemeToggle
    │   ├── carryover/
    │   │   └── CarryoverBanner.tsx
    │   ├── backlog/
    │   │   └── BacklogSection.tsx       # Monthly 欄頂部摺疊區
    │   ├── month/
    │   │   ├── MonthColumn.tsx          # Plan mode 用
    │   │   ├── MonthHeroCard.tsx
    │   │   ├── MonthDigest.tsx          # Today mode 右欄用
    │   │   └── MonthRow.tsx
    │   ├── week/
    │   │   ├── WeekColumn.tsx           # Plan mode 中欄(7 天總覽)
    │   │   ├── WeekRail.tsx             # Today mode 左欄
    │   │   └── DayChip.tsx              # mobile Today 用
    │   ├── day/
    │   │   ├── DayColumn.tsx            # Plan mode 第三欄 + Today mode 主視圖共用,接 selectedDate prop
    │   │   ├── Top3Card.tsx             # 環形 1/2/3 標記
    │   │   └── TaskRow.tsx              # primary / forwarded / dismissed 三種樣式
    │   └── plan-view/
    │       └── PlanLayout.tsx           # 三欄組合
    │
    └── pages/
        ├── PlanPage.tsx                 # /plan
        └── TodayPage.tsx                # /today
```

### 結構設計決定

1. **`shared/` 不獨立**:Slice 0 worker 是空殼、不 import 任何東西,`Task` types 放 `src/lib/types.ts` 即可。等 Slice 2 worker 真有需要時再決定要不要拉出來。
2. **`DayColumn` 共用**:Plan mode 第三欄(Selected Day)與 Today mode 主視圖視覺幾乎一樣,差別只是傳的 prop(`selectedDate`)。共用一個元件。
3. **`MonthColumn` 跟 `MonthDigest` 是兩個元件**:雖然都顯示月度資料,但 Plan mode 用的 `MonthColumn`(含 Backlog 摺疊區、Top3 完整 hero、其他任務列表)與 Today mode 用的 `MonthDigest`(縮小縮影、進度條)版型差很多。放同一個 `month/` 資料夾、兩個元件。
4. **`SegmentedControl` 共用 primitive**:ModeToggle(規劃 / 今天)與 ThemeToggle(Auto / Light / Dark)都用同一個 `SegmentedControl`,內部包 Base UI 的 `ToggleGroup`。

---

## 4. 資料流

```
src/mock/data.ts  ──┐
  (DeskTask[])      │
                    ▼
            src/lib/tasks.ts            ← 純函式,無副作用
            (tasksOnDate / tasksOnMonth /
             primaryDate / primaryMonth / layer)
                    │
                    ▼
          features/*/* component        ← 接 derivation 結果 + UI 狀態(只有 hover、Backlog 摺疊)
                    │
                    ▼
              pages/Plan or Today
```

Slice 0 沒 store、沒 React Query、沒 server state。Page 元件直接 `import { allTasks } from "@/mock/data"`,呼叫 derivation function,把結果分派給 feature 元件。每次 render 都重算 — Slice 0 量少沒效能問題,Slice 2 接 WSPC 時這層會抽到 hook(`useTasks()`),feature 元件 props 不變。

### Slice 0 內的 UI 狀態(僅有兩處)

| 狀態 | 存在哪 | 持久化 |
|---|---|---|
| 目前 mode(plan / today) | URL(由 router 管) | URL |
| Backlog 摺疊區展開/摺疊 | `useState` in `MonthColumn` | 無(每次 reload 預設摺疊) |
| Theme preference(auto / light / dark) | `useTheme` hook | localStorage |

---

## 5. 兩種模式的版型組合

### Plan mode(`/plan`)

```
PlanPage
└─ PlanLayout
   ├─ TopNav(mode=plan)
   ├─ CarryoverBanner(靜態示意)
   └─ 三欄 grid(desktop)
      ├─ MonthColumn
      │  ├─ BacklogSection            ← 摺疊區,點標頭展開
      │  │  └─ TaskRow × N            ← layer(task) === 'backlog'
      │  ├─ MonthHeroCard
      │  │  └─ Top3Card × 3           ← monthly_priority ∈ {1,2,3}
      │  └─ MonthRow × N              ← 其他 + 軌跡
      │
      ├─ WeekColumn                   ← 本週 Mon → Sun
      │  └─ 每天一個 group:
      │     ├─ 日期 (e.g. 18 MON)
      │     └─ 該日 top3 標題 × 3
      │
      └─ DayColumn(selectedDate=today)
         ├─ Day hero(May 22)
         ├─ Top3Card × 3              ← daily_priority ∈ {1,2,3}
         ├─ TaskRow × N(計劃內)
         └─ TaskRow × M(計劃外,adhoc chip 紅)
```

**第三欄是「Selected Day」而非「Today」** — 語意上是「被選中的那一天」,預設 today。Slice 0 不做切換互動,Slice 1+ 加(點 Week 任一天 → 第三欄切換)。

### Today mode(`/today`)

```
TodayPage
└─ TopNav(mode=today)
└─ CarryoverBanner(靜態示意)
└─ 三欄 grid(desktop)
   ├─ WeekRail(左欄,本週縮影)
   │  └─ 每天一個 row,顯示日期 + top3 標題縮寫
   │
   ├─ DayColumn(selectedDate=today)   ← 與 Plan mode 第三欄共用元件
   │  └─ 同上
   │
   └─ MonthDigest(右欄,本月縮影)
      ├─ 月度三件事(縮小版)
      ├─ ProgressBar(月份過了 X%)
      └─ 月度未完成數量
```

### Mobile(< 768px)

| Mode | Mobile 處理 |
|---|---|
| Plan | `SegmentedControl` 切 Monthly / Week / Selected Day 三 tab,一次看一欄。CarryoverBanner 可摺疊。 |
| Today | DayColumn 為主體;WeekRail 改成底部水平的 `DayChip × 7`;MonthDigest 收到底部最下方。 |

Breakpoint:`--breakpoint-tablet: 768px`,desktop layout `@media (min-width: 768px)` 才啟用,mobile-first CSS。

---

## 6. Backlog 摺疊區(關鍵互動)

Plan mode 的 Monthly 欄頂部:

```
┌─ MonthColumn ────────────────────┐
│ ┌──────────────────────────────┐ │
│ │ 📥 Backlog (8) ▸             │ │ ← 摺疊(預設)
│ └──────────────────────────────┘ │
│                                  │
│ May 2026 · 本月最重要的三件事     │
│ Top3 × 3                         │
│ 其他計劃內                        │
│ 計劃外                            │
└──────────────────────────────────┘

         點標頭 ↓

┌─ MonthColumn ────────────────────┐
│ ┌──────────────────────────────┐ │
│ │ 📥 Backlog (8) ▾             │ │ ← 展開
│ │ ─ 整理書架                    │ │
│ │ ─ 學一個新樂器                │ │
│ │ ─ …                          │ │
│ └──────────────────────────────┘ │
│ ────                             │
│ May 2026                         │
│ Top3 × 3(被往下推)              │
│ 其他計劃內                        │
└──────────────────────────────────┘
```

- 展開 / 摺疊純前端 state,**Slice 0 做這個互動**(因為不涉及資料 mutation)
- 展開時 **Week 欄與 Selected Day 欄不隱藏** — 範圍縮小,年規劃需求等以後 slice 再談
- 展開時 Monthly 欄內 Top3 與其他被往下推,scroll 進去看

---

## 7. 資料模型與 derivation

### Task 型別

對齊 HANDOFF §7.3:

```ts
type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
type TrailKind = 'primary' | 'forwarded' | 'dismissed';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;

  custom_fields: {
    scheduled_months?: string[];
    scheduled_dates?: string[];
    unscheduled_month?: string;
    unscheduled_at?: string;
    monthly_priority?: '1' | '2' | '3';
    daily_priority?: '1' | '2' | '3';
    is_adhoc?: 'true' | 'false';
    done_on?: string;
    position?: string;
  };
}
```

### Derivation function(Slice 0 全部實作)

```ts
// src/lib/tasks.ts

function primaryMonth(t: Task): string | null;
function primaryDate(t: Task): string | null;
function layer(t: Task): 'backlog' | 'monthly' | 'daily';
function tasksOnDate(all: Task[], date: string): Array<{ task: Task; kind: TrailKind }>;
function tasksOnMonth(all: Task[], month: string): Array<{ task: Task; kind: TrailKind }>;
```

實作細節見 HANDOFF §7.4(已是穩定設計,直接照抄)。

### TrailKind 樣式對應

| kind | 條件 | UI |
|---|---|---|
| `primary` | 該日/月 == `last` 且 `last > unscheduled_*` | 一般 row,完整視覺 |
| `forwarded` | 該日/月在 array 內但不是 `last` | 淡色 + 「↪ 已順延」標籤 |
| `dismissed` | 該日/月 == `last` 且 `last == unscheduled_*` | 淡色 + 刪除線 + 「· 已略過」 |

### Mock data 覆蓋範圍

`src/mock/data.ts` 須涵蓋:

- **Backlog**:3–5 個(`scheduled_months` 空或 `last <= unscheduled_month`)
- **本月 Top3**:3 個(`monthly_priority` = 1/2/3,排在本月)
- **本月其他計劃內**:4–6 個(排在本月,非 top3,`is_adhoc = false`)
- **本月計劃外**:1–2 個(排在本月,`is_adhoc = true`)
- **本月已完成**:1–2 個(`status = done`,`done_on` 在本月內)
- **今日 Top3**:3 個(`daily_priority` = 1/2/3,`scheduled_dates` 含 today)
- **今日計劃內**:2 個(非 top3、非 adhoc、含 today)
- **今日計劃外**:1 個(`is_adhoc = true`,`scheduled_dates` 只有 today)
- **順延軌跡範例**:1 個(`scheduled_dates` 跨多天,`last` 是後面那天)
- **略過軌跡範例**:1 個(`scheduled_dates.last == unscheduled_at`)

---

## 8. Design tokens

完整對應 HANDOFF §4。Slice 0 全部落地:

| 檔案 | 內容 |
|---|---|
| `colors.css` | Light + Dark 兩套(`[data-theme]` 切換),含 paper / ink / accent(moss 固定)/ flag / carryover 全套 OKLCH |
| `space.css` | `--space-0` 到 `--space-14`,4px grid |
| `type.css` | `--text-base-size: 13px` 為錨點,衍生 `--text-2xs` 到 `--text-6xl`;letter-spacing 規則 |
| `radius.css` | `--radius-none / xs / sm / md / lg / pill` |
| `shadow.css` | `--shadow-paper / card / pop / focus` |
| `motion.css` | `--ease-out / in-out`、`--dur-fast / base / slow` |

**重點**:所有 padding / margin / gap 必須走 token,**不**允許 hard-code 數值(除非是 token 組合或 named local var)。

### Theme 切換

`useTheme` hook:

```ts
type ThemePref = 'auto' | 'light' | 'dark';

function useTheme(): {
  pref: ThemePref;
  resolved: 'light' | 'dark';  // auto 解析後的實際 theme
  setPref(p: ThemePref): void;
};
```

- `pref` 存 localStorage(key `desk.theme`)
- `auto` 跟隨 `prefers-color-scheme`
- `resolved` 寫到 `<html data-theme="...">`,所有 token 透過 CSS attribute selector 切換

---

## 9. Cloudflare 設定

### `wrangler.jsonc`

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

### `worker/index.ts`(Slice 0 空殼)

```ts
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not implemented", { status: 501 });
    }
    // Non-API requests fall through to static assets via Wrangler Assets
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler;
```

### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    cloudflare(),
  ],
});
```

---

## 10. 完成定義(Acceptance Criteria)

### 功能面

- [ ] `npm install` + `npm run dev` 起得來,localhost 跑 Vite + Worker 同 port
- [ ] 訪問 `/` 自動轉 `/today`
- [ ] `/plan` 顯示 Monthly / Week / SelectedDay 三欄,mock 資料完整渲染
- [ ] `/plan` 的 Monthly 欄頂部「📥 Backlog (N) ▸」摺疊頭,點擊**可展開 / 摺疊**
- [ ] `/today` 顯示 WeekRail / DayColumn / MonthDigest 三欄(desktop)
- [ ] TopNav 的 [規劃 \| 今天] SegmentedControl 可切換,URL 同步
- [ ] TopNav 的 ThemeToggle 三檔(Auto / Light / Dark)可切換,刷新後維持
- [ ] Mobile breakpoint(< 768px)下版型如 §5 描述
- [ ] 兩個模式頂部各有一條 hard-coded CarryoverBanner(按鈕不能動)
- [ ] Light / Dark theme 切換後全頁 token 正確生效

### 視覺面

- [ ] 中高保真度:hand-drawn ✓ Checkbox、Top3Card 環形 1/2/3、UnplannedChip 紅色、PaperTexture、DeskLogo 都到位
- [ ] 所有顏色 / 字級 / 間距 / radius 走 CSS Custom Properties

### 程式碼面

- [ ] `src/lib/types.ts` 定義 `Task` interface(對齊 HANDOFF §7.3)
- [ ] `src/lib/tasks.ts` 實作 `primaryDate` / `primaryMonth` / `layer` / `tasksOnDate` / `tasksOnMonth`
- [ ] Mock data 涵蓋 §7 所列所有情境
- [ ] ESLint + Prettier 通過,`npm run build` 無 type error
- [ ] `wrangler.jsonc` 設定齊全,build 能輸出 dist

---

## 11. Open questions(留給後續 slice)

不影響 Slice 0,但記下來:

1. **Slice 1 從哪裡接手**:ROADMAP 寫「單欄 Today + localStorage」,但 Slice 0 已做完整 Today mode 三欄。Slice 1 是否該調整為「Today 的 CRUD 互動跑通 + localStorage 持久化」,而非「重做單欄 Today」?
2. **`DayColumn` 命名**:Plan mode 第三欄與 Today mode 主視圖共用元件,目前定 `DayColumn`,以後若 Today mode 視覺分化,可能拆兩個。
3. **Backlog 摺疊預設**:Slice 0 預設摺疊。Slice 4 加邏輯後是否考慮「月初預設展開」?
4. **年規劃需求**:User 提到月規劃可能需要看「年」的部分。此需求未規劃,以後再開 slice。

---

## 12. 參考資料

- [ROADMAP.md](../../../ROADMAP.md) — 第一階段 Slice 0
- [docs/claude-design/design_handoff_desk/HANDOFF.md](../../claude-design/design_handoff_desk/HANDOFF.md) — 視覺設計與 token 詳細規格
- [docs/claude-design/design_handoff_desk/prototype/](../../claude-design/design_handoff_desk/prototype/) — Claude Design 探索期原型(視覺參考,**資料模型不照抄**)
- [Cloudflare React + Vite docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)
