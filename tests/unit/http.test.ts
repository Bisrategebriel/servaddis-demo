import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, errorResponse, forbidden, notFound } from "@/server/http/errors";
import { parseBody, parseQuery, parseWith } from "@/server/http/validate";

describe("error envelope", () => {
  it.each([
    ["BAD_REQUEST", 400],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["RULE_BLOCKED", 422],
    ["RATE_LIMITED", 429],
  ] as const)("%s → %i with both languages", async (code, status) => {
    const res = errorResponse(new AppError(code));
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.error.code).toBe(code);
    expect(body.error.message.length).toBeGreaterThan(0);
    expect(body.error.messageAm.length).toBeGreaterThan(0);
  });

  it("carries the missing permission in details", async () => {
    const body = await errorResponse(forbidden("applicant.view")).json();
    expect(body.error.details).toEqual({ permission: "applicant.view" });
  });

  it("omits details when there are none", async () => {
    const body = await errorResponse(notFound()).json();
    expect(body.error).not.toHaveProperty("details");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("database password is hunter2"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    spy.mockRestore();
  });
});

describe("zod helpers", () => {
  const schema = z.object({ name: z.string().min(1), headcount: z.coerce.number().int().min(1) });

  it("returns parsed data", () => {
    expect(parseWith(schema, { name: "Barista", headcount: "2" })).toEqual({
      name: "Barista",
      headcount: 2,
    });
  });

  it("throws 400 with field paths", () => {
    try {
      parseWith(schema, { name: "", headcount: 0 });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const e = err as AppError;
      expect(e.status).toBe(400);
      const paths = (e.details as { issues: { path: string }[] }).issues.map((i) => i.path);
      expect(paths).toEqual(expect.arrayContaining(["name", "headcount"]));
    }
  });

  it("rejects a non-JSON body", async () => {
    const req = new Request("http://x/api", { method: "POST", body: "not json" });
    await expect(parseBody(req, schema)).rejects.toMatchObject({ status: 400 });
  });

  it("parses query strings", () => {
    const req = new Request("http://x/api?name=Waiter&headcount=3");
    expect(parseQuery(req, schema)).toEqual({ name: "Waiter", headcount: 3 });
  });
});
