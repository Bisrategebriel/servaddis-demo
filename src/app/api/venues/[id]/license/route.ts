import { AppError } from "@/server/http/errors";
import { withAuth } from "@/server/policy/with-auth";
import { assertUploadSize, uploadLicense } from "@/server/services/licenses";

export const POST = withAuth(
  { perm: "venue.edit", resource: "venue" },
  async (req, { user, venueId }) => {
    assertUploadSize(req);
    const form = await req.formData().catch(() => {
      throw new AppError("BAD_REQUEST");
    });
    const license = await uploadLicense(user, venueId, form.get("file"));
    return Response.json(
      { license: { id: license.id, fileName: license.fileName, status: license.status } },
      { status: 201 },
    );
  },
);
