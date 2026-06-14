import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

const rowOf = (page: import("@playwright/test").Page, title: string) =>
  page
    .locator(`text=${title}`)
    .locator("xpath=ancestor::div[contains(@class,'row') and not(contains(@class,'titleRow'))]");

test("move-to-today forwards a past-day task into today", async ({ page }) => {
  await gotoTodaySeeded(page);

  // Compute yesterday in local time (matches the app's todayISO()).
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

  // Navigate straight to yesterday's focus view (avoids week-rail DOM-order /
  // Sunday edge cases; the seed/session persists across this navigation).
  await page.goto(`/focus/${yesterday}`);
  await expect(page).toHaveURL(new RegExp(`/focus/${yesterday}$`));

  // add an open task on that past day
  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("順延 e2e");
  await input.press("Enter");

  // ⋯ → 移到今天
  const row = rowOf(page, "順延 e2e");
  await row.hover();
  await row.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: /移到今天/ }).click();

  // back to today → it now lives here
  await page.getByRole("navigation", { name: "週導覽" }).getByRole("link", { name: "回今天" }).click();
  // The app may redirect to /focus or /focus/<today-iso> — accept either.
  await expect(page).toHaveURL(/\/focus(\/\d{4}-\d{2}-\d{2})?$/);
  await expect(page.getByText("順延 e2e")).toBeVisible();
});

test("move-to-today forwards a past-day top-3 task into today", async ({ page }) => {
  await gotoTodaySeeded(page);

  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

  await page.goto(`/focus/${yesterday}`);
  await expect(page).toHaveURL(new RegExp(`/focus/${yesterday}$`));

  // add an open task on that past day, then promote it into the top-3 card
  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("順延重點 e2e");
  await input.press("Enter");

  const taskRow = rowOf(page, "順延重點 e2e");
  await taskRow.hover();
  await taskRow.getByRole("button", { name: /今日重點/ }).click();
  await page.getByRole("menuitemradio", { name: /今日第一/ }).click();

  // now it lives in the top-3 card (a <li>); move it to today from there.
  // Scope to the <li> that owns an overflow menu — the week-rail day chip also
  // contains the title text but has no 更多動作 button.
  const top3Item = page
    .locator("li", { hasText: "順延重點 e2e" })
    .filter({ has: page.getByLabel("更多動作") });
  await top3Item.hover();
  await top3Item.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: /移到今天/ }).click();

  // back to today → it now lives here
  await page.getByRole("navigation", { name: "週導覽" }).getByRole("link", { name: "回今天" }).click();
  await expect(page).toHaveURL(/\/focus(\/\d{4}-\d{2}-\d{2})?$/);
  await expect(page.getByText("順延重點 e2e")).toBeVisible();
});

test("demote-to-month turns a day task into a 退回月度 trail", async ({ page }) => {
  await gotoTodaySeeded(page);

  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("退回 e2e");
  await input.press("Enter");

  const row = rowOf(page, "退回 e2e");
  await row.hover();
  await row.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: /丟回月度/ }).click();

  // it left the active list and now shows as a 退回月度 trail on this day
  await expect(page.getByText("· 退回月度")).toBeVisible();
});

test("dismissed trail row checkbox is enabled and can be checked complete", async ({ page }) => {
  await gotoTodaySeeded(page);

  // Add a task, demote it to month → it becomes a "· 退回月度" dismissed trail.
  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("退回完成 e2e");
  await input.press("Enter");

  const row = rowOf(page, "退回完成 e2e");
  await row.hover();
  await row.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: /丟回月度/ }).click();

  // The trail banner appears; find the trail row by its trail label.
  await expect(page.getByText("· 退回月度")).toBeVisible();

  // The checkbox for this task should be enabled (trail rows are checkable).
  const checkbox = page.getByRole("checkbox", { name: "退回完成 e2e" });
  await expect(checkbox).toBeEnabled();

  // Click it → task becomes done.
  await checkbox.click();
  await expect(checkbox).toBeChecked();
});

test("demote-to-month works from the top-3 card too", async ({ page }) => {
  await gotoTodaySeeded(page);

  // add a task and promote it into the top-3 card
  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("三件事退回 e2e");
  await input.press("Enter");

  const taskRow = rowOf(page, "三件事退回 e2e");
  await taskRow.hover();
  await taskRow.getByRole("button", { name: /今日重點/ }).click();
  await page.getByRole("menuitemradio", { name: /今日第一/ }).click();

  // demote it from the top-3 card's overflow menu
  const top3Item = page
    .locator("li", { hasText: "三件事退回 e2e" })
    .filter({ has: page.getByLabel("更多動作") });
  await top3Item.hover();
  await top3Item.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: /丟回月度/ }).click();

  await expect(page.getByText("· 退回月度")).toBeVisible();
});
