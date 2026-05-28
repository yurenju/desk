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
