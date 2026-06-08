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

test("adds a backlog task and promotes it to the focus day via menu", async ({ page }) => {
  await page.goto("/plan/2026-06-10");
  // Expand the Backlog section
  await page.getByRole("button", { name: /Backlog/ }).click();
  // Add a new backlog task
  const input = page.getByPlaceholder("+ 加一件想做但還沒排的事…");
  await input.fill("backlog 測試任務");
  await input.press("Enter");
  await expect(page.getByText("backlog 測試任務")).toBeVisible();

  // Promote via the row's ⋯ menu — target slot ①
  const row = page
    .locator("div")
    .filter({ has: page.getByText("backlog 測試任務") })
    .filter({ has: page.getByRole("button", { name: "更多動作" }) })
    .last();
  await row.getByRole("button", { name: "更多動作" }).click();
  await page.getByRole("menuitem", { name: /· ① 三件事/ }).click();

  // The task should now appear inside the Day column's Top3 card
  const top3Card = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: /最重要的三件事/ }) })
    .last();
  await expect(top3Card.getByText("backlog 測試任務")).toBeVisible();
});

test("drags a backlog task onto the focus day's top-3 zone", async ({ page }) => {
  // Navigate to today so the seeded top-3 tasks are present, making the
  // Top3Card (and its heading) a stable drop target that exists before the drag.
  await page.goto("/plan");
  // Expand the Backlog section
  await page.getByRole("button", { name: /Backlog/ }).click();
  // Add a new backlog task to use as the drag source
  const input = page.getByPlaceholder("+ 加一件想做但還沒排的事…");
  await input.fill("拖曳測試任務");
  await input.press("Enter");
  const source = page.getByText("拖曳測試任務");
  await expect(source).toBeVisible();

  // Target: the top-3 drop zone in the Day column. The data-testid is always
  // in the DOM (min-height keeps it interactive even when empty). When today
  // already has top-3 tasks the Top3Card renders inside it, giving it a real
  // bounding box we can reliably drop onto.
  const top3Zone = page.getByTestId("top3-drop-zone");
  await expect(top3Zone).toBeVisible();

  const sBox = await source.boundingBox();
  const tBox = await top3Zone.boundingBox();
  if (!sBox || !tBox) throw new Error("missing bounding box for drag");

  // dnd-kit PointerSensor needs pointer-down + move > 8 px before activation.
  // Use stepped mouse moves: small diagonal first (exceeds 8 px), then to centre
  // of the target zone.
  const sx = sBox.x + sBox.width / 2;
  const sy = sBox.y + sBox.height / 2;
  const tx = tBox.x + tBox.width / 2;
  const ty = tBox.y + tBox.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // First move must exceed the 8 px activation distance
  await page.mouse.move(sx + 20, sy + 20, { steps: 5 });
  // Then move to the drop target
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.mouse.up();

  // After drop the task should be in the Day column's Top3 card
  const top3Card = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: /最重要的三件事/ }) })
    .last();
  await expect(top3Card.getByText("拖曳測試任務")).toBeVisible();
});
