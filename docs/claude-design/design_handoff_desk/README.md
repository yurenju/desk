# Handoff: desk · todo / planning app

## Overview

`desk` 是一個個人用 todo / 規劃工具，核心理念是 **「規劃」與「執行」分離**：

- **規劃模式（Plan）**：月 / 週 / 日三欄並列；每個週期開始時用來回顧 + 規劃。
- **今天模式（Today）**：以「今天」為主角，每日打開最常看的畫面。
- 每個週期都有 **「最重要的三件事」**（月 3、週每日 3、今日 3）。
- 嚴格區分 **計劃內 vs. 計劃外**（臨時冒出來的事用紅色 chip 標示）。
- **Carryover（延續）**：上週期未完成的事在新週期開始時自動聚合，提供「→ 三件事 / → 計劃內 / 略過」三個快速動作。

桌面與行動裝置同一份 codebase；兩個模式都有對應的 mobile 版本。

---

## About the Design Files

這個 bundle 內附的 HTML / JSX 檔案是 **設計參考（design reference）** —— 用 React + inline styles 做出來的可互動原型，用來表達「該長什麼樣、該怎麼動」，**不是要直接複製到生產環境的程式碼**。

你的任務是 **在目標 codebase 的環境裡重做這份設計**：

- 如果該專案已有 React + TypeScript + Vite 環境，請沿用既有 stack，按 `HANDOFF.md` 第 2 節的建議引入 Base UI + CSS Modules。
- 如果還沒有環境，請依 `HANDOFF.md` 第 2 節建立新專案（建議 **React 18 + TypeScript + Vite + Base UI + CSS Modules**，**不要用 Tailwind 或 shadcn** —— 這個決定已經討論過，理由詳見 `HANDOFF.md`）。
- 樣式不要直接 port inline styles；改用 CSS Modules + CSS Custom Properties（tokens 定義見 `Design Tokens.html` 與 `HANDOFF.md` 第 4 節）。

---

## Fidelity

**High-fidelity**。設計已經過多輪 iteration，顏色、字級、間距、互動行為都是定稿。請按 token spec 像素級實作。

唯一例外：原型用了 inline styles 且包含一些半 px 值（12.5、13.5）與不規則的 padding（18、22）—— `HANDOFF.md` 第 4 節已把這些值映射到乾淨的 scale，**請依 token，不要照抄 inline 值**。

---

## Files in This Bundle

```
design_handoff_desk/
├── README.md              ← 你正在讀的這份
├── HANDOFF.md             ← 主要交接文件（technical decisions, tokens, components, open Qs）
├── Design Tokens.html     ← 可執行的 token spec — 開啟看視覺化，:root 區塊可直接抄
└── prototype/             ← 設計原型 HTML
    ├── Todo Designs.html  ← 主入口，內嵌 design canvas（多個 artboard）
    ├── app.jsx            ← 頂層 App + DesignCanvas 配置
    ├── shared.jsx         ← Mock data + theme + 共用 primitives（Checkbox/Chip/Logo…）
    ├── unified-app.jsx    ← Desktop 主要實作（Plan view + Today view）
    ├── unified-mobile.jsx ← Mobile 主要實作
    ├── ios-frame.jsx      ← iOS 裝置框（僅 mobile 展示用，不需移植）
    ├── design-canvas.jsx  ← Design canvas 容器（不需移植）
    ├── tweaks-panel.jsx   ← 設計時的 tweak 面板（不需移植）
    └── direction-{1,2,3}.jsx  ← 早期探索方向（僅供參考，整合版採用 1+2 的組合）
```

**核心檔案**：`unified-app.jsx`（desktop）與 `unified-mobile.jsx`（mobile）。這兩個是要實作的目標。其他是支援檔案或設計工具。

---

## How to Read This Handoff

1. **先讀 `HANDOFF.md`** —— 完整技術決定 + 設計系統規格 + 元件清單 + open questions。
2. **開啟 `Design Tokens.html`** —— 視覺化的 token 參考。`:root` 區塊可直接抄到 `src/tokens/index.css`。
3. **在瀏覽器開啟 `prototype/Todo Designs.html`** —— 看實際互動行為。Design canvas 上會看到多個 artboard：
   - Desktop · 今天模式 / 規劃模式
   - Mobile · 今天模式 / 規劃模式
   - 早期方向（archived，僅供參考）

