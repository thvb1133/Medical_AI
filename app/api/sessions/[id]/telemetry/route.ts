import { NextResponse } from "next/server";
import { appendTelemetry } from "@/lib/store";
import { telemetryBatchSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Biomarker samples arrive in batches rather than one request per second, so a
 * ten-minute session costs a few dozen writes instead of six hundred.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = telemetryBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid telemetry batch" }, { status: 400 });
  }

  await appendTelemetry(id, parsed.data.samples);
  return NextResponse.json({ ok: true, stored: parsed.data.samples.length });
}
