import { z } from "zod";
import { AppError } from "./errors";

// zod on every body and query (TRD §9). Failures become 400 with per-field issues.

export type FieldIssue = { path: string; message: string };

export function parseWith<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues: FieldIssue[] = result.error.issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
  throw new AppError("BAD_REQUEST", { details: { issues } });
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T) {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new AppError("BAD_REQUEST", {
      message: "Request body must be valid JSON.",
      messageAm: "የጥያቄው አካል ትክክለኛ JSON መሆን አለበት።",
    });
  }
  return parseWith(schema, data);
}

/** Query strings are flat strings: use z.coerce for numbers and booleans. */
export function parseQuery<T extends z.ZodType>(req: Request, schema: T) {
  return parseWith(schema, Object.fromEntries(new URL(req.url).searchParams));
}
