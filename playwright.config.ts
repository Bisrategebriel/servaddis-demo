import { defineConfig, devices } from "@playwright/test";

// E2E "demo script" layer (TRD §12). Run with `pnpm e2e` (builds .next-e2e first); the server
// is scripts/e2e-server.mjs on its own database and a random port, so it never collides with
// `pnpm dev`. One worker: the tests share one database and walk one story in order.

// Chosen once in the main process; workers inherit it through the environment.
process.env.E2E_PORT ??= String(3200 + Math.floor(Math.random() * 700));
const baseURL = `http://localhost:${process.env.E2E_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Local runs use the installed Edge (no browser download); CI installs Chromium.
    ...(process.env.CI ? {} : { channel: "msedge" }),
    // `pnpm rehearse --record`: a human pace, so the fallback video can be followed.
    launchOptions: { slowMo: process.env.E2E_RECORD_DIR ? 400 : 0 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `${baseURL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
