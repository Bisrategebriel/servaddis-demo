import "server-only";
import { unstable_rethrow } from "next/navigation";
import { errorResponse } from "./errors";

// Thin route handlers (TRD §2): validate → service → respond. Any thrown error becomes the
// standard envelope. withAuth (T0.5) wraps this to add the session and permission check.

export function apiHandler<Ctx = unknown>(
  fn: (req: Request, ctx: Ctx) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      unstable_rethrow(err); // Next's own control-flow signals are not API errors
      return errorResponse(err);
    }
  };
}
