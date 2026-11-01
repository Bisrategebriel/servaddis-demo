// Vitest globalSetup: give the run a fresh, fully migrated SQLite file (data/test.db).
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import type { TestProject } from "vitest/node";

export default function setup(project: TestProject) {
  const databaseUrl = project.config.env.DATABASE_URL as string;
  const file = path.resolve(import.meta.dirname, "../../data/test.db");
  for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(file + suffix, { force: true });
  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}
