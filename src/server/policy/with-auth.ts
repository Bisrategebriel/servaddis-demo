import "server-only";
import type { Application, Job, PlatformRole, User } from "@prisma/client";
import type { PlatformPermission, VenuePermission } from "@/lib/permissions";
import { AppError } from "../http/errors";
import { apiHandler } from "../http/handler";
import { requireUser } from "../services/auth";
import {
  authorizeApplication,
  authorizeJob,
  authorizePlatform,
  authorizeVenue,
  type VenueAccess,
} from "./authorize";

// One-liner auth for route handlers (TRD §5.2). The resource id comes from the route segment
// named in `param`, e.g.
//   export const POST = withAuth({ perm: "applicant.shortlist", resource: "application" },
//     async (req, { user, application }) => …)

type Params = Record<string, string | string[] | undefined>;
type RouteCtx = { params?: Promise<Params> };

type VenueOpts = {
  perm: VenuePermission;
  resource: "venue" | "job" | "application";
  /** Route segment holding the id. Defaults to "id". */
  param?: string;
};
type PlatformOpts = { platform: PlatformPermission };
type RoleOpts = { role: PlatformRole };
type SessionOnly = Record<string, never>;

export type AuthOptions = VenueOpts | PlatformOpts | RoleOpts | SessionOnly;

export type AuthContext = {
  user: User;
  params: Params;
  access?: VenueAccess;
  job?: Job;
  application?: Application;
};

type WithResource<O> = O extends { resource: "job" }
  ? AuthContext & { access: VenueAccess; job: Job }
  : O extends { resource: "application" }
    ? AuthContext & { access: VenueAccess; job: Job; application: Application }
    : O extends { resource: "venue" }
      ? AuthContext & { access: VenueAccess; venueId: string }
      : AuthContext;

export function withAuth<O extends AuthOptions>(
  opts: O,
  fn: (req: Request, auth: WithResource<O>) => Promise<Response> | Response,
) {
  return apiHandler<RouteCtx>(async (req, ctx) => {
    const user = await requireUser(req);
    const params: Params = (await ctx?.params) ?? {};
    const auth: AuthContext & Record<string, unknown> = { user, params };

    if ("role" in opts) {
      if (user.platformRole !== opts.role) throw new AppError("FORBIDDEN");
    } else if ("platform" in opts) {
      authorizePlatform(user, opts.platform);
    } else if ("perm" in opts) {
      const raw = params[opts.param ?? "id"];
      if (typeof raw !== "string" || raw.length === 0) throw new AppError("NOT_FOUND");
      if (opts.resource === "venue") {
        auth.access = await authorizeVenue(user, raw, opts.perm);
        auth.venueId = raw;
      } else if (opts.resource === "job") {
        const { job, ...access } = await authorizeJob(user, raw, opts.perm);
        Object.assign(auth, { job, access });
      } else {
        const { job, application, ...access } = await authorizeApplication(user, raw, opts.perm);
        Object.assign(auth, { job, application, access });
      }
    }
    return fn(req, auth as WithResource<O>);
  });
}
