import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

test("next/prev week navigates the focus view, back-to-today returns", async ({ page }) => {
  await gotoTodaySeeded(page);
  const rail = page.getByRole("navigation", { name: "週導覽" });

  await rail.getByRole("link", { name: "下一週" }).click();
  await expect(page).toHaveURL(/\/focus\/\d{4}-\d{2}-\d{2}$/);

  await rail.getByRole("link", { name: "回今天" }).click();
  await expect(page.getByText("今天最重要的三件事")).toBeVisible();
});

test("clicking a day in the week rail switches the focused day", async ({ page }) => {
  await gotoTodaySeeded(page);
  const rail = page.getByRole("navigation", { name: "週導覽" });

  const firstDay = rail.getByRole("link", { name: /^切到 \d{4}-\d{2}-\d{2}$/ }).first();
  const label = await firstDay.getAttribute("aria-label");
  const date = label!.replace("切到 ", "");

  await firstDay.click();
  await expect(page).toHaveURL(new RegExp(`/focus/${date}$`));
  await expect(rail.getByRole("link", { name: `切到 ${date}` })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
