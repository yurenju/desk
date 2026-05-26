# desk · Handoff 文件

> 給接手實作的工程師（含 Claude Code）的設計交接文件。
> 設計探索的成果在 `Todo Designs.html`（design canvas），預覽用 React + inline styles，**實作時請依下文重寫成 React + Base UI + CSS Modules**。

---

## 1. 產品 TL;DR

`desk` 是一個個人用的 todo / 規劃工具，核心理念是 **「規劃」與「執行」分離**：

- **規劃模式（Plan）**：月 / 週 / 日三欄並列。在每個週期開始時用，回顧上個週期的延續事項 → 規劃當期。
- **今天模式（Today）**：以「今天」為主角。每天打開最常看的畫面。
- **每個週期都有「最重要的三件事」**：月有 3、週每日有 3、今日有 3。
- **計劃內 vs. 計劃外**：當天臨時冒出來的事會明確標示，避免「計畫」被未預期任務稀釋。
- **延續（Carryover）**：上週期未完成的事，會在新週期開始時以可摺疊的 banner 顯示，提供 *移到今天 / 改為計劃內 / 略過* 三個動作。

---

## 2. 技術棧建議

完整討論記錄在對話中。最終決定：

| 層 | 技術 | 理由 |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | 標準現代 stack |
| Primitives | **Base UI** (`@base-ui/react`) | 比 Radix 套件數少、`render` prop API 更乾淨、Combobox/ContextMenu 更完整、與 Motion 整合好。**不需要 shadcn 層**。 |
| Styling | **CSS Modules** | 跟 Base UI 的 `data-*` state attributes 自然合拍；不引入 Tailwind |
| Tokens | **CSS Custom Properties** | 顏色、字級、間距、radius 全部走 CSS vars，主題切換用 `[data-theme]` 屬性 |
| Animation | **motion** (framer-motion) | 透過 Base UI 的 `render` prop 包入 |
| State | **本地：Zustand**；**遠端：依後端決定** | todo 本身狀態不複雜，Zustand 夠用 |
| Routing | **TanStack Router 或 React Router 7** | desktop 是 SPA，URL 反映模式 + 日期 |

### 不用 shadcn 的理由（給 reviewer）
我們的設計視覺特色很明確（warm paper、自製 hand-drawn check、carryover banner、月/週/日三欄佈局）。shadcn 預設樣式需要全部覆寫，留著只是中間層開銷。直接 Base UI + CSS Modules 心智模型更乾淨。

---

## 3. 目錄結構建議

```
src/
├── tokens/
│   ├── colors.css       # --color-paper, --color-ink, accent palette
│   ├── space.css        # --space-1 ~ --space-12
│   ├── type.css         # --text-xs ~ --text-7xl, --font-* stacks
│   ├── radius.css       # --radius-none / sm / md / pill
│   └── index.css        # @import 全部
├── lib/
│   ├── theme.ts         # buildTheme() — 將 accent hex 解為 OKLCH 變數
│   ├── date.ts          # 月/週/日邊界計算、carryover 查詢
│   └── tasks.ts         # task model 操作（toggle / move / classify）
├── ui/                  # 設計系統 — 包 Base UI primitives
│   ├── Button/
│   ├── Checkbox/        # 含 hand-drawn ✓ 變體
│   ├── Chip/            # UnplannedChip / PlannedRefChip
│   ├── Dialog/
│   ├── Menu/            # RowMenu, ContextMenu
│   ├── ProgressBar/
│   ├── SegmentedControl/
│   ├── Toast/
│   └── index.ts
├── features/            # 產品功能 — 用 ui/ 當積木
│   ├── carryover/       # CarryoverBanner / CarryoverSection / Row
│   ├── month/           # MonthView, MonthHeroCard, MonthRow
│   ├── week/            # WeekView, WeekRow, WeekRail
│   ├── day/             # DayView, Top3Card, TaskRow
│   ├── shell/           # TopNav, ModeToggle, Brand
│   └── plan-view/       # 三欄組合
├── pages/
│   ├── PlanPage.tsx
│   └── TodayPage.tsx
└── app.tsx
```

