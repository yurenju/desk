import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "node:path";
import os from "node:os";

// Persist the dev worker's KV (auth session + bootstrap) to a machine-level
// directory shared by every git worktree, instead of each worktree's own
// `.wrangler/state`. One real-WSPC device-flow login then serves all worktrees
// and survives dev-server restarts (the `__Host-Session` cookie lasts 30 days
// and the KV session TTL refreshes on use), so there's no per-worktree re-login.
// Caveat: run only one worktree's dev server at a time — two sharing this state
// would both try to refresh the same WSPC session and rotate each other out.
//
// e2e (CLOUDFLARE_ENV=e2e) is deliberately excluded: it talks to a fake WSPC and
// seeds sessions via test-login + __reset, so it must stay on the isolated,
// per-worktree `.wrangler/state` rather than the shared real-WSPC state.
const isE2E = process.env.CLOUDFLARE_ENV === "e2e";
const SHARED_DEV_STATE = path.join(os.homedir(), ".desk-dev", "wrangler-state");

// Source-map upload runs only when SENTRY_AUTH_TOKEN is set (i.e. the deploy
// env). Without it — local dev, e2e, CI without the secret — the plugin is
// skipped and no maps are emitted, so builds stay clean and nothing leaks.
const uploadSourceMaps = !process.env.VITEST && !!process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    ...(process.env.VITEST
      ? []
      : [cloudflare(isE2E ? {} : { persistState: { path: SHARED_DEV_STATE } })]),
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            org: "personal-f5k",
            project: "node-cloudflare-workers",
            authToken: process.env.SENTRY_AUTH_TOKEN,
            // Upload to Sentry then delete, so .map files never ship to the
            // browser or the deployed worker bundle.
            sourcemaps: { filesToDeleteAfterUpload: ["**/*.map"] },
          }),
        ]
      : []),
  ],
  // "hidden" emits maps for upload but omits the sourceMappingURL comment, so
  // browsers don't fetch them; the plugin deletes them post-upload anyway.
  build: { sourcemap: uploadSourceMaps ? "hidden" : false },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // `.claude/**` keeps vitest from descending into sibling git worktrees
    // (`.claude/worktrees/*`) when run from the main checkout — each is a full
    // repo copy whose tests would otherwise be collected and run.
    exclude: [...configDefaults.exclude, "e2e/**", ".claude/**"],
  },
});
