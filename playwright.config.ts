import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Fake upstream WSPC. The dev worker is pointed here via WSPC_BASE
      // (wrangler env `e2e`).
      command: "npx tsx e2e/fixtures/wspc-fake.ts",
      url: "http://localhost:8788/__health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Vite dev server runs the real worker via @cloudflare/vite-plugin.
      // CLOUDFLARE_ENV=e2e selects the wrangler env that enables test-login and
      // points the worker at the fake WSPC.
      command: "npm run dev",
      env: { CLOUDFLARE_ENV: "e2e" },
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