---

## 4. Design Tokens

設計探索期用了不規則的值（半 px、22px 間距等）。**handoff 時請統一到下面的 scale**。對應原本值的對照表附在每個 token 後面。

### 4.1 字體家族

```css
--font-sans:  "Geist", "Noto Sans TC", "Inter", -apple-system, system-ui, sans-serif;
--font-serif: "Newsreader", "Noto Serif TC", "Source Serif 4", Georgia, serif;
--font-mono:  "Geist Mono", "JetBrains Mono", ui-monospace, monospace;
--font-hand:  "Caveat", "Comic Sans MS", cursive;  /* 僅用於 Checkbox 勾號 */
```

**Google Fonts import**：Newsreader (400/500/600 + italic) · Geist (400/500/600/700) · Geist Mono (400/500/600) · Caveat (400/500/600) · Noto Sans TC (400/500/600/700) · Noto Serif TC (400/500/600/700)

### 4.2 字級 Scale

**字級採用 `--text-base-size` 為錨點 + 比例衍生**。改 `--text-base-size` 整套等比放大，其他 token 不必個別調整。比例選用乾淨的分數，不刻意 round 到整數 px——交給瀏覽器處理 sub-pixel rendering。

```css
:root {
  --text-base-size: 13px;  /* 唯一錨點；換主題 / 不同裝置改這個 */

  --text-2xs:  calc(var(--text-base-size) * 0.75);    /* 3/4 */
  --text-xs:   calc(var(--text-base-size) * 0.8);     /* 4/5 */
  --text-sm:   calc(var(--text-base-size) * 0.9);     /* 9/10 */
  --text-base: var(--text-base-size);
  --text-md:   calc(var(--text-base-size) * 1.1);     /* 11/10 */
  --text-lg:   calc(var(--text-base-size) * 1.25);    /* 5/4 */
  --text-xl:   calc(var(--text-base-size) * 1.5);     /* 3/2 */
  --text-2xl:  calc(var(--text-base-size) * 1.875);   /* 15/8 */
  --text-3xl:  calc(var(--text-base-size) * 2.5);     /* 5/2 */
  --text-4xl:  calc(var(--text-base-size) * 3);
  --text-5xl:  calc(var(--text-base-size) * 3.75);    /* 15/4 */
  --text-6xl:  calc(var(--text-base-size) * 5);
}
```

不同 base 下實際 px（僅供參考；實作別 hard-code）：

| Token | multiplier | line-height | 用途 | @ 13 (default) | @ 14 | @ 16 |
|---|---:|---|---|---:|---:|---:|
| `--text-2xs`  | 0.75   | 1.2  | mono badge、micro caption          | 9.75  | 10.5  | 12 |
| `--text-xs`   | 0.8    | 1.3  | mono meta、tiny eyebrow            | 10.4  | 11.2  | 12.8 |
| `--text-sm`   | 0.9    | 1.4  | secondary body、chip、button-sm    | 11.7  | 12.6  | 14.4 |
| `--text-base` | 1      | 1.45 | task row、預設 body                 | 13    | 14    | 16 |
| `--text-md`   | 1.1    | 1.4  | task title、top3 row               | 14.3  | 15.4  | 17.6 |
| `--text-lg`   | 1.25   | 1.35 | banner title、card title           | 16.25 | 17.5  | 20 |
| `--text-xl`   | 1.5    | 1.2  | sub heading、Month digest title    | 19.5  | 21    | 24 |
| `--text-2xl`  | 1.875  | 1.1  | section page title                 | 24.4  | 26.25 | 30 |
| `--text-3xl`  | 2.5    | 1.05 | mobile day hero                    | 32.5  | 35    | 40 |
| `--text-4xl`  | 3      | 0.95 | day number (today)                 | 39    | 42    | 48 |
| `--text-5xl`  | 3.75   | 0.95 | mobile "May 22"                    | 48.75 | 52.5  | 60 |
| `--text-6xl`  | 5      | 0.9  | desktop "May 22"                   | 65    | 70    | 80 |

