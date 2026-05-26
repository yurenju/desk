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
| Primitives | **Base UI** (`@base-ui-components/react`) | 比 Radix 套件數少、`render` prop API 更乾淨、Combobox/ContextMenu 更完整、與 Motion 整合好。**不需要 shadcn 層**。 |
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

採用 **modular scale ≈ 1.2（minor third）**，並對齊 4px grid。

| Token | px | line-height | 用途 | 原型對應 |
|---|---:|---|---|---|
| `--text-2xs`  | 10 | 1.2 | mono badge、micro caption | 9, 9.5, 10 |
| `--text-xs`   | 11 | 1.3 | mono meta、tiny eyebrow | 10.5, 11 |
| `--text-sm`   | 12 | 1.4 | secondary body、chip、button-sm | 11.5, 12 |
| `--text-base` | 13 | 1.45 | task row、預設 body | 12.5, 13 |
| `--text-md`   | 14 | 1.4 | task title、top3 row | 13.5, 14 |
| `--text-lg`   | 16 | 1.35 | banner title、card title | 15, 16 |
| `--text-xl`   | 20 | 1.2 | sub heading、Month digest title | 19, 22 |
| `--text-2xl`  | 24 | 1.1 | section page title | 22, 26, 28 |
| `--text-3xl`  | 32 | 1.05 | mobile day hero | (未用) |
| `--text-4xl`  | 40 | 0.95 | day number (today) | 40 |
| `--text-5xl`  | 48 | 0.95 | mobile "May 22" | 48 |
| `--text-6xl`  | 64 | 0.9  | desktop "May 22" | 64 |

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
- [ ] 標記計劃內 / 計劃外（每個任務有 `planned: boolean`）
- [ ] 月度三件事 + 月度任務（其他）
- [ ] 週每日三件事 + 主題
- [ ] 日三件事 + 其他計劃內 + 臨時加的
- [ ] 兩種模式切換（規劃 / 今天） + 持久化最後使用模式
- [ ] Carryover：日界線、週界線、月界線時自動計算未完成事項
- [ ] Carryover 三個動作：→ 三件事、→ 計劃內、略過
- [ ] Daily task 完成時，若連結到 monthly *other* item，連動標記完成（**不要**自動完成 monthly top3，那是 aggregate）
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

## 7. 資料模型建議

```ts
type TaskScope = 'month' | 'week-day' | 'day';

interface Task {
  id: string;
  title: string;
  scope: TaskScope;
  date: string;        // ISO; for month: 'YYYY-MM-01'; for week-day/day: 'YYYY-MM-DD'
  
  planned: boolean;    // 計劃內 vs. 計劃外
  isTop3: boolean;     // 是否為該週期的三件事之一
  top3Order?: 1 | 2 | 3;
  
  done: boolean;
  doneOn?: string;     // ISO date when checked off
  
  // Cross-scope linking
  parentTaskId?: string;     // daily task → monthly task
  
  // Misc
  sub?: string;        // 副標
  progress?: number;   // 0-1, 用於月度任務
  createdAt: string;
  updatedAt: string;
}

interface DayPlan {
  date: string;        // ISO
  theme?: string;      // "WSPC API 串接"
}

interface WeekPlan {
  weekISO: string;     // "2026-W21"
  // 主要由 DayPlan 組成
}

interface MonthPlan {
  month: string;       // "2026-05"
}
```

**Carryover 不是 stored entity**，而是 derived query：
> 找出 `date < today && !done` 且 `planned === true` 的 tasks，依 scope 分組顯示。

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

> 「請參考 `Todo Designs.html` 與 `HANDOFF.md`，將設計實作為一個 React + TypeScript + Vite 專案。Primitives 使用 Base UI (`@base-ui-components/react`)，樣式使用 CSS Modules。Design tokens 寫在 `src/tokens/*.css` 並用 CSS Custom Properties 暴露。先建立第 4 節的 token 檔案與第 3 節的目錄骨架，再依第 5 節的元件清單實作 `ui/` 層，最後拼出 `features/` 與 `pages/`。Mock data 直接從 `shared.jsx` 抄出來放到 `src/mock/data.ts`。」

實作時如有設計細節不確定，**先參考 `Todo Designs.html` 在瀏覽器中看，再回頭問**。
