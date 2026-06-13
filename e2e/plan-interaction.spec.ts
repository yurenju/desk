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
  // The new task shows in the Day column AND the focus day's week cell (as an
  // "other" item), so scope to the first match instead of asserting uniqueness.
  await expect(page.getByText("焦點日新增測試").first()).toBeVisible();
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

test("drags a backlog task onto a non-focus week cell's top-3 zone (min-height regression)", async ({
  page,
}) => {
  // Navigate to a known date so the week layout is stable. Pick 2026-06-10 (Tue)
  // and drop onto the top-3 zone of 2026-06-12 (Thu) — a day with no pre-existing
  // tasks, so the zone would collapse to ~0 height without the min-height fix.
  await page.goto("/plan/2026-06-10");

  // Add a backlog task to use as the drag source.
  await page.getByRole("button", { name: /Backlog/ }).click();
  const input = page.getByPlaceholder("+ 加一件想做但還沒排的事…");
  await input.fill("週欄拖曳迴歸測試");
  await input.press("Enter");
  const source = page.getByText("週欄拖曳迴歸測試");
  await expect(source).toBeVisible();

  // Target: week cell top-3 zone for 2026-06-12 (non-focus day, should be empty →
  // relies on min-height so the zone has a hittable bounding box).
  const top3Zone = page.getByTestId("week-top3-2026-06-12");
  await expect(top3Zone).toBeVisible();

  // Scroll both source and target into the visible viewport before computing
  // bounding boxes. Without this the week column may be partially off-screen
  // and the drag endpoint coordinates would be outside the viewport, making
  // dnd-kit see no droppable under the pointer.
  //
  // Order matters: scroll the LOWER element (the week cell) in first, then the
  // UPPER element (the backlog source) last. The source sits above the target in
  // the document, so scrolling the target in pushes the source up; doing the
  // source last leaves it pinned at the top edge while the target — only ~500 px
  // below, well within the 720 px viewport — stays visible. Doing it the other
  // way round scrolls the source off the top (negative y), so page.mouse.down()
  // fires outside the viewport and the drag never activates. This only bit on
  // Windows, where larger font metrics make the plan layout tall enough that
  // source and target can't both be on screen at the default scroll position.
  await top3Zone.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();

  const sBox = await source.boundingBox();
  const tBox = await top3Zone.boundingBox();
  if (!sBox || !tBox) throw new Error("missing bounding box for drag");

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

  // The task should now appear specifically inside the top-3 <ol> for 2026-06-12.
  // Scoping to the top-3 zone (not just the whole cell) means a regression that drops
  // the task into the "other" sub-zone would NOT match here — the test would fail.
  await expect(top3Zone.getByText("週欄拖曳迴歸測試")).toBeVisible();
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

test("demotes a focus-day top-3 task to other by dragging within its week cell", async ({
  page,
}) => {
  // A focus-day task renders as a draggable in THREE places at once — the Day
  // column, the Month "other" list, and the Week cell — which must use distinct
  // dnd-kit ids or the drag breaks. This drags the week-cell copy from the
  // top-3 area down to the cell's lower half to clear its priority (demote).
  await page.goto("/plan/2026-06-10");
  await page.getByRole("button", { name: /Backlog/ }).click();
  const input = page.getByPlaceholder("+ 加一件想做但還沒排的事…");
  await input.fill("焦點降級測試");
  await input.press("Enter");

  // Promote to the focus day (2026-06-10) as ① via the backlog row menu.
  const row = page
    .locator("div")
    .filter({ has: page.getByText("焦點降級測試") })
    .filter({ has: page.getByRole("button", { name: "更多動作" }) })
    .last();
  await row.getByRole("button", { name: "更多動作" }).click();
  await page.getByRole("menuitem", { name: /· ① 三件事/ }).click();

  // It now shows in the focus-day week cell's top-3 zone.
  const top3 = page.getByTestId("week-top3-2026-06-10");
  await expect(top3.getByText("焦點降級測試")).toBeVisible();

  // Drag the week-cell item down into the lower (other) half of the cell.
  const source = top3.getByText("焦點降級測試");
  const cell = page.getByTestId("week-cell-2026-06-10");
  await source.scrollIntoViewIfNeeded();
  const sBox = await source.boundingBox();
  const cBox = await cell.boundingBox();
  if (!sBox || !cBox) throw new Error("missing bounding box for drag");

  const sx = sBox.x + sBox.width / 2;
  const sy = sBox.y + sBox.height / 2;
  const tx = cBox.x + cBox.width / 2;
  const ty = cBox.y + cBox.height * 0.85; // lower half → "other"

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 12, sy + 12, { steps: 5 });
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.mouse.up();

  // Demoted: the task is no longer in the focus day's top-3 zone.
  await expect(top3.getByText("焦點降級測試")).toBeHidden();
});

test("promotes a focus-day other task to top-3 by dragging up within its week cell", async ({
  page,
}) => {
  // The reverse of the demote: an "other" task is now a draggable item in the
  // week cell (not just a count), so it can be dragged UP into the top-3 area.
  await page.goto("/plan/2026-06-10");

  // Add a task to the focus day via the Day column — it lands as "other" (no
  // priority), and appears as an item in the focus day's week cell.
  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("焦點升級測試");
  await input.press("Enter");

  const cell = page.getByTestId("week-cell-2026-06-10");
  const top3 = page.getByTestId("week-top3-2026-06-10");
  // Starts outside the top-3 zone.
  await expect(top3.getByText("焦點升級測試")).toBeHidden();
  const source = cell.getByText("焦點升級測試");
  await expect(source).toBeVisible();

  await source.scrollIntoViewIfNeeded();
  const sBox = await source.boundingBox();
  const tBox = await top3.boundingBox();
  if (!sBox || !tBox) throw new Error("missing bounding box for drag");

  const sx = sBox.x + sBox.width / 2;
  const sy = sBox.y + sBox.height / 2;
  const tx = tBox.x + tBox.width / 2;
  const ty = tBox.y + tBox.height / 2; // upper (top-3) area

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 12, sy - 12, { steps: 5 });
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.mouse.up();

  // Promoted: the task now shows inside the focus day's top-3 zone.
  await expect(top3.getByText("焦點升級測試")).toBeVisible();
});

