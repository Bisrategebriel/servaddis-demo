#!/usr/bin/env node
// `pnpm demo`: one command from a fresh checkout to a running, freshly seeded demo (TRD §11, D-9).
//   pnpm demo               laptop + phones on the same network (LAN)
//   pnpm demo --tunnel      also opens a temporary public link (Cloudflare quick tunnel)
//   pnpm demo --skip-build  reuse the last build (faster restarts)
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const args = new Set(process.argv.slice(2));
const PORT = process.env.PORT ?? "3000";

function step(label, command) {
  console.log(`\n▸ ${label}`);
  const { status } = spawnSync(command, { stdio: "inherit", shell: true });
  if (status !== 0) {
    console.error(`\n✖ "${label}" failed.`);
    process.exit(status ?? 1);
  }
}

/** First run: create .env from the example with real random secrets. */
function ensureEnv() {
  if (existsSync(".env")) return;
  let env = readFileSync(".env.example", "utf8");
  for (const key of ["SESSION_SECRET", "OTP_HMAC_SECRET", "WEBHOOK_SECRET"]) {
    env = env.replace(new RegExp(`^${key}=""`, "m"), `${key}="${randomBytes(32).toString("hex")}"`);
  }
  writeFileSync(".env", env);
  console.log("▸ Created .env with fresh secrets");
}

/** LAN addresses, real networks first (virtual adapters such as WSL use 172.x). */
function lanAddresses() {
  const all = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  const rank = (ip) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2);
  return all.sort((a, b) => rank(a) - rank(b));
}

/** Starts cloudflared and resolves with the public URL it prints. */
function startTunnel() {
  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const scan = (chunk) => {
      const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk));
      if (match) resolve({ child, url: match[0] });
    };
    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    child.on("error", () =>
      reject(new Error("cloudflared is not installed. Run: winget install Cloudflare.cloudflared")),
    );
    child.on("exit", () => reject(new Error("cloudflared stopped before giving a URL.")));
  });
}

ensureEnv();
step("Applying database migrations", "pnpm exec prisma migrate deploy");
step("Loading demo data", "pnpm seed");
if (!args.has("--skip-build")) step("Building the app", "pnpm build");

const lan = lanAddresses();
const env = { ...process.env, PORT };
let tunnel;
if (args.has("--tunnel")) {
  console.log("\n▸ Opening the Cloudflare tunnel");
  try {
    tunnel = await startTunnel();
  } catch (err) {
    console.error(`\n✖ ${err.message}`);
    process.exit(1);
  }
  env.PUBLIC_BASE_URL = tunnel.url;
  // A public link must not hand the toolkit to everyone who has it.
  env.DEMO_TOOLKIT_PASSCODE ||= String(randomInt(100_000, 1_000_000));
} else if (lan[0]) {
  env.PUBLIC_BASE_URL = `http://${lan[0]}:${PORT}`; // QR codes on job cards must work on the phone
}

const server = spawn(`pnpm exec next start -H 0.0.0.0 -p ${PORT}`, {
  stdio: "inherit",
  shell: true,
  env,
});

const lines = [`This laptop:  http://localhost:${PORT}`];
for (const ip of lan) lines.push(`Phone (LAN):  http://${ip}:${PORT}`);
if (tunnel) {
  lines.push(`Public link:  ${tunnel.url}`);
  lines.push(`Toolkit code: ${env.DEMO_TOOLKIT_PASSCODE}  (type it into the demo dock)`);
}
lines.push("Sign-in code: 123456", "Stop:         Ctrl+C");
console.log(`\n── Servaddis demo ──\n${lines.map((l) => `  ${l}`).join("\n")}\n`);

const stop = () => {
  tunnel?.child.kill();
  server.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  tunnel?.child.kill();
  process.exit(code ?? 0);
});
