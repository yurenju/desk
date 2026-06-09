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
