import { simPaymentBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { authorizeOwnVenue } from "@/server/policy/authorize";
import { withAuth } from "@/server/policy/with-auth";
import { applyOutcome, chooseBankTransfer, paymentDetail } from "@/server/services/billing";

// The simulated hosted page's buttons (SCR-E12). A browser can't hold the webhook secret, so
// this calls the webhook's own processing (applyOutcome) for the owner's pending payment.
export const POST = withAuth({ role: "EMPLOYER" }, async (req, { user, params }) => {
  const { member } = await authorizeOwnVenue(user, "billing.manage");
  const payment = await paymentDetail(member.venueId, String(params.paymentId));
  const { action } = await parseBody(req, simPaymentBody);
  if (action === "bank") {
    const p = await chooseBankTransfer(payment.id);
    return Response.json({ status: p.status, provider: p.provider });
  }
  const outcome = action === "pay" ? "SUCCEEDED" : action === "fail" ? "FAILED" : "CANCELLED";
  const { payment: p } = await applyOutcome(payment.providerRef!, outcome);
  return Response.json({
    status: p.status,
    receiptUrl: p.status === "SUCCEEDED" ? `/employer/payments/${p.id}` : null,
  });
});
