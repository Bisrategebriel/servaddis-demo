import { checkoutBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { authorizeOwnVenue } from "@/server/policy/authorize";
import { withAuth } from "@/server/policy/with-auth";
import { createCheckout } from "@/server/services/billing";

// { planCode, jobId? } → Payment(PENDING) and the simulated hosted page to send the owner to.
export const POST = withAuth({ role: "EMPLOYER" }, async (req, { user }) => {
  const { member } = await authorizeOwnVenue(user, "billing.manage");
  const { payment, checkoutUrl } = await createCheckout(
    user,
    member.venueId,
    await parseBody(req, checkoutBody),
  );
  return Response.json({ paymentId: payment.id, checkoutUrl }, { status: 201 });
});
