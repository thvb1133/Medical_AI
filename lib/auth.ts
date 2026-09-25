import { NextResponse } from "next/server";
import { env } from "./config";

export const CLINICIAN_COOKIE = "neura_clinician";

/**
 * Gate for clinician-only endpoints.
 *
 * A single shared passphrase is the right weight for a demo deployment and
 * explicitly not enough for real patient data — a production deployment needs
 * per-clinician identity and an audit trail. When no code is configured the
 * gate is open, which the dashboard warns about on screen.
 */
export function requireClinician(request: Request): NextResponse | null {
  const expected = env.clinicianCode();
  if (!expected) return null;

  const header = request.headers.get("x-clinician-code");
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CLINICIAN_COOKIE}=`))
    ?.slice(CLINICIAN_COOKIE.length + 1);

  const supplied = header ?? (cookie ? decodeURIComponent(cookie) : null);
  if (supplied === expected) return null;

  return NextResponse.json({ error: "Clinician authorisation required" }, { status: 401 });
}
