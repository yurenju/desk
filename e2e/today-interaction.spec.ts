import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

test.beforeEach(async ({ page }) => {
  await gotoTodaySeeded(page);
});

test("adds a task and persists it across reload", async ({ page }) => {
  const input = page.getByPlaceholder("+ 加一件這天的事…");
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
  // Edit/delete now live behind the ⋯ overflow menu; reveal it on hover, open
  // it, then click the menu item (rendered in a portal, so query globally).
  await row.hover();
  await row.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: "刪除" }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  await page.getByText("復原").click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("adds a planned task by default, and an adhoc one after toggling the chip", async ({
  page,
}) => {
  const input = page.getByPlaceholder("+ 加一件這天的事…");

  // Default mode is planned → lands in 其他計劃內.
  await input.fill("計畫內的事");
  await input.press("Enter");
  const plannedSection = page
    .getByText("其他計劃內")
    .locator("xpath=ancestor::section[1]");
  await expect(plannedSection.getByText("計畫內的事")).toBeVisible();

  // Toggle the chip to 臨時, then add → lands in 今天臨時加的.
  await page.getByRole("button", { name: /新增模式/ }).click();
  await input.fill("臨時的事");
  await input.press("Enter");
  const adhocSection = page
    .getByText("今天臨時加的")
    .locator("xpath=ancestor::section[1]");
  await expect(adhocSection.getByText("臨時的事")).toBeVisible();
});

test("the mode chip persists across reload", async ({ page }) => {
  await page.getByRole("button", { name: /新增模式/ }).click();
  await expect(page.getByRole("button", { name: /新增模式:臨時/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /新增模式:臨時/ })).toBeVisible();
});
