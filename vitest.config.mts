import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // `server-only` exists to fail a build when server code is pulled into a
      // client bundle. Under vitest everything IS server code, and its browser
      // entry — which is what vite resolves by default — throws on import.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    // e2e/ belongs to Playwright; vitest owns unit + integration + security suites.
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
    // Tenancy tests share one database; running files in parallel makes their
    // row counts depend on each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