**設計直覺**：相鄰倍數比為 1.067 → 1.125 → 1.111 → 1.1 → 1.1 → 1.136 → 1.2 → 1.25 → 1.333 → 1.2 → 1.25 → 1.333——小字級之間細密、大字級之間跳得開，跟視覺感受一致。

**為什麼不嚴格用 1.2 modular scale**：純 1.2 倍會在大字級壓縮太緊（hero 跟 banner 區隔不夠），所以選用「小字級偏好倍數小、大字級偏好倍數大」的設計式 scale 而非數學式 scale，但仍以 `--text-base-size` 為單一錨點。

**Letter-spacing 規則**：
- Display serif (≥ 32px)：`letter-spacing: -0.04em`（取代原型的 -1.5 ~ -2）
- Heading serif (16–28px)：`-0.02em`
- Body sans：`0`
- Uppercase eyebrow (10–12px)：`+0.12em ~ +0.15em`（原型 `letterSpacing: 1.5–2`）
- Mono meta：`+0.04em`

**字重規則**：
- Serif：500（中等粗細，配 Newsreader 的 optical size 表現好）
- Sans body：400
- Sans label/button：600
- Sans eyebrow：700（uppercase + tracking）

### 4.3 間距 Scale（4px grid）

| Token | px | 用途 | 原型對應 |
|---|---:|---|---|
| `--space-0`  | 0  | — | — |
| `--space-1`  | 4  | row gap、tight padding | 4, 5 |
| `--space-2`  | 8  | element gap、card padding-sm | 6, 7, 8, 9 |
| `--space-3`  | 12 | section gap、card padding | 10, 12 |
| `--space-4`  | 16 | section padding | 14, 16 |
| `--space-5`  | 20 | page padding (mobile) | 18, 20, 22 |
| `--space-6`  | 24 | page padding (desktop) | 24, 26 |
| `--space-8`  | 32 | section gap (large) | 32 |
| `--space-10` | 40 | — | — |
| `--space-12` | 48 | page padding (wide) | 48 |
| `--space-14` | 56 | hero padding | 56 |

**對齊原則**：所有 padding、margin、gap **必須**使用 token；遇到需要不在 scale 上的值（如 hero 的 64、80），用 token 組合或在 module CSS 中明確命名（例如 `--hero-padding-x: 80px`）。

### 4.4 圓角

```css
--radius-none: 0;
--radius-xs:   3px;   /* 卡片、紙張感面板 — paper-feel */
--radius-sm:   4px;   /* 按鈕、row、section */
--radius-md:   6px;   /* dropdown menu、popover */
--radius-lg:   8px;   /* 較大的彈出層 */
--radius-pill: 9999px; /* 標籤、分段控制、tab */
```

**iOS 裝置框、鍵盤等**用實際 iOS 規格（27、48 等），不走 token。

### 4.5 顏色（OKLCH）

完整定義見 `shared.jsx` 的 `buildTheme()`。重點：

```css
/* Light mode (default) */
[data-theme="light"] {
  --color-paper:      oklch(0.965 0.018 78);   /* parchment cream */
  --color-paper-alt:  oklch(0.935 0.022 78);
  --color-paper-edge: oklch(0.895 0.026 78);   /* canvas backdrop */
  --color-ink:        oklch(0.24 0.018 50);
  --color-ink-soft:   oklch(0.46 0.018 55);
  --color-ink-faint:  oklch(0.62 0.018 60);
  --color-rule:       oklch(0.85 0.025 75);
  --color-rule-faint: oklch(0.90 0.020 75);

  /* Accent — 固定 moss（綠） */
  --color-accent:      oklch(0.60 0.13 135);   /* moss · #5C9352 */
  --color-accent-soft: oklch(0.93 0.05 135);
  --color-accent-text: oklch(0.42 0.13 135);

  /* Flag — unplanned chip 用，永遠是暖紅 */
  --color-flag:      oklch(0.58 0.18 32);
  --color-flag-soft: oklch(0.93 0.08 32);

  /* Carryover — 暖琥珀，跟 accent（綠）與 flag（紅）區隔 */
  --color-carry-bg:    oklch(0.94 0.035 80);
  --color-carry-bg-2:  oklch(0.90 0.045 80);
  --color-carry-edge:  oklch(0.78 0.060 75);
  --color-carry-text:  oklch(0.42 0.070 70);
}

[data-theme="dark"] { /* 對應 dark mode 值在 shared.jsx */ }
```

