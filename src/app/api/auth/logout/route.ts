import { NextResponse } from "next/server";
import { apiHandler } from "@/server/http/handler";
import { clearedSessionCookie } from "@/server/session";

export const POST = apiHandler(async (req) => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearedSessionCookie(req));
  return res;
});
