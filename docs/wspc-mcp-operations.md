# 用 wspc MCP 操作 Yuren's Desk 帳號

這份文件給「直接透過 **wspc MCP** 連到某個 Desk 帳號」的 AI agent 看。Desk 的所有排程語意都靠 WSPC todo 的 **custom fields** 表達，UI 上的每個動作（排到本月、排到今天、設三件事、計畫外⋯）其實只是在改這些欄位。要讓 MCP 操作出來的結果跟使用者在畫面上做的一致，就得照同一套欄位寫法。

> Desk 沒有自己的 API；前端是純 BFF + WSPC。MCP 直接打 WSPC，看到的 `custom_fields` 跟前端讀寫的**完全是同一份**（worker 只做 round-trip，不改 key）。所以這份文件描述的欄位語意對「畫面」和「MCP」都成立。

## 先決條件：找到 project_id 與 type_id

Desk 的 todo 必須屬於名為 **Desk** 的 project，且型態是 **DeskTask**（帶這些 custom field 的自訂 type）。第一次登入 Desk 時 BFF 會 lazy 建好。用 MCP 操作前先取得兩個 id：

1. `todo_project_list` → 找 `name === "Desk"` 的 project，記下 `project_id`。
2. `todo_type_list`（帶該 `project_id`）→ 找 `label === "DeskTask"` 的 type，記下 `type_id`。

- **`todo_create` 一定要帶 `type_id`**，否則套到預設 type、沒有這些 custom field，之後排程會 `UNDECLARED_FIELD` / `UNKNOWN_CUSTOM_FIELD`。
- `todo_update` 用既有 todo 的 id 操作、沿用原 type，**不傳 type_id**。
- `todo_list` 的 `type_id` 只是選用 filter。

> Yuren 本人的帳號 id（已知常數，可略過上面查詢）：
> `project_id = prj_01KT1KDQF60MH0Q9QBS8Q33321`、`type_id = typ_01KT1KDRV40GPSMS3P1MYP0B9G`。
> 其他帳號各自不同，務必先查。

## 資料模型：三層漏斗

所有層級共用同一個 `DeskTask` 型態，差別只在 custom fields。**月與日兩層對稱**：都用 `scheduled_*` array 累積軌跡 + `unscheduled_*` 標記「目前歸屬被收回到哪」。

```
Backlog   scheduled_months 空，或 last(scheduled_months) <= unscheduled_month
   ↓ 排到某月（append 到 scheduled_months）
Monthly   last(scheduled_months) > unscheduled_month，且還沒排到有效日期
   ↓ 排到某天（append 到 scheduled_dates）
Daily     last(scheduled_dates) > unscheduled_at
```

**核心規則：`scheduled_*` 永不 remove，移動 = append。** 陣列長度就是跨月 / 跨日拖延的次數，是刻意保留的軌跡。要「收回」某層歸屬不是刪元素，而是把 `unscheduled_*` 設到那一層的 `last`，讓推導出來的 primary 變 null。

同一個 task 可同時出現在月度欄與日欄（月度欄顯示所有目前歸屬本月的 task，含已排到某天的）。

### 推導邏輯（前端怎麼判斷一個 task 在哪一層）

| 推導值 | 規則 |
|---|---|
| `primaryMonth` | `last(scheduled_months)`，但只有當它 `>` `unscheduled_month` 才算數，否則 `null` |
| `primaryDate` | `last(scheduled_dates)`，但只有當它 `>` `unscheduled_at` 才算數，否則 `null` |
| `layer` | 有 `primaryDate` → **daily**；否則有 `primaryMonth` → **monthly**；否則 **backlog** |

字串大小用 ISO 字典序比較（`"2026-06-27" > "2026-06"` 這類比較都成立，因為格式固定、左補零）。

## Custom Fields 清單

