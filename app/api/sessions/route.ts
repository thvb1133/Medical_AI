import { NextResponse } from "next/server";
import { createSession, listSessions } from "@/lib/store";
import { createSessionSchema } from "@/lib/validation";
import { requireClinician } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid session payload", detail: parsed.error.issues },
      { status: 400 },
    );
  }

  const { patientName, patientRef, consent } = parsed.data;
  if (!consent.video && !consent.audio) {
    return NextResponse.json(
      { error: "At least one of camera or microphone consent is required." },
      { status: 400 },
    );
  }

  const session = await createSession({
    patientName,
    // A short reference keeps the clinician list readable without exposing a
    // full identity in a URL or a shared screen.
    patientRef: patientRef?.trim() || `NR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    consent,
  });

  return NextResponse.json(session, { status: 201 });
}

export async function GET(request: Request) {
  const denied = requireClinician(request);
  if (denied) return denied;

  return NextResponse.json({ sessions: await listSessions() });
}
