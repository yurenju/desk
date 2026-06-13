import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

const rowOf = (page: import("@playwright/test").Page, title: string) =>
  page
    .locator(`text=${title}`)
    .locator("xpath=ancestor::div[contains(@class,'row') and not(contains(@class,'titleRow'))]");

test("move-to-today forwards a past-day task into today", async ({ page }) => {
  await gotoTodaySeeded(page);
  const rail = page.getByRole("navigation", { name: "週導覽" });

  // Navigate to the first day-link in the rail that is NOT today (any past day in the week).
  // This avoids hardcoding a date that may fall outside the visible week as real time advances.
  const pastDayLinks = rail.getByRole("link", { name: /^切到 \d{4}-\d{2}-\d{2}$/ });
  const firstPastLink = pastDayLinks.first();
  const pastLabel = await firstPastLink.getAttribute("aria-label");
  const pastDate = pastLabel!.replace("切到 ", "");

  await firstPastLink.click();
  await expect(page).toHaveURL(new RegExp(`/focus/${pastDate}$`));

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
  await rail.getByRole("link", { name: "回今天" }).click();
  await expect(page.getByText("順延 e2e")).toBeVisible();
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
