import { NextResponse } from "next/server";
import { acknowledgeAlert } from "@/lib/store";
import { requireClinician } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Marks an alert as seen by a clinician. */
export async function POST(request: Request, { params }: Params) {
  const denied = requireClinician(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  await acknowledgeAlert(sessionId, id);
  return NextResponse.json({ ok: true });
}