test("recurring occurrence lands on its day with ↻ and stays out of backlog", async ({
  page,
}) => {
  // Seed has a recurring occurrence ("每日例行") for 2026-06-13 with no scheduled_dates;
  // the BFF mapper must schedule it onto that day (not backlog).
  await page.goto("/plan/2026-06-13");

  // It shows on today's day/week views, marked recurring.
  await expect(page.getByText("每日例行").first()).toBeVisible();
  await expect(page.getByLabel("重複任務")).toHaveCount(1);
  await expect(page.getByLabel("重複任務")).toBeVisible();

  // Backlog stays empty — the occurrence was scheduled, not dumped into backlog.
  await expect(page.getByRole("button", { name: /Backlog \(0\)/ })).toBeVisible();
});

test("shows a live top-3 / other hint while dragging over a week cell", async ({ page }) => {
  // A week cell is one droppable split by vertical position, so it must tell the
  // user mid-drag which half they're over. Drag, settle over the cell centre,
  // then nudge up vs down (small offsets, to stay clear of neighbour cells whose
  // rects the drag would otherwise intersect) and assert the active badge.
  await page.goto("/plan/2026-06-10");
  await page.getByRole("button", { name: /Backlog/ }).click();
  const input = page.getByPlaceholder("+ 加一件想做但還沒排的事…");
  await input.fill("HINT來源");
  await input.press("Enter");
  const source = page.getByText("HINT來源");
  await expect(source).toBeVisible();

  const cell = page.getByTestId("week-cell-2026-06-10");
  await cell.scrollIntoViewIfNeeded();
  const sBox = await source.boundingBox();
  const cBox = await cell.boundingBox();
  if (!sBox || !cBox) throw new Error("missing bounding box for drag");

  const sx = sBox.x + sBox.width / 2;
  const sy = sBox.y + sBox.height / 2;
  const cx = cBox.x + cBox.width / 2;
  const cy = cBox.y + cBox.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 12, sy + 12, { steps: 3 });
  await page.mouse.move(cx, cy, { steps: 8 });

  // While dragging over a week cell, both half labels appear (on whichever cell
  // is under the pointer) and exactly one is highlighted as the live drop half.
  // (Which half is correct for a given pointer position is covered by the
  // demote/promote drop tests; asserting it here is brittle under drag
  // auto-scroll, which shifts the pre-measured cell coordinates.)
  await expect(page.getByText("↑ 三件事")).toBeVisible();
  await expect(page.getByText("↓ 其他")).toBeVisible();
  await expect(page.locator('[class*="dropTagActive"]')).toHaveCount(1);

  await page.mouse.up();
});
