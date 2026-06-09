import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    ...(process.env.VITEST ? [] : [cloudflare()]),
  ],
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
