#!/usr/bin/env node
// The server Playwright runs against (playwright.config.ts → webServer). Isolated from the dev
// app in every way: its own database, upload and card folders, build folder (.next-e2e) and
// port, so a browser run never touches demo data or a running dev server. Freshly migrated and
// seeded on every start; the demo-script tests also Reset through the toolkit before each run.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const port = process.env.E2E_PORT;
if (!port) throw new Error("E2E_PORT is not set (playwright.config.ts sets it)");

const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-e2e",
  DATABASE_URL: "file:../data/e2e.db",
  UPLOAD_DIR: "./data/e2e-uploads",
  CARD_DIR: "./data/e2e-cards",
  PUBLIC_BASE_URL: `http://localhost:${port}`,
  DEMO_MODE: "1",
  DEMO_OTP: "123456",
  DEMO_TOOLKIT_PASSCODE: "", // the toolkit is unlocked in tests
  DISTRIBUTION_SIM_DELAY_MS: "100",
  // Test-only secrets, so CI needs no .env. Next never overrides variables already set.
  SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789abcdef",
  OTP_HMAC_SECRET: "e2e-otp-secret-0123456789abcdef0123456789abcdef",
  WEBHOOK_SECRET: "e2e-webhook-secret-0123456789abcdef",
};

const run = (command) => {
  const { status } = spawnSync(command, { stdio: "inherit", shell: true, env });
  if (status !== 0) process.exit(status ?? 1);
};

rmSync("data/e2e-uploads", { recursive: true, force: true });
rmSync("data/e2e-cards", { recursive: true, force: true });
run("pnpm exec prisma migrate deploy");
run("pnpm -s seed");
const server = spawn(`pnpm exec next start -p ${port}`, { stdio: "inherit", shell: true, env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
