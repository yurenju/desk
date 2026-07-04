import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

const THREE_THINGS = "今天最重要的三件事";

test("reload renders cached tasks before the network responds (SWR)", async ({ page }) => {
  await gotoTodaySeeded(page);
  await expect(page.getByText(THREE_THINGS)).toBeVisible();

  // Block the todo revalidation so ONLY the localStorage cache can drive render.
  await page.route("**/api/todo", () => {
    /* never fulfill: request hangs */
  });
  await page.reload();

  // The TodayLayout heading only renders past the skeleton, so its visibility
  // while /api/todo is pending proves the cache drove the first paint.
  await expect(page.getByText(THREE_THINGS)).toBeVisible({ timeout: 3000 });
});

test("shows 未同步 badge when revalidation fails but cache is present", async ({ page }) => {
  await gotoTodaySeeded(page);

  await page.route("**/api/todo", (r) => r.abort());
  await page.reload();

  await expect(page.getByText(THREE_THINGS)).toBeVisible();
  await expect(page.getByText("未同步")).toBeVisible();
});
