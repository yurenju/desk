import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/today");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("adds a task and persists it across reload", async ({ page }) => {
  const input = page.getByPlaceholder("+ 加一件今天的事…");
  await input.fill("打電話給水電師傅");
  await input.press("Enter");
  await expect(page.getByText("打電話給水電師傅")).toBeVisible();

  await page.reload();
  await expect(page.getByText("打電話給水電師傅")).toBeVisible();
});

test("completes a task via its checkbox", async ({ page }) => {
  const row = page
    .locator("text=讀 WSPC custom fields 文件")
    .locator("xpath=ancestor::div[contains(@class, 'row') and not(contains(@class, 'titleRow'))]");
  await row.getByRole("checkbox").first().click();
  await expect(row.getByRole("checkbox").first()).toBeChecked();
});

test("deletes a task and undoes it", async ({ page }) => {
  const title = "回覆 Acme 客戶整合詢問";
  const row = page
    .locator(`text=${title}`)
    .locator("xpath=ancestor::div[contains(@class, 'row') and not(contains(@class, 'titleRow'))]");
  await row.hover();
  await row.getByLabel("刪除").click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  await page.getByText("復原").click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});