**Accent 不開放使用者選擇** —— 固定 moss（`#5C9352` · `oklch(0.60 0.13 135)`）。原型有色卡切換是為了設計探索，正式產品只用 moss。

### 4.6 陰影

紙張質感優先，陰影非常輕：

```css
--shadow-paper:  0 1px 0 var(--color-rule);                         /* 紙緣 */
--shadow-card:   0 1px 0 var(--color-paper-edge),
                 0 6px 16px oklch(0 0 0 / 0.04);                    /* 卡片浮起 */
--shadow-pop:    0 8px 24px oklch(0 0 0 / 0.12);                    /* dropdown / menu */
--shadow-focus:  0 0 0 3px oklch(from var(--color-accent) l c h / 0.25);
```

### 4.7 動畫

```css
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);

--dur-fast:     120ms;  /* hover, focus */
--dur-base:     180ms;  /* checkbox tick, expand */
--dur-slow:     280ms;  /* carryover banner expand */
```

---

## 5. 元件清單

下表標出每個元件 *用 Base UI / 自寫 / 包一層* 的建議。

### 5.1 從 Base UI 直接包

| 我們的元件 | Base UI primitive | 客製重點 |
|---|---|---|
| `Dialog` | `Dialog` | paper 風格的邊框與 backdrop |
| `Popover` | `Popover` | shadow + radius-md |
| `Menu` / `RowMenu` | `Menu` | 列表項 hover、刪除項紅色 |
| `ContextMenu` | `ContextMenu` | 右鍵 row：移動、刪除、改類型 |
| `Tooltip` | `Tooltip` | mono 字體、深色 ink 背 |
| `SegmentedControl`（規劃/今天） | `Tabs` 或 `ToggleGroup` | pill 樣式 + 鍵盤快捷鍵提示 |
| `Toast` | `Toast` | 變動完成提示 (e.g. "已移到今天計劃內") |
| `Combobox`（assign、tag、月度連結） | `Combobox` | mono 快捷字、輸入 # 觸發 |
| `Switch`（mode toggle 可選） | `Switch` | — |
| `Field` + `Input` | `Field` | inline 編輯任務標題用 |

### 5.2 完全自寫（產品特色）

| 元件 | 說明 |
|---|---|
| `Checkbox` | 手繪 ✓ 風格（Caveat 字體 + 旋轉 -8deg）。primary/accent 兩個變體 |
| `Chip` | UnplannedChip（紅）、PlannedRefChip（accent + 月度任務編號 1/2/3） |
| `ProgressBar` | 3px 細條，用於月度任務進度與「月份過了 X%」 |
| `PaperTexture` | SVG fractal-noise 疊在頁面上（多 multiply 混合） |
| `DeskLogo` | 筆記本 mark + serif 字標（紅色裝訂線 + 三孔） |
| `CarryoverBanner` | 可摺疊：列出昨/上週/上月未完成事項 + 三個快速動作按鈕 |
| `CarryoverSection` | dashed border 版本，用於規劃模式三欄頂部 |
| `Top3Card` | accent 背景 + 環形 1/2/3 標記 + 月度連結 chip |
| `WeekRow` (planner) | 日期方塊 + 三件事 ul，today 高亮 |
| `WeekRail` (today view) | 左欄垂直 day stack |
| `MonthDigest` (today view) | 右欄縮小版月概覽 |
| `DayChip`（mobile week peek） | 56×56 直立小卡 |

### 5.3 完全產品邏輯（features/）

