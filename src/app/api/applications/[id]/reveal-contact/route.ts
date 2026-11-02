import { withAuth } from "@/server/policy/with-auth";
import { revealContact } from "@/server/services/applicant-actions";

// Gated by state (shortlisted/hired) in the service; every call is audit-logged.
export const POST = withAuth(
  { perm: "contact.reveal", resource: "application" },
  async (_req, { user, application }) =>
    Response.json(await revealContact(user, application), {
      headers: { "Cache-Control": "no-store" },
    }),
);