| Field | 型別 | 用途 |
|---|---|---|
| `scheduled_months` | string_array | 曾被排到的月份 `"YYYY-MM"`；**append-only**，移月 = append |
| `scheduled_dates` | string_array | 曾被排到的日期 `"YYYY-MM-DD"`；**append-only**，移日 = append |
| `unscheduled_month` | string | 最後一次從月度收回 / 丟回 backlog 的月份 `"YYYY-MM"` |
| `unscheduled_at` | string | 最後一次從某天收回 / 丟回月度的日期 `"YYYY-MM-DD"` |
| `daily_ranks` | string_array | 每日三件事排名，元素格式 `"YYYY-MM-DD:R"`（R ∈ `1/2/3`）。**目前的真實來源** |
| `monthly_ranks` | string_array | 每月三件事排名，元素格式 `"YYYY-MM:R"`。**目前的真實來源** |
| `daily_priority` | string | （**legacy，淘汰中**）舊的單值日排名 `1/2/3`。新寫入一律走 `daily_ranks`，並把這欄清掉 |
| `monthly_priority` | string | （**legacy，淘汰中**）舊的單值月排名。同上，改走 `monthly_ranks` |
| `is_adhoc` | string | `"true"` / `"false"`，進清單時是否為臨時插單 |
| `done_on` | string | 完成時間 ISO；前端 PATCH `status:"done"` 時同步寫 |
| `position` | string | 同層手排用的 lex-order 字串（活動池排序，非三件事） |

**不使用 WSPC 核心 `due_at`** —— 排程日期完全由 `scheduled_dates` 表達。
**`status` enum**：`open / in_progress / done / cancelled`。下文「未完成」= `status ∈ {open, in_progress}`。

### 三件事排名為什麼是陣列

每個 scope（某一天、某一月）各自獨立排三件事。`daily_ranks = ["2026-06-27:1", "2026-06-28:2"]` 表示這個 task 在 6/27 是第①、在 6/28 是第②。所以「同一個跨日拖延的 task，每天的名次互相獨立」要靠陣列存。

讀某天名次：在 `daily_ranks` 找 key == 該日的元素。找不到時 fallback：若 `daily_ranks` 為空且該日 == `primaryDate`，才退回讀 legacy `daily_priority`。`monthly_ranks` 對 `monthly_priority` 完全對稱。

**寫入時務必同時把對應的 legacy 單值欄清成 `undefined`（移除）**，否則 fallback 會復活舊值。

## UI 詞彙 ↔ 結構對照

| 畫面用語 | 意思 | 結構 |
|---|---|---|
| **Backlog / 待辦** | 還沒決定哪個月做 | `scheduled_months` 空或已 unschedule、`scheduled_dates` 同 |
| **本月（Monthly）** | 歸屬某個月、還沒排到某天 | `primaryMonth` = 該月、`primaryDate` 為 null |
| **三件事（月）** | 整月最重要 3 件 | `monthly_ranks` 有該月的 `1/2/3` |
| **其他計劃內（月）** | 歸屬本月但沒進前 3 名 | `primaryMonth` = 該月、該月 `monthly_ranks` 無名次、`is_adhoc:"false"` |
| **排到某天（Daily）** | 在某天執行 | `primaryDate` = 該日 |
| **三件事（日）/ 今天的重要事項** | 某天最重要 3 件 | `daily_ranks` 有該日的 `1/2/3` |
| **其他計劃內（日）** | 排在該天但沒進前 3 名 | `primaryDate` = 該日、該日 `daily_ranks` 無名次、`is_adhoc:"false"` |
| **計畫內（planned）** | 事先規劃的 | `is_adhoc:"false"` |
| **計畫外（adhoc）** | 當天 / 月中臨時插單 | `is_adhoc:"true"` |

> 「計畫內 / 計畫外」只是 `is_adhoc` 這個布林標記，跟排在哪層無關。日欄那顆紅色「計畫外」chip 還更嚴格：只在「`is_adhoc:"true"` **且** 當天建立 **且** 只排當天」才亮（真正的當日臨時插單），避免畫面一片紅。月度欄則無條件對 adhoc task 顯示紅 chip（「月中膨脹」警示）。

## 常見指令 → 怎麼寫

下面 `today` = 本地今天 `YYYY-MM-DD`，`thisMonth` = `YYYY-MM`。所有「移動」都是 append + 視情況補月，**不要去刪 `scheduled_*` 既有元素**。寫 `custom_fields` 時只帶要改的 key（worker 是 merge patch），但「清欄位」要顯式送該 key 為空 / null（依 MCP schema；清不掉時改送空字串）。

### 排到 backlog（新建）

`todo_create`（帶 `project_id` + `type_id`）：

```jsonc
{
  "title": "…",
  "custom_fields": {
    "scheduled_months": [],
    "scheduled_dates": [],
    "is_adhoc": "false"
  }
}
```

判定條件是「既沒有有效 primaryMonth 也沒有有效 primaryDate」。

### 排到這個月（新建）

