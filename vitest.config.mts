import path from "node:path";
import { defineConfig } from "vitest/config";
// Relative to prisma/, like .env, so the file lands in data/test.db (see tests/setup/test-db.ts).
const TEST_DATABASE_URL = "file:../data/test.db";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside Next's server bundles; it is a no-op under test.
      "server-only": path.resolve(import.meta.dirname, "tests/setup/empty-module.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/setup/test-db.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DEMO_MODE: "1",
      DEMO_OTP: "123456",
      // Test-only secrets; real ones live in .env
      SESSION_SECRET: "test-session-secret-0123456789abcdef0123456789",
      OTP_HMAC_SECRET: "test-otp-secret-0123456789abcdef0123456789abcd",
      PUBLIC_BASE_URL: "http://localhost:3000",
      UPLOAD_DIR: "./data/test-uploads",
      CARD_DIR: "./data/test-cards",
    },
    // Integration tests share one SQLite file, so files run one at a time.
    fileParallelism: false,
  },
});
