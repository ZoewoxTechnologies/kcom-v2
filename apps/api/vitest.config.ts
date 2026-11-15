import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test file spins up in-memory Postgres instances, which can be slow on CI runners.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
