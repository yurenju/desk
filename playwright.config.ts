import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Fake upstream WSPC. The dev worker is pointed here via WSPC_BASE
      // (wrangler env `e2e`).
      command: "npx tsx e2e/fixtures/wspc-fake.ts",
      url: "http://127.0.0.1:8788/__health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Vite dev server runs the real worker via @cloudflare/vite-plugin.
      // CLOUDFLARE_ENV=e2e selects the wrangler env that enables test-login and
      // points the worker at the fake WSPC.
      // --host 127.0.0.1 pins the bind address: Vite otherwise listens on ::1
      // (IPv6) on Windows but 127.0.0.1 on Linux CI, and Playwright's Node-side
      // `page.request` resolves the URL differently per platform — forcing IPv4
      // here keeps baseURL/webServer/fixtures consistent everywhere.
      command: "npm run dev -- --host 127.0.0.1",
      env: { CLOUDFLARE_ENV: "e2e" },
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
