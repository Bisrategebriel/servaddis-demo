// API error envelope (TRD §7):
//   { "error": { "code", "message", "messageAm", "details" } }
// Throw an AppError anywhere in a handler or service; apiHandler turns it into a response.

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RULE_BLOCKED"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RULE_BLOCKED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

// Amharic defaults are DRAFTS pending native review (D-6). FORBIDDEN is doc 04 §3 error.noPermission.
const DEFAULT_MESSAGE: Record<ErrorCode, { en: string; am: string }> = {
  BAD_REQUEST: {
    en: "Some details are missing or invalid.",
    am: "አንዳንድ መረጃዎች ጎድለዋል ወይም ትክክል አይደሉም።",
  },
  UNAUTHORIZED: { en: "Please sign in to continue.", am: "ለመቀጠል እባክዎ ይግቡ።" },
  FORBIDDEN: {
    en: "Your role can't do this. Ask the owner to change your access.",
    am: "የእርስዎ ሚና ይህን ማድረግ አይፈቅድም። ባለቤቱን ፈቃድ እንዲሰጥዎ ይጠይቁ።",
  },
  NOT_FOUND: { en: "We couldn't find that.", am: "የፈለጉትን ማግኘት አልቻልንም።" },
  CONFLICT: {
    en: "This can't be done in its current state.",
    am: "አሁን ባለበት ሁኔታ ይህን ማድረግ አይቻልም።",
  },
  RULE_BLOCKED: {
    en: "This post breaks a Servaddis rule. Fix the highlighted text to continue.",
    am: "ይህ ማስታወቂያ የServaddis ደንብን ይጥሳል። ለመቀጠል የተመለከተውን ጽሑፍ ያስተካክሉ።",
  },
  RATE_LIMITED: {
    en: "Too many attempts. Please wait and try again.",
    am: "በጣም ብዙ ሙከራዎች። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።",
  },
  INTERNAL: {
    en: "Something went wrong. Please try again.",
    am: "የሆነ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።",
  },
};

export type ErrorBody = {
  error: { code: ErrorCode; message: string; messageAm: string; details?: unknown };
};

export class AppError extends Error {
  readonly status: number;
  readonly messageAm: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    readonly code: ErrorCode,
    opts: {
      message?: string;
      messageAm?: string;
      details?: unknown;
      headers?: Record<string, string>;
    } = {},
  ) {
    super(opts.message ?? DEFAULT_MESSAGE[code].en);
    this.name = "AppError";
    this.status = STATUS[code];
    this.messageAm = opts.messageAm ?? DEFAULT_MESSAGE[code].am;
    this.details = opts.details;
    this.headers = opts.headers;
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        messageAm: this.messageAm,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

// Shorthands for the common cases.
export const unauthorized = () => new AppError("UNAUTHORIZED");
/** Foreign or missing resource. Same response either way, so existence never leaks (doc 05 §5.3). */
export const notFound = () => new AppError("NOT_FOUND");
export const forbidden = (permission?: string) =>
  new AppError("FORBIDDEN", permission ? { details: { permission } } : {});
export const conflict = (message?: string, messageAm?: string, details?: unknown) =>
  new AppError("CONFLICT", { message, messageAm, details });

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(err.toBody(), { status: err.status, headers: err.headers });
  }
  console.error(err);
  return Response.json(new AppError("INTERNAL").toBody(), { status: 500 });
}
