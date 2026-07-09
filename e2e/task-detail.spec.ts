import { test, expect, type Page } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

/**
 * Find the task row/item container that holds the given title text.
 * Top-3 tasks live in <li class="item">; other tasks in <div class="row ...">
 * [last()] selects the innermost matching ancestor.
 */
function taskContainer(page: Page, title: string) {
  return page
    .locator(`text=${title}`)
    .locator(
      "xpath=(ancestor::*[self::li[contains(@class,'item')] or (self::div and contains(@class,'row') and not(contains(@class,'titleRow')))])[last()]",
    );
}

test.beforeEach(async ({ page }) => {
  await gotoTodaySeeded(page);
});

test("opens detail, shows description + subtask, adds and toggles", async ({ page }) => {
  const row = taskContainer(page, "完成 desk.yurenju.me todo MVP demo");
  await row.hover();
  await row.getByLabel("開啟詳情").click();

  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("strong", { hasText: "MVP" })).toBeVisible();
  await expect(dialog.getByText("0 / 1")).toBeVisible();

  await dialog.getByPlaceholder("新增子任務…").fill("second subtask");
  await dialog.getByPlaceholder("新增子任務…").press("Enter");
  await expect(dialog.getByText("0 / 2")).toBeVisible();

  await dialog.getByLabel("first subtask").click();
  await expect(dialog.getByText("1 / 2")).toBeVisible();
});

test("edits description and persists across reopen", async ({ page }) => {
  const row = taskContainer(page, "寫週報 + 5 月中檢視");
  await row.hover();
  await row.getByLabel("開啟詳情").click();

  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await expect(dialog).toBeVisible();

  await dialog.getByText("加上描述…").click();
  await dialog.getByLabel("編輯描述").fill("weekly **report** plan");
  await dialog.getByLabel("編輯描述").blur();
  await expect(dialog.locator("strong", { hasText: "report" })).toBeVisible();

  await dialog.getByLabel("關閉").click();
  await row.getByLabel("開啟詳情").click();
  await expect(dialog.locator("strong", { hasText: "report" })).toBeVisible();
});

test("navigates into a subtask's detail and back to the parent", async ({ page }) => {
  const row = taskContainer(page, "完成 desk.yurenju.me todo MVP demo");
  await row.hover();
  await row.getByLabel("開啟詳情").click();

  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("開啟子任務詳情").click();
  await expect(dialog.getByLabel("任務標題")).toHaveValue("first subtask");

  // The subtask modal is a full detail modal: edit its description there.
  await dialog.getByText("加上描述…").click();
  await dialog.getByLabel("編輯描述").fill("subtask body");
  await dialog.getByLabel("編輯描述").blur();
  await expect(dialog.getByText("subtask body")).toBeVisible();

  await dialog.getByLabel("返回上層任務").click();
  await expect(dialog.getByLabel("任務標題")).toHaveValue("完成 desk.yurenju.me todo MVP demo");
  await expect(dialog.getByLabel("返回上層任務")).toHaveCount(0);
});

test("deletes a subtask from its own modal and returns to the parent", async ({ page }) => {
  const row = taskContainer(page, "完成 desk.yurenju.me todo MVP demo");
  await row.hover();
  await row.getByLabel("開啟詳情").click();

  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await dialog.getByLabel("開啟子任務詳情").click();
  await expect(dialog.getByLabel("任務標題")).toHaveValue("first subtask");

  await dialog.getByText("🗑 刪除任務").click();
  await expect(dialog.getByLabel("任務標題")).toHaveValue("完成 desk.yurenju.me todo MVP demo");
  await expect(dialog.getByTestId("subtask-row")).toHaveCount(0);
});

test("reorders subtasks by dragging and persists across reopen", async ({ page }) => {
  const row = taskContainer(page, "完成 desk.yurenju.me todo MVP demo");
  await row.hover();
  await row.getByLabel("開啟詳情").click();

  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await dialog.getByPlaceholder("新增子任務…").fill("second subtask");
  await dialog.getByPlaceholder("新增子任務…").press("Enter");
  await expect(dialog.getByTestId("subtask-row")).toHaveCount(2);

  // Drag the second subtask's handle above the first row.
  const handles = dialog.getByLabel("拖曳排序");
  const sBox = await handles.nth(1).boundingBox();
  const tBox = await dialog.getByTestId("subtask-row").first().boundingBox();
  if (!sBox || !tBox) throw new Error("drag: missing bounding box");
  const sx = sBox.x + sBox.width / 2;
  const sy = sBox.y + sBox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 12, sy + 12, { steps: 5 });
  await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + 2, { steps: 15 });
  await page.mouse.up();
  // Brief wait for React state to settle after drag (same as plan-reorder).
  await page.waitForTimeout(300);

  await expect(dialog.getByTestId("subtask-row")).toHaveText([
    /second subtask/,
    /first subtask/,
  ]);

  // Reopen: the order comes back from the server's position sort.
  await dialog.getByLabel("關閉").click();
  await expect(dialog).toBeHidden();
  await row.getByLabel("開啟詳情").click();
  await expect(dialog.getByTestId("subtask-row")).toHaveText([
    /second subtask/,
    /first subtask/,
  ]);
});

test("closing the modal removes the blocking backdrop", async ({ page }) => {
  const row = taskContainer(page, "完成 desk.yurenju.me todo MVP demo");
  await row.hover();
  await row.getByLabel("開啟詳情").click();
  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("關閉").click();
  // With the closed-state hidden, the dialog is no longer visible and its
  // backdrop no longer intercepts pointer events. toBeHidden fails if the
  // closed popup/backdrop linger in the layout.
  await expect(dialog).toBeHidden();
});
