import { timingSafeEqual } from "node:crypto";
import { webhookBody } from "@/lib/zod-schemas";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";
import { applyOutcome } from "@/server/services/billing";

// Gateway callback (TRD §5.7). Authenticated by the shared secret in X-Webhook-Secret, not by a
// session or same-origin check (the proxy lets this one path through). Idempotent per payment.
function secretOk(req: Request) {
  const expected = process.env.WEBHOOK_SECRET ?? "";
  const given = req.headers.get("x-webhook-secret") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export const POST = apiHandler(async (req) => {
  if (!secretOk(req)) throw new AppError("UNAUTHORIZED");
  const { providerRef, outcome } = await parseBody(req, webhookBody);
  const { payment, changed } = await applyOutcome(providerRef, outcome);
  return Response.json({ status: payment.status, changed });
});
