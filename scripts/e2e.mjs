#!/usr/bin/env node
// `pnpm e2e`: build the isolated test bundle, then run Playwright (TRD §12 E2E layer).
//   pnpm e2e                 build + all browser tests
//   pnpm e2e --skip-build    reuse the last .next-e2e build
//   pnpm e2e -- --grep am    extra arguments go to `playwright test`
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).filter((a) => a !== "--");
const skipBuild = args.includes("--skip-build");
const passThrough = args.filter((a) => a !== "--skip-build");

const run = (command, env = {}) => {
  const { status } = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (status !== 0) process.exit(status ?? 1);
};

// Build with DEMO_MODE=1 like `pnpm demo`, so anything a page reads from it at build time matches.
if (!skipBuild) run("pnpm exec next build", { NEXT_DIST_DIR: ".next-e2e", DEMO_MODE: "1" });
run(`pnpm exec playwright test ${passThrough.join(" ")}`);