設計細節以瀏覽器看到的為準，HANDOFF.md 為輔。

---

## Quick Reference

### Tech Stack（建議）
- React 18 + TypeScript + Vite
- **Base UI** (`@base-ui-components/react`) — primitives
- **CSS Modules** + CSS Custom Properties — styling
- **不用 Tailwind、不用 shadcn**（已討論決定）
- Animation：`motion` (framer-motion)
- State：Zustand（local）
- Routing：TanStack Router 或 React Router 7

### Design Tokens（摘要）
- Type scale：12 個 token，1.2 modular scale，4px grid 對齊
- Font families：Newsreader（serif）/ Geist（sans）/ Geist Mono / Caveat（僅 ✓）+ Noto Sans/Serif TC 中文回退
- Color：paper + ink 中性系 + accent（**固定 moss `oklch(0.60 0.13 135)`**）+ flag（暖紅）+ carry（暖琥珀）
- Spacing：4px grid，11 個 token
- Radius：6 個 token，3px / 4px 為主（紙張感）
- 完整定義見 `Design Tokens.html` 的 `:root` 區塊

### 必做 MVP 功能
- [ ] 任務 CRUD + 計劃內/計劃外 標記
- [ ] 月/週/日三層 + 每層的「三件事」概念
- [ ] 兩個模式（Plan / Today）+ ⌘P / ⌘T 切換
- [ ] Carryover（昨/上週/上月未完成 → 三個動作）
- [ ] Daily task 連結 monthly task（完成連動，但 monthly top3 是 aggregate 不自動完成）
- [ ] Light / dark mode

### 還沒設計的東西（要跟 PM 確認再做）
- 空狀態 / 錯誤狀態 / 載入狀態
- 任務詳情（點開後的側欄或 dialog）
- 設定頁、搜尋（⌘K）、回顧視圖
- 詳見 `HANDOFF.md` 第 9 節

### Open Questions（要先解決）
詳見 `HANDOFF.md` 第 8 節 —— 包含後端選擇、同步機制、離線支援、時區、快捷鍵衝突等 9 個問題。

---

## Implementation Order（建議）

1. **Tokens 先行**：把 `Design Tokens.html` 的 `:root` 區塊轉成 `src/tokens/*.css`，配 `[data-theme="light|dark"]`。
2. **目錄骨架**：依 `HANDOFF.md` 第 3 節建立 `src/{tokens,lib,ui,features,pages}/`。
3. **`ui/` 層**：實作 `Button / Checkbox / Chip / ProgressBar / Menu / Dialog / SegmentedControl`，包 Base UI。每個元件配自己的 `.module.css`。
4. **Mock data**：把 `prototype/shared.jsx` 裡的 `MONTHLY_TOP3 / MONTHLY_OTHER / WEEK_DAYS / TODAY_TOP3 / TODAY_OTHER / *_LEFTOVER` 等常數抄到 `src/mock/data.ts`，先讓畫面跑起來。
5. **`features/` 層**：依序做 `shell` → `month` / `week` / `day` → `carryover` → `plan-view`。
6. **Pages + routing**：`PlanPage` / `TodayPage`，URL 反映 mode 與日期。
7. **狀態管理**：抽出 store，串 mock data。
8. **後端**：依 open question #1 的答案串接 API。

---

## Notes

- 互動細節（hover reveal、carryover banner 展開動畫、checkbox tick 等）以瀏覽器原型為準。
- 中英文混排 line-height 偏好 `1.3 ~ 1.45`，Noto Sans TC 的字身比 Geist 矮，所以 line-height 不要太小，會有上下不對齊感。
- Hand-drawn ✓ checkbox 是有意為之的設計語彙，**不要**改成 SVG 標準勾號。
- 設計刻意走「紙本筆記本」感 —— 配色偏暖、圓角偏小（3-4px）、陰影非常輕。**請勿**套用「Material-ish」的圓潤大圓角與深陰影。

如有任何設計細節不確定，**先打開原型在瀏覽器看**，再回頭問。
