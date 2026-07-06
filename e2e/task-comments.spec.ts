import { test, expect, type Page } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

function taskContainer(page: Page, title: string) {
  return page
    .locator(`text=${title}`)
    .locator(
      "xpath=(ancestor::*[self::li[contains(@class,'item')] or (self::div and contains(@class,'row') and not(contains(@class,'titleRow')))])[last()]",
    );
}

async function openDetail(page: Page, title: string) {
  const row = taskContainer(page, title);
  await row.hover();
  await row.getByLabel("開啟詳情").click();
  const dialog = page.getByRole("dialog", { name: "任務詳情" });
  await expect(dialog).toBeVisible();
  return { row, dialog };
}

test.beforeEach(async ({ page }) => {
  await gotoTodaySeeded(page);
});

test("adds a comment and it persists across reopen", async ({ page }) => {
  const { row, dialog } = await openDetail(page, "完成 desk.yurenju.me todo MVP demo");

  await dialog.getByPlaceholder("新增留言…").fill("first comment");
  await dialog.getByPlaceholder("新增留言…").press("Enter");
  await expect(dialog.getByText("first comment")).toBeVisible();

  await dialog.getByLabel("關閉").click();
  await row.getByLabel("開啟詳情").click();
  await expect(dialog.getByText("first comment")).toBeVisible();
});

test("edits a comment and shows the edited marker", async ({ page }) => {
  const { dialog } = await openDetail(page, "寫週報 + 5 月中檢視");

  await dialog.getByPlaceholder("新增留言…").fill("draft note");
  await dialog.getByPlaceholder("新增留言…").press("Enter");
  await expect(dialog.getByText("draft note")).toBeVisible();

  await dialog.getByLabel("編輯留言").click();
  const editor = dialog.getByLabel("編輯留言內容");
  await editor.fill("final note");
  await editor.press("Enter");
  await expect(dialog.getByText("final note")).toBeVisible();
  await expect(dialog.getByText(/已編輯/)).toBeVisible();
});

test("deletes a comment", async ({ page }) => {
  const { row, dialog } = await openDetail(page, "retro:整理本週學習+下週主題");

  await dialog.getByPlaceholder("新增留言…").fill("to be removed");
  await dialog.getByPlaceholder("新增留言…").press("Enter");
  await expect(dialog.getByText("to be removed")).toBeVisible();

  await dialog.getByLabel("刪除留言").click();
  await expect(dialog.getByText("to be removed")).not.toBeVisible();

  await dialog.getByLabel("關閉").click();
  await row.getByLabel("開啟詳情").click();
  await expect(dialog.getByText("to be removed")).not.toBeVisible();
});
