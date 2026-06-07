import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

test.beforeEach(async ({ page }) => {
  await gotoTodaySeeded(page);
  await page.goto("/plan");
});

test("shows this month's tasks in the Monthly column", async ({ page }) => {
  await expect(page.getByText("本月最重要的事 A")).toBeVisible();
});

test("adds a month task and persists across reload", async ({ page }) => {
  const input = page.getByPlaceholder("+ 加一件這個月要做的事…");
  await input.fill("月度新增測試");
  await input.press("Enter");
  await expect(page.getByText("月度新增測試")).toBeVisible();
  await page.reload();
  await expect(page.getByText("月度新增測試")).toBeVisible();
});

test("month stepper changes the focus date in the URL", async ({ page }) => {
  await page.getByLabel("下個月").click();
  await expect(page).toHaveURL(/\/plan\/\d{4}-\d{2}-\d{2}$/);
});

test("clicking a week day cell moves the focus date", async ({ page }) => {
  // Week column day cells are links labelled "切到 <date>".
  const cell = page.getByLabel(/^切到 \d{4}-\d{2}-\d{2}$/).first();
  await cell.click();
  await expect(page).toHaveURL(/\/plan\/\d{4}-\d{2}-\d{2}$/);
});

test("week stepper shifts the focus date by seven days", async ({ page }) => {
  await page.goto("/plan/2026-06-10");
  await page.getByLabel("下一週").click();
  await expect(page).toHaveURL("/plan/2026-06-17");
  await page.getByLabel("上一週").click();
  await expect(page).toHaveURL("/plan/2026-06-10");
});

test("plan day column can add a task to the focus date", async ({ page }) => {
  await page.goto("/plan/2026-06-10");
  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("焦點日新增測試");
  await input.press("Enter");
  await expect(page.getByText("焦點日新增測試")).toBeVisible();
});

test("promotes a month task into the focus day's top-3 via the overflow menu", async ({ page }) => {
  // "本月其他計畫 B" is a pure month task (no day scheduling). Promoting it as ①
  // schedules it onto the focus day AND lands it in that day's top-3 card.
  const row = page
    .locator("div")
    .filter({ has: page.getByText("本月其他計畫 B") })
    .filter({ has: page.getByRole("button", { name: "更多動作" }) })
    .last();
  await row.getByRole("button", { name: "更多動作" }).click();
  await page.getByRole("menuitem", { name: /· ① 三件事/ }).click();

  const top3Card = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: "今天最重要的三件事" }) })
    .last();
  await expect(top3Card.getByText("本月其他計畫 B")).toBeVisible();
});
