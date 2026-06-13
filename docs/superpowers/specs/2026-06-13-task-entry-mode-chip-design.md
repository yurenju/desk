# 共享的「新增任務模式」chip — 設計文件

日期:2026-06-13

## 背景與問題

dashboard 的任務畫面把任務分成兩種思考脈絡:

- **計畫中(planned)**:每月 / 每週規劃時就預定好的任務。
- **臨時加入(adhoc)**:當天進行中臨時想到要做的,或月份過了一半才臨時補進來的。

資料模型上,這個區分由 `custom_fields.is_adhoc` 欄位(字串 `"true"` / `"false"`)驅動,渲染時據此分區(見 `src/features/day/DayColumn.tsx`、`src/features/month/MonthColumn.tsx`)。

問題是:**新增任務時無法選擇要進哪一區**。目前三個新增入口把 `is_adhoc` 寫死:

- `AddTaskInput`(Today / 日視圖)永遠 `is_adhoc="true"`。
- `AddMonthTaskInput`(月視圖)永遠 `is_adhoc="false"`。
- `AddBacklogTaskInput`(Backlog)永遠 `is_adhoc="false"`。

使用者沒辦法表達「我今天做的這件事其實是先前計畫好的」或「這個月過一半我臨時補一件計畫外的事」。

## 目標

讓每個「會歸屬到某天 / 某月」的新增入口,都帶一個可切換「計畫中 / 臨時」的 chip:

- **全域共享**:任一 chip 切換,畫面上其他 chip 即時同步。狀態存 localStorage,記住上次選擇。
- 新增任務時依目前 chip 模式決定 `is_adhoc`,**取代**原本寫死的行為。
- 順手把三個近乎重複的新增輸入元件抽成一個共用元件。

## 非目標

- 不處理 Backlog 的 planned/adhoc 區分。Backlog 是「還沒排進月份的池子」,這個思考脈絡要進到月份才發生,所以 Backlog 輸入**不顯示 chip**,維持原本 `is_adhoc="false"`。
- 不改既有任務的分區邏輯與渲染。只動「新增」這條路徑。
- 不提供「改某個已存在任務的 planned/adhoc」的 UI(本次範圍只在新增當下決定)。

## 設計

### 1. 行為模型

全域狀態 `entryMode`,兩個值:

| `entryMode` | 對應 `is_adhoc` | 顯示 |
| --- | --- | --- |
| `"planned"` | `"false"` | `📅 計畫中`(沉穩青) |
| `"adhoc"` | `"true"` | `⚡ 臨時`(琥珀警示) |

- 存在 localStorage,key `desk.entryMode`。
- **首次使用(localStorage 還沒值)預設 `"planned"`**。
- 全域共享:Plan 頁可能同時出現「月」輸入列的 chip,點任一個,所有掛載中的 chip 立即翻面。

### 2. 共享狀態實作:`src/lib/entryMode.ts`

仿現有 `src/lib/theme.ts` 的 localStorage hook,但**加上 subscriber 機制**,讓同畫面多個 chip 即時連動 —— 純 localStorage + `useState` 的 theme 寫法無法讓兄弟元件連動,所以這裡用 `useSyncExternalStore`。

模組對外提供:

```typescript
export type EntryMode = "planned" | "adhoc";

// read current value (for non-React call sites if needed)
export function getEntryMode(): EntryMode;

// React hook: returns [mode, setMode]; all subscribers re-render on change
export function useEntryMode(): [EntryMode, (mode: EntryMode) => void];

// map to the is_adhoc custom field value
export function isAdhocOf(mode: EntryMode): "true" | "false";
```

內部:模組層級保存 current value + 一組 listener。`setMode` 寫 localStorage、更新 value、通知所有 listener。`useEntryMode` 用 `useSyncExternalStore(subscribe, getEntryMode)` 訂閱。

`localStorage` 不存在(SSR / 測試環境)時 fallback 回 `"planned"`,寫入時 try/catch 包住。

### 3. 共用元件:`AddTaskBar`

取代現有三個 `Add*Input`,集中共用邏輯(value state、Enter + 輸入法 composing 處理、空白清空)。

```typescript
interface AddTaskBarProps {
  placeholder: string;
  ariaLabel: string;
  withMode?: boolean; // 是否顯示 EntryModeChip;預設 false
  onSubmit: (title: string, mode?: EntryMode) => void;
}
```

- `withMode` 為 true 時,在輸入框與送出之間渲染 `EntryModeChip`;送出時把目前 `entryMode` 一起回傳給 `onSubmit`。
- `withMode` 為 false(Backlog)時不渲染 chip,`onSubmit` 的 `mode` 為 `undefined`。
- 既有三個 `Add*Input.module.css` 內容若一致,合併成單一 `AddTaskBar.module.css`(實作前先 diff 確認;若有差異,以最完整者為準並在 plan 記錄)。

