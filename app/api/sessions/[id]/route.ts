import { NextResponse } from "next/server";
import { endSession, getSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await endSession(id);
  return NextResponse.json({ ok: true });
}