- `CarryoverResolver` — 處理 carryover 動作（top3 / planned / drop）並寫回 store
- `Top3LinkPicker` — 把 daily task 連到 monthly task 的 picker（用 Combobox）
- `TaskInlineEditor` — row 雙擊進入編輯
- `DnDProvider` — 拖曳排序與移動（用 `@dnd-kit/core`）
- `KeyboardShortcuts` — ⌘P / ⌘T 模式切換、N 新增任務、E 編輯、X 完成、Esc 取消

---

## 6. 互動清單（implementation checklist）

### 必須（MVP）
- [ ] 任務 CRUD：新增、編輯、完成、刪除
- [ ] 標記計劃內 / 計劃外（每個任務有 `is_adhoc` cf，詳見第 7 節）
- [ ] Backlog 區（月度欄上方摺疊區）
- [ ] 月度三件事 + 月度任務（其他）
- [ ] 週每日三件事 + 主題
- [ ] 日三件事 + 其他計劃內 + 臨時加的
- [ ] 兩種模式切換（規劃 / 今天） + 持久化最後使用模式
- [ ] 日 Carryover：新一天打開時自動計算未完成事項，三個動作：→ 三件事 / → 計劃內 / 略過
- [ ] 月 Carryover：新一月打開時自動計算未完成事項（即月底 review 入口），三個動作：→ 本月三件事 / → 本月其他 / 丟回 backlog
- [ ] 跨層級顯示：同一 task 可同時出現在月度欄與日欄（α 模式，由 `scheduled_months` / `scheduled_dates` 推導）
- [ ] 主題切換：light / dark（accent 固定 moss，不開放切換）

### 建議（v1.1+）
- [ ] 拖曳排序（同欄內）
- [ ] 拖曳移動（任務在計劃內 ↔ 計劃外、daily ↔ monthly）
- [ ] 鍵盤快捷鍵
- [ ] Inline edit
- [ ] Undo（last action toast）
- [ ] 行動裝置 swipe-to-complete

### 推遲
- [ ] Email 整合
- [ ] 日曆整合
- [ ] 多人協作

---

## 7. 資料模型

> ⚠️ **本節已隨後端決定大幅改寫**。原型 (`shared.jsx`) 還是用早期的 `scope` / `date` / `planned` 平面結構，**那是設計探索期的 mock，不是要實作的目標**。實作請按本節（與 [ROADMAP.md](../../../ROADMAP.md) §1.3）為準。

### 7.1 後端 = WSPC todo

