import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { CLINICIAN_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exchanges the shared passphrase for a session cookie. */
export async function POST(request: Request) {
  const expected = env.clinicianCode();
  if (!expected) {
    return NextResponse.json({ ok: true, gateDisabled: true });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";

  if (code !== expected) {
    return NextResponse.json({ error: "Incorrect access code" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLINICIAN_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CLINICIAN_COOKIE);
  return response;
}
