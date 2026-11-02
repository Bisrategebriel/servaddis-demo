import { authorizeOwnVenue } from "@/server/policy/authorize";
import { withAuth } from "@/server/policy/with-auth";
import { paymentDetail } from "@/server/services/billing";

export const GET = withAuth({ role: "EMPLOYER" }, async (_req, { user, params }) => {
  const { member } = await authorizeOwnVenue(user, "billing.manage");
  const p = await paymentDetail(member.venueId, String(params.id));
  return Response.json({
    payment: {
      id: p.id,
      receiptNo: p.receiptNo,
      status: p.status,
      provider: p.provider,
      plan: { code: p.plan.code, nameEn: p.plan.nameEn, nameAm: p.plan.nameAm },
      venue: { nameEn: p.venue.nameEn, nameAm: p.venue.nameAm },
      amountEtb: p.amountEtb,
      vatEtb: p.vatEtb,
      totalEtb: p.amountEtb + p.vatEtb,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    },
  });
});
