import type { Page } from "@playwright/test";

const WSPC_FAKE_URL = process.env.WSPC_FAKE_URL ?? "http://127.0.0.1:8788";

/**
 * Reset the fake WSPC to its seeded demo data and establish an authenticated
 * session, then open `/today` and wait for it to render.
 *
 * `page.request` shares the browser context's cookie jar, so the session cookie
 * set by `/api/test-login` is sent on the subsequent navigation.
 */
export async function gotoTodaySeeded(page: Page): Promise<void> {
  await page.request.post(`${WSPC_FAKE_URL}/__reset`);
  await page.request.post("/api/test-login");
  await page.goto("/today");
  await page.waitForSelector("text=今天最重要的三件事");
}
