# Todo PATCH 序列化佇列設計

## 背景與問題

快速連點同一個 todo 的「重要與否」圓圈(priority ring)時,畫面會出現:

```
WSPC patchTodo failed: 409 {"error":{"code":"VERSION_CONFLICT","message":"version mismatch","current_version":16}}
```

### 根因

前端 `setDailyPriority`(`src/store/tasks.ts`)是 optimistic update:每次點擊立刻更新本地 state,並 fire 一個 PATCH。連點時這些 PATCH 透過 `Promise.all` 並發送出,互不等待。

worker 端 `patchTodo`(`worker/wspc.ts`)其實**沒有**帶 `expected_version`,但 WSPC 上游仍回 `VERSION_CONFLICT`。這代表 WSPC server 對 todo 更新採 read-modify-write + 樂觀鎖:兩個並發請求讀到同一個舊 version,第一個寫成功後 version 遞增,第二個基於過期 version 寫入就撞 409。

因此真正的問題是「**同一個 todo 同時存在多個 in-flight PATCH**」,而不是前端帶不帶 version。補上 version 欄位無法解決——只要兩個請求並發,第二個帶的 version 一樣是過期的。

## 目標

同一個 todo 永遠最多只有一個 in-flight PATCH,從源頭消除並發衝突。連點圓圈時使用者只在乎最終值,中間值可以合併丟棄。

## 非目標

- 不引入 `expected_version` 全鏈路傳遞、不做衝突重試。
- 不修改 worker 端(`wspc.ts`、`routes/todo.ts`)。
- 不在 `Task` type 增加 `version` 欄位。

## 設計

### 新單元:`todoQueue`

新檔案 `src/lib/api/todoQueue.ts`,單一職責——對 PATCH 做 per-id 序列化加合併。對外只暴露一個函式:

```ts
enqueuePatch(id: string, patch: TodoPatch): Promise<Task>
```

#### 內部狀態(per id)

每個 todo id 維護一筆 queue 狀態:

- `inflight`:是否有請求正在送出。
- `pendingPatch`:in-flight 期間累積合併的 patch(可能為空)。
- `pendingWaiters`:等待這批合併請求的 `{ resolve, reject }` 清單。

不同 id 的狀態互相獨立。

#### 流程

1. **該 id 沒有 in-flight** → 立刻呼叫 `patchTodoApi(id, patch)`,把它標記為 in-flight,回傳該 promise。請求結束(成功或失敗)後觸發該 id 的 flush。
2. **該 id 有 in-flight** → 用淺合併 `{ ...pendingPatch, ...patch }` 併入 `pendingPatch`(後者欄位覆蓋前者),並把一組新的 `{ resolve, reject }` 推入 `pendingWaiters`,回傳綁定到這批的新 promise。
3. **in-flight 結束(成功)**:
   - 若有 `pendingPatch`,取出合併後的 patch 送出,結果 broadcast 給所有 `pendingWaiters`(全部 resolve 同一個 `Task`),並遞迴處理(送出期間若又累積了新的 pending)。
   - 若沒有 pending,清除該 id 的 in-flight 標記。
4. **送出失敗**:該 id 整條 queue 作廢——清空 `pendingPatch`、reject 當前請求與所有 `pendingWaiters`、清除 in-flight 標記。讓上層去 reload 拿真相,不殘留半套狀態。

#### 合併語意

淺合併,後者覆蓋前者:

- `{ daily_priority: "1" }` 後接 `{ daily_priority: "2" }` → `{ daily_priority: "2" }`(連點 priority 的主要情境,只送最終值)。
- `{ status: "done" }` 後接 `{ daily_priority: "2" }` → `{ status: "done", daily_priority: "2" }`(混欄位也不丟資訊,一個請求帶兩欄位,WSPC 支援多欄位 patch)。

### store 層改動(`src/store/tasks.ts`)

序列化與錯誤回復是兩件事,範圍不同:

- **序列化(全部套用)**:所有 `patchTodoApi(...)` 呼叫改成 `enqueuePatch(...)`。optimistic update 維持不變,UI 仍即時反應。這層保護人人有份,防止任何對同一 id 的並發 PATCH。
- **錯誤回復(只有 `setDailyPriority` 改 reload)**:
  - `setDailyPriority` 是唯一會「連點合併」、又用 `Promise.all` 改多個 id 的 mutation。連點失敗時各 call 的 `set(prev)` 會用不同舊快照互相打架,還原到一個非 server 真相的中間值。因此它的 catch 改成 `await get().loadTasks(get().today)`,直接 reload 當日資料,靠既有 `loadSeq` 防競爭。
  - `toggleDone` / `editTitle` / `deleteTask` / `restoreTask` **維持現有 per-call rollback**。它們不會連點合併,rollback 仍正確,且保留 `recentlyDeleted`(undo)與 `error`(儲存失敗提示)語意——這些是 reload 無法照顧的附加狀態。

### 不需要動的部分

worker 端(`wspc.ts`、`routes/todo.ts`)、WSPC 的 `expected_version`、前端 `Task` type 都不用改。序列化後同一 id 永遠最多一個 in-flight,衝突從源頭消失。

## 資料流

連點 priority 1 → 2 → 3 的過程:

1. call1:optimistic 設為 1,`enqueuePatch(id, {daily_priority:"1"})` → 沒有 in-flight,立刻送 R1。
2. call2:optimistic 設為 2,`enqueuePatch` → R1 在飛,`pendingPatch = {daily_priority:"2"}`。
3. call3:optimistic 設為 3,`enqueuePatch` → 合併,`pendingPatch = {daily_priority:"3"}`。
4. R1 完成 → flush pending,送 R2 = `{daily_priority:"3"}`。
5. R2 完成 → call2、call3 的 promise 都 resolve。

整段最多送 2 個請求,且兩個從不並發。

## 錯誤處理

- 序列化後唯一還會失敗的情境主要是網路斷線(極端情況仍可能 conflict)。
- queue 層:任一 id 的請求失敗 → 該 id 整條 queue 作廢(清空 pending、reject 當前與所有 pending waiters、清除 in-flight 標記)。
- store 層:
  - `setDailyPriority` catch → `loadTasks(today)` reload,用既有 `loadSeq` 確保只有最新一次 commit 進 store。
  - 其他 mutation catch → 維持現有 `set({ tasks: prev, error: "save_failed" })` rollback,保留 undo 與 error 提示語意。

## 測試策略(TDD)

`todoQueue` 是純邏輯單元,以 `patchTodoApi` 為可注入/可 mock 的相依:

- 單一 patch:直接送出、resolve 回傳的 `Task`。
- 同 id 連續 enqueue:第一個送出,後續在 in-flight 期間合併,in-flight 完成後送出合併批次,所有 promise resolve 同一個結果。
- 合併語意:同欄位後者覆蓋;混欄位合併成一個請求帶多欄位。
- 不同 id:各自獨立,可並行送出(不會被彼此阻塞)。
- 失敗:in-flight 失敗時,該 id 的當前 promise 與所有 pending promise 全部 reject,queue 狀態清空。

store 層:

- `setDailyPriority` 失敗會呼叫 `loadTasks(today)` reload(而非 rollback 到 prev 快照)。
- 其他 mutation(toggleDone/editTitle/delete/restore)失敗維持現有 rollback 行為,既有測試不變。
