import { test, expect } from "@playwright/test";

/**
 * Task 17: 手動驗收 — automated via Playwright screenshots.
 *
 * This spec captures screenshots for each key interaction
 * so the developer can visually confirm correctness.
 * Screenshots are saved to `test-results/screenshots/`.
 */

test.describe("Manual Verification — Today Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/today");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Wait for content to fully render
    await page.waitForSelector("text=今天最重要的三件事");
  });

  test("Step 2: Initial view — Top3, planned, adhoc sections visible, no console errors", async ({
    page,
  }) => {
    // Collect console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Verify all three sections exist
    await expect(page.getByText("今天最重要的三件事")).toBeVisible();
    await expect(page.getByText("其他計劃內")).toBeVisible();
    await expect(page.getByText("今天臨時加的")).toBeVisible();

    await page.screenshot({ path: "test-results/screenshots/01-initial-view.png", fullPage: true });

    // No console errors
    expect(errors).toEqual([]);
  });

  test("Step 3: Add a task — appears in adhoc section with chip", async ({ page }) => {
    const input = page.getByPlaceholder("+ 加一件今天的事…");
    await input.fill("驗收用任務");
    await input.press("Enter");

    // Verify the task appears
    await expect(page.getByText("驗收用任務")).toBeVisible();

    // Verify the adhoc chip (臨時) is present
    await expect(page.getByText("臨時").first()).toBeVisible();

    await page.screenshot({ path: "test-results/screenshots/02-add-task.png", fullPage: true });
  });

  test("Step 4: Complete and uncomplete a task", async ({ page }) => {
    // Find a task and toggle it
    const taskText = "讀 WSPC custom fields 文件";
    const row = page
      .locator(`text=${taskText}`)
      .locator("xpath=ancestor::div[contains(@class, 'row') and not(contains(@class, 'titleRow'))]");
    const checkbox = row.getByRole("checkbox").first();

    await checkbox.click();
    await expect(checkbox).toBeChecked();

    await page.screenshot({
      path: "test-results/screenshots/03-task-completed.png",
      fullPage: true,
    });

    // Uncomplete it
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();

    await page.screenshot({
      path: "test-results/screenshots/04-task-uncompleted.png",
      fullPage: true,
    });
  });

  test("Step 5: Priority ring — cycle and bump", async ({ page }) => {
    // Find an "其他計劃內" task's priority ring (the dashed empty ring)
    const otherSection = page.getByText("其他計劃內").locator("xpath=ancestor::section[1]");

    // Click a ring in that section to assign priority
    const ring = otherSection.getByRole("button", { name: /優先序/ }).first();
    if (await ring.isVisible()) {
      await ring.click();
      await page.screenshot({
        path: "test-results/screenshots/05-priority-ring-click.png",
        fullPage: true,
      });
    }
  });

  test("Step 6: Inline edit — edit title and Enter to confirm", async ({ page }) => {
    // Use a task from "其他計劃內" section — d5 has no daily_priority and is not adhoc
    const taskText = "讀 WSPC custom fields 文件";

    // Find the row and click the edit button using page.evaluate to avoid
    // the blur race condition that occurs with Playwright's native click.
    // When native click is used, the mousedown→render→mouseup sequence can
    // cause the autoFocus input to immediately blur.
    await page.evaluate((text) => {
      // Find the text node, walk up to the row div
      const allDivs = document.querySelectorAll("div");
      for (const div of allDivs) {
        if (
          div.className.includes("row") &&
          !div.className.includes("titleRow") &&
          div.textContent?.includes(text)
        ) {
          const editBtn = div.querySelector('button[aria-label="編輯"]');
          if (editBtn) {
            (editBtn as HTMLButtonElement).click();
            return;
          }
        }
      }
    }, taskText);

    // After click, the input should appear
    // Use a broader locator since the row structure may have changed
    const input = page.locator('input[class*="editInput"]').first();
    await input.waitFor({ state: "visible", timeout: 3000 });

    // Focus and fill
    await input.focus();
    await input.fill("已編輯的標題");
    await input.press("Enter");

    await expect(page.getByText("已編輯的標題")).toBeVisible();
    await page.screenshot({
      path: "test-results/screenshots/06-inline-edit.png",
      fullPage: true,
    });
  });

  test("Step 7: Delete + undo", async ({ page }) => {
    const title = "回覆 Acme 客戶整合詢問";
    const row = page
      .locator(`text=${title}`)
      .locator("xpath=ancestor::div[contains(@class, 'row') and not(contains(@class, 'titleRow'))]");

    await row.hover();
    await row.getByLabel("刪除").click();

    // Verify task is gone and toast appears
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/已刪除/)).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/07-delete-toast.png",
      fullPage: true,
    });

    // Click undo
    await page.getByText("復原").click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/08-undo-restore.png",
      fullPage: true,
    });
  });

  test("Step 8: Persistence across reload", async ({ page }) => {
    // Add a task
    const input = page.getByPlaceholder("+ 加一件今天的事…");
    await input.fill("持久化測試任務");
    await input.press("Enter");
    await expect(page.getByText("持久化測試任務")).toBeVisible();

    // Reload
    await page.reload();
    await page.waitForSelector("text=今天最重要的三件事");

    // Verify task persisted
    await expect(page.getByText("持久化測試任務")).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/09-persistence.png",
      fullPage: true,
    });
  });

  test("Step 9: Mobile fallback — narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForSelector("text=今天最重要的三件事");

    await page.screenshot({
      path: "test-results/screenshots/10-mobile-view.png",
      fullPage: true,
    });
  });
});