各呼叫端改用 `AddTaskBar`:

| 呼叫端 | `withMode` | `onSubmit` |
| --- | --- | --- |
| 日視圖(取代 `AddTaskInput`) | `true` | `(title, mode) => addTodayTask(title, date, isAdhocOf(mode))` |
| 月視圖(取代 `AddMonthTaskInput`) | `true` | `(title, mode) => addMonthTask(title, month, isAdhocOf(mode))` |
| Backlog(取代 `AddBacklogTaskInput`) | `false` | `(title) => addBacklogTask(title)` |

### 4. 元件:`EntryModeChip`

- 內嵌在 `AddTaskBar` 輸入框右側。樣式:圖示 + 字、實心底。`📅 計畫中`(青)/ `⚡ 臨時`(琥珀)。
- 點擊在兩個模式間切換(呼叫 `useEntryMode` 的 setter)。
- 觸控目標高度 ≥ 32px(手機可點)。有 `aria-label` 與 `aria-pressed` / 適當的可存取語意。

### 5. store 方法調整(`src/store/tasks.ts` + `src/store/taskOps.ts`)

- `addTodayTask(title, date, isAdhoc)`:新增 `isAdhoc` 參數,移除寫死的 `"true"`,改用傳入值。
- `addMonthTask(title, month, isAdhoc)`:同上,移除寫死的 `"false"`。
- `addBacklogTask(title)`:不變(仍 `is_adhoc="false"`)。

對應 `taskOps.ts` 的 local 樂觀更新函式同步調整,讓 optimistic task 的 `custom_fields.is_adhoc` 與送出值一致。

## 資料流

1. 使用者在某輸入列點 chip → `setMode` 寫 localStorage、通知 listener → 所有 chip 即時翻面。
2. 輸入標題、按 Enter → `AddTaskBar` 呼叫 `onSubmit(title, mode)`。
3. 呼叫端 `isAdhocOf(mode)` 換算 → 呼叫對應 store 方法。
4. store 樂觀更新本地 task(`custom_fields.is_adhoc` 一致)、`postTodo` 帶 `is_adhoc` 送後端 → 任務落在正確分區。

## 測試策略

### 單元測試(vitest / Testing Library)

- `entryMode.ts`:預設值 `"planned"`;`setMode` 後 `getEntryMode` 反映新值並寫入 localStorage;`isAdhocOf` 對應正確;`localStorage` 不可用時 fallback。
- `EntryModeChip`:初始顯示對應模式;點擊切換;同畫面掛兩個 chip,點其中一個,另一個跟著更新(驗證 subscriber 同步)。
- `AddTaskBar`:Enter 送出帶當前 mode;輸入法 composing 中按 Enter 不送出;空白輸入清空不送出;`withMode=false` 時不渲染 chip、`onSubmit` 不帶 mode。
- 測試檔顯式 `import { describe, it, expect } from "vitest"`(本專案 `tsc -b` 會檢查測試檔,不靠 global)。

### e2e 測試(Playwright,`npm run test:e2e`)

改到 Today 互動 + 新增流程,CLAUDE.md 規定要跑 e2e:

- 切到「臨時」後在日視圖新增 → 任務落在臨時區。
- 切回「計畫中」新增 → 落在計畫區。
- 在月視圖新增,模式正確對應到該月分區。
- 跨輸入列同步:Plan 頁切一個 chip,另一個 chip 即時翻面。
- Backlog 輸入沒有 chip。

### 手動測試(preview + AI agent)

用共享 KV + 共享 playwright profile 開 preview(先探測登入狀態,已登入直接驗收):

- chip 觀感與配色(計畫中青 / 臨時琥珀對比是否清楚)。
- 觸控目標大小(手機寬度下可點)。
- Plan 頁多 chip 連動的即時性。
- 切換後新增,任務確實進對應分區。
- 響應式排版:窄畫面下 chip + 輸入框 + 不擠壓、不換行破版。

## 驗收標準

1. 日視圖、月視圖的新增輸入列都顯示 chip;Backlog 不顯示。
2. chip 預設「計畫中」;切換後重整頁面仍記得上次選擇(localStorage)。
3. 同畫面任一 chip 切換,其他 chip 即時同步。
4. 切「計畫中」新增 → 任務 `is_adhoc="false"`、落計畫區;切「臨時」→ `is_adhoc="true"`、落臨時區。
5. 三個新增輸入皆改用同一個 `AddTaskBar` 共用元件。
6. `npm run build`(型別)、`npx vitest run`、`npm run test:e2e` 全綠。