```jsonc
{
  "title": "…",
  "custom_fields": {
    "scheduled_months": ["2026-06"],   // thisMonth；不要帶 scheduled_dates
    "is_adhoc": "false"                // 月中追加才設 "true"
  }
}
```

把**既有**的 backlog task 排到本月：`todo_update`，`scheduled_months` = 原陣列 **append** `thisMonth`（若 last 已是該月則不動）。

### 排到今天 / 某天（新建一件當天的事）

```jsonc
{
  "title": "…",
  "custom_fields": {
    "scheduled_dates": ["2026-06-27"], // today
    "is_adhoc": "true"                 // 「+ 加一件今天的事」入口預設 adhoc
  }
}
```

把既有 task（backlog 或 monthly）**排到某天**：`todo_update`
- `scheduled_dates`：append 該日（若已有 primaryDate 代表是「改天」，則 replace 陣列最後一筆而非 append——保留更早的真實軌跡）。
- `scheduled_months`：若該日所屬月還不是 `primaryMonth`，append 該月（補月，確保它在月度欄也在）。

### 設「今天的重要事項 / 三件事」名次

設 task 在某 scope 為第 N 名（N ∈ `1/2/3`）：`todo_update`
- `daily_ranks`：在陣列中 set/replace key == 該日的元素為 `"<date>:N"`（日層）；月層改 `monthly_ranks` + `"<month>:N"`。
- 同時把 legacy `daily_priority`（或 `monthly_priority`）清掉。
- **騰位**：同 scope 已有別的 task 佔著第 N 名時，把那個 task 的同 scope 名次移除（UI 是「擲位」語意——你插進來，原本第 N 名被擠掉）。若要嚴格複刻 UI 的「插入 + 連鎖下推 + 第 4 名溢出到『其他』」，得讀出該 scope 目前 1/2/3 三筆一起重排，溢出者清名次並給一個排在「其他」池最前的 `position`。多數情況直接 set + 擠掉碰撞者即可。

移除名次（從三件事拿下來，仍排在該天 / 該月當「其他計劃內」）：把該 scope 的 rank 元素從陣列移掉、legacy 欄清掉。

### 計畫內 ⇄ 計畫外切換

只改 `is_adhoc`：`"false"`（計畫內）⇄ `"true"`（計畫外）。不動排程欄位。

### 移到下個月（保留軌跡）

`todo_update`：`scheduled_months` append「自己 last 月 + 1」、清 `monthly_priority`（legacy）。`monthly_ranks` 不動（舊月名次是保留的歷史，新月自然沒名次）。

### 丟回 backlog（把已排程的退回，保留軌跡）

`todo_update`：
- `unscheduled_month` = `last(scheduled_months)`（收回月度歸屬）
- `unscheduled_at` = `max(today, last(scheduled_dates))`（連未來日也一起收回）
- 清 `monthly_priority`、`daily_priority`（legacy）
- `scheduled_*` 陣列**不動**（軌跡留著）；`*_ranks` 也不動（歷史）

效果：`primaryMonth` / `primaryDate` 推導後都變 null → 落回 backlog。

### 丟回月度（從某天退回，仍歸屬本月）

`todo_update`：
- `unscheduled_at` = 該 task 所在日期（= `last(scheduled_dates)`）
- 確保 `scheduled_months` 仍含當月（不含則 append）
- 清 `daily_priority`（legacy）；`daily_ranks` 把該日名次寫實後保留（軌跡列會顯示「↩ 已退回本月」）

### 完成 / 取消完成

完成：`status:"done"` + `custom_fields.done_on` = ISO 時間。
取消：`status:"open"`，清 `done_on`。

## 容易踩的雷

- **不要刪 `scheduled_*` 元素來「移動」**——那會破壞軌跡與拖延次數。移動一律 append（或 replace last），收回用 `unscheduled_*`。
- **`*_priority` 是 legacy**：新寫入請用 `*_ranks` 陣列，且把對應 legacy 單值清掉，否則 fallback 復活舊值、UI 名次錯亂。
- **`scheduled_months` / `scheduled_dates` / `daily_ranks` / `monthly_ranks` 是 string_array**；`unscheduled_*` / `*_priority` / `is_adhoc` / `done_on` / `position` 是 string。型別錯會 422。
- **排到某天記得補月**：只 append `scheduled_dates` 不補 `scheduled_months`，會出現「在日欄看得到、月欄不見」的不一致。
- **`todo_create` 必帶 `type_id`**；`todo_update` 不要帶。