資料層使用 [WSPC](https://wspc.ai) `todo_items` API。所有 task 共用同一個 `DeskTask` 自訂型態，差別只在 custom fields。沒有 `month task` / `day task` 之分——**同一個 task entity 透過 cf 同時呈現在月度欄與日欄**。

### 7.2 三層漏斗

```
Backlog  (scheduled_months 空，或 last <= unscheduled_month)
   ↓ promote 進某個月（append 到 scheduled_months）
Monthly  (last(scheduled_months) > unscheduled_month，且 scheduled_dates 空或已 unscheduled)
   ↓ schedule 到某天（append 到 scheduled_dates）
Daily    (last(scheduled_dates) > unscheduled_at)
```

### 7.3 Task 型別（TypeScript view）

```ts
type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

interface Task {
  // WSPC 核心欄位
  id: string;
  title: string;
  description?: string;       // Markdown；對應設計中的「副標」
  status: TaskStatus;
  parent_id?: string | null;  // 父子任務（非跨層級，用於拆分子任務）
  created_at: string;         // ISO datetime
  updated_at: string;

  // Custom fields（全部 string / string_array）
  custom_fields: {
    scheduled_months?: string[];   // ["2026-05", "2026-06"]; append-only
    scheduled_dates?: string[];    // ["2026-05-22", "2026-05-23"]; append-only
    unscheduled_month?: string;    // "2026-05"
    unscheduled_at?: string;       // "2026-05-22"
    monthly_priority?: '1' | '2' | '3';
    daily_priority?: '1' | '2' | '3';
    is_adhoc?: 'true' | 'false';
    done_on?: string;              // ISO datetime
    position?: string;             // v1.1+ lex-order
  };
}
```

**不使用 WSPC 核心 `due_at`** —— 排定日期完全用 `scheduled_dates` 表達。

### 7.4 「主要位置 (primary)」推導與軌跡顯示

每個 task 在 `scheduled_*` array 內列出的**每一個**日期/月份的 view 都會出現，但只有 `last` 是 primary、其他是軌跡。前端依此分流樣式。

```ts
function primaryMonth(t: Task): string | null {
  const arr = t.custom_fields.scheduled_months ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_month ?? '';
  return last > u ? last : null;  // null = 在 backlog
}

function primaryDate(t: Task): string | null {
  const arr = t.custom_fields.scheduled_dates ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_at ?? '';
  return last > u ? last : null;  // null = 未排到任何日
}

function layer(t: Task): 'backlog' | 'monthly' | 'daily' {
  if (primaryDate(t)) return 'daily';
  if (primaryMonth(t)) return 'monthly';
  return 'backlog';
}

// 在某個 date / month view 列出所有要顯示的 task，並標記樣式
type TrailKind = 'primary' | 'forwarded' | 'dismissed';

function tasksOnDate(all: Task[], date: string): Array<{ task: Task; kind: TrailKind }> {
  return all
    .filter(t => t.custom_fields.scheduled_dates?.includes(date))
    .map(t => {
      const arr = t.custom_fields.scheduled_dates!;
      const last = arr[arr.length - 1];
      const u = t.custom_fields.unscheduled_at ?? '';
      if (date === last && last > u)  return { task: t, kind: 'primary' };
      if (date === last && last === u) return { task: t, kind: 'dismissed' };
      return { task: t, kind: 'forwarded' };  // 該日不是 last，已順延到後面
    });
}
// tasksOnMonth 完全對稱。
```

#### 軌跡顯示樣式

| kind | 條件 | UI |
|---|---|---|
| `primary` | 該日 == `last` 且 `last > unscheduled_at` | 一般 task row，完整互動 |
| `forwarded` | 該日在 array 內但不是 `last` | 淡色 + 「↪ 已順延到 YYYY-MM-DD」標籤；只能勾選完成，不能編輯/刪除/略過 |
| `dismissed` | 該日 == `last` 且 `last == unscheduled_at` | 淡色 + 刪除線 +「· 已略過」；只能勾選完成 |

**完成（`status = "done"`）後**：軌跡仍然全部顯示。`done_on` 那天顯示為 ✓ 完成；`done_on` 之前的軌跡仍是 `forwarded` 樣式（表達「本來想在這天做，後來順延但最終完成」）。

### 7.5 動作 → 寫入語意

| 動作 | 寫入 |
|---|---|
| 新增到 Backlog | 不寫 `scheduled_*` |
| 新增到本月 | `scheduled_months: [本月]` |
| 新增到今天 | `scheduled_dates: [today]`（**不**自動補 `scheduled_months`） |
| Backlog → 本月 | append 本月到 `scheduled_months` |
| 本月 → 某天 | append 該日到 `scheduled_dates` |
| 「略過」（從某天移走） | `unscheduled_at = today` |
| 「丟回 backlog」（從某月移走）| `unscheduled_month = last(scheduled_months)`；同時 `unscheduled_at = today` |
| 移到下月 | append 下月到 `scheduled_months` |
| 完成 | `status = "done"` + `done_on = now()` |

### 7.6 Carryover（皆為 derived query，前端 client-side filter）

| 類型 | 條件（皆需 status 未完成） |
|---|---|
| 日 carryover | `scheduled_dates.length > 0` AND `last(scheduled_dates) < today` AND `last(scheduled_dates) > (unscheduled_at ?? "")` |
| 月 carryover | `scheduled_months.length > 0` AND `last(scheduled_months) < current_month` AND `last(scheduled_months) > (unscheduled_month ?? "")` AND today 不在 `scheduled_dates` |

「未完成」= `status ∈ {open, in_progress}`。

### 7.7 是否「臨時插單」（`is_adhoc`）

flag 在 task 建立或拉入「有時間窗的清單」時設定，**一次寫死不再變**。UI 染色由前端依當前 view 加額外條件判斷：

- 月度欄染紅：`is_adhoc = "true"`（提醒月中清單膨脹）
- 日欄染紅：`is_adhoc = "true"` AND `created_at` 是 today AND `scheduled_dates` 只有 today（提醒當日插單）

### 7.8 跟原型 (`shared.jsx`) 的差異對照

| 原型 mock 欄位 | 新模型對應 |
|---|---|
| `scope: 'month' \| 'week-day' \| 'day'` | 由 `currentMonth` / `currentDate` 推導，**不存** |
| `date` | 月任務 → `last(scheduled_months)`；日任務 → `last(scheduled_dates)` |
| `planned: boolean` | `is_adhoc === "false"` |
| `isTop3` + `top3Order` | `monthly_priority` / `daily_priority` = `"1"/"2"/"3"` |
| `parentTaskId`（cross-scope 連結）| **拿掉**——不再有跨層級連結概念，同一 task 直接跨層級顯示 |
| `DayPlan.theme` | **拿掉**——使用者已澄清這是溝通誤會，不需要 |
| `progress: 0-1` | 不存；月度任務的進度由子任務（`parent_id`）完成比例聚合 |

---

## 8. Open Questions（請與 PM 確認）

1. **後端**：自建 API 還是用 SaaS？目前設計假設有個 `api.desk.yurenju.me`，欄位以上面 model 為準。
2. **多裝置同步**：是否需要 realtime？或 last-write-wins 足夠？建議先 LWW + optimistic UI。
3. **離線**：是否要 PWA + offline-first？mobile 設計暗示這是需要的。建議用 `dexie` + sync queue。
4. **「最重要的三件事」是否強制只能 3 個？** 目前 UI 假設嚴格 3 個；考慮放寬到 1-3。
5. **月度三件事完成的標準是什麼？** 目前是手動勾，aggregate 而非 auto-sum。要不要顯示 sub-tasks 進度？
6. **拖曳 between scopes 的語意？** 比如 daily task 拖到 monthly 列表，是「升級」還是「複製連結」？建議是「轉成 monthly aggregate 的 sub-task，原本的 daily 變成它的 instance」。
7. **快捷鍵**：⌘P/⌘T 是否會跟瀏覽器衝突（print/new tab）？考慮改 G+P / G+T。
8. **時區**：使用者可能跨時區（旅行）。`date` 用 user local 還是固定主時區？建議 user local（todo 是個人化的）。
9. **Dark mode 觸發**：跟系統？手動？目前是手動 toggle。建議加 auto / light / dark 三檔。

---

## 9. 未完成的設計工作

- [ ] **空狀態**：一個任務都沒有時的畫面
- [ ] **錯誤狀態**：網路斷線、儲存失敗
- [ ] **載入狀態**：初次載入骨架圖
- [ ] **設定頁面**：accent 切換、字體切換、資料匯出
- [ ] **任務詳情**：點擊任務開啟側欄或 dialog（目前沒設計）
- [ ] **搜尋**：⌘K 全域搜尋
- [ ] **回顧視圖**：週/月結束時的回顧頁面
- [ ] **mobile 規劃模式的「下一週/下一月」滑動**

---

## 10. 給 Claude Code 的具體指令範本

> 「請參考 `Todo Designs.html` 與 `HANDOFF.md`，將設計實作為一個 React + TypeScript + Vite 專案。Primitives 使用 Base UI (`@base-ui/react`)，樣式使用 CSS Modules。Design tokens 寫在 `src/tokens/*.css` 並用 CSS Custom Properties 暴露。先建立第 4 節的 token 檔案與第 3 節的目錄骨架，再依第 5 節的元件清單實作 `ui/` 層，最後拼出 `features/` 與 `pages/`。Mock data 直接從 `shared.jsx` 抄出來放到 `src/mock/data.ts`。」

實作時如有設計細節不確定，**先參考 `Todo Designs.html` 在瀏覽器中看，再回頭問**。
