import "server-only";
import { createHmac } from "node:crypto";
import { forbidden, notFound } from "../http/errors";
import { readCookie } from "../session";

// Who may use the Demo Toolkit (TRD §5.10). Off entirely unless DEMO_MODE=1. When a passcode is
// set (always, behind the public tunnel) it also needs the cookie issued by /api/demo/unlock.

export const TOOLKIT_COOKIE = "sv_toolkit";

export const toolkitToken = (passcode: string) =>
  createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(passcode)
    .digest("hex");

export function requireDemoMode() {
  if (process.env.DEMO_MODE !== "1") throw notFound();
}

export function toolkitLocked(req: Request): boolean {
  const passcode = process.env.DEMO_TOOLKIT_PASSCODE;
  return !!passcode && readCookie(req, TOOLKIT_COOKIE) !== toolkitToken(passcode);
}

export function requireToolkit(req: Request) {
  requireDemoMode();
  if (toolkitLocked(req)) throw forbidden();
}
