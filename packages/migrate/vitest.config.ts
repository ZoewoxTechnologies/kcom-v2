import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The import tests start an in-memory Postgres and run every migration, which is slow on CI.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
