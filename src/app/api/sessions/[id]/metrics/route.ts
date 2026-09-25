import { z } from "zod";
import { handleError, json, parseBody } from "@/lib/api";
import { loadAuthorisedSession } from "@/lib/session-access";
import { getStore } from "@/lib/store";
import type { MetricSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const scores = z.record(z.string(), z.number());

const snapshotSchema = z.object({
  at: z.string(),
  measurementProgressPct: z.number(),
  realtime: z.object({
    heartRateBpm: z.number().nullable(),
    hrvSdnnMs: z.number().nullable(),
    stressIndex: z.number().nullable(),
    breathingRateBpm: z.number().nullable(),
  }),
  results: z.object({
    estimatedAgeYears: z.number().nullable(),
    heartRateBpm: z.number().nullable(),
    hrvSdnnMs: z.number().nullable(),
    stressIndex: z.number().nullable(),
    breathingRateBpm: z.number().nullable(),
    systolicBpMmhg: z.number().nullable(),
    diastolicBpMmhg: z.number().nullable(),
    cardiacWorkload: z.number().nullable(),
    signalQualityPct: z.number().nullable(),
  }),
  emotions: scores,
  wellness: scores,
  clinical: scores,
  safety: z.object({
    level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    label: z.string(),
    guidance: z.string(),
    reviewer: z.string(),
    urgency: z.string(),
  }),
  live: z.boolean(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await loadAuthorisedSession(id);
    return json({ snapshots: await getStore().listSnapshots(id, 300) });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * The browser owns the measurement loop (the camera and the Shen.AI WASM run
 * there), so snapshots are posted up rather than computed server-side. Storage
 * is throttled by the client to roughly one snapshot every few seconds.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await loadAuthorisedSession(id);
    const snapshot = await parseBody(request, snapshotSchema);
    await getStore().recordSnapshot(id, snapshot as unknown as MetricSnapshot);
    return json({ ok: true }, 201);
  } catch (error) {
    return handleError(error);
  }
}
