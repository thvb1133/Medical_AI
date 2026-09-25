import { NextResponse } from "next/server";
import {
  assessCombined,
  assessText,
  atLeast,
  CRISIS_RESOURCES,
  maxRisk,
} from "@/lib/crisis";
import { classifyRisk, complete, type ChatMessage } from "@/lib/llm";
import { buildSystemPrompt, fallbackReply } from "@/lib/prompt";
import { appendTurn, getSession, raiseAlert, updateRisk } from "@/lib/store";
import { chatSchema } from "@/lib/validation";
import type { Telemetry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Turns kept in the model context; older turns fall out of the window. */
const CONTEXT_TURNS = 16;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat payload" }, { status: 400 });
  }

  const { sessionId, message, history } = parsed.data;
  const telemetry = (parsed.data.telemetry ?? null) as Telemetry | null;
  const session = await getSession(sessionId);

  // The safety screen runs before the model is called, so a crisis is caught
  // even if the model is slow, rate-limited, or entirely unconfigured.
  const textRisk = assessText(message);
  const combined = assessCombined(textRisk.level, telemetry);

  const priorTurns = session?.transcript?.length
    ? session.transcript.map((t) => ({ role: t.role, text: t.text }))
    : (history ?? []);

  const messages: ChatMessage[] = [
    ...priorTurns
      .slice(-CONTEXT_TURNS)
      .map((t) => ({
        role: t.role === "patient" ? ("user" as const) : ("assistant" as const),
        content: t.text,
      })),
  ];

  messages.push({ role: "user", content: message });

  const system = buildSystemPrompt(session?.patientName ?? "", telemetry, combined.level);

  // Classification runs alongside generation rather than before it, so the
  // second-stage safety check costs no extra latency in the common case.
  const [classified, result] = await Promise.all([
    classifyRisk(messages),
    complete(system, messages, combined.level),
  ]);

  const risk = classified ? maxRisk(combined.level, classified) : combined.level;
  const modelCaughtMore = classified !== null && risk !== combined.level;

  // The reply was generated against the lower risk level, so if the classifier
  // found something the patterns missed, that reply is not safe to send.
  const reply =
    modelCaughtMore && atLeast(risk, "high") ? fallbackReply(message, risk) : result.text;

  const reason = modelCaughtMore
    ? "Risk identified by the model-based safety check, beyond the pattern screen."
    : textRisk.level === "crisis"
      ? textRisk.reason
      : combined.reason;

  await appendTurn(sessionId, { role: "patient", text: message, at: Date.now(), risk });

  let alertRaised = false;
  if (atLeast(risk, "high")) {
    await raiseAlert(sessionId, { level: risk, reason, context: telemetry });
    alertRaised = true;
  } else if (atLeast(risk, "moderate")) {
    await updateRisk(sessionId, risk);
  }

  const assistantTurn = await appendTurn(sessionId, {
    role: "assistant",
    text: reply,
    at: Date.now(),
  });

  return NextResponse.json({
    reply,
    turnId: assistantTurn.id,
    risk,
    riskReason: reason,
    escalated: alertRaised,
    resources: atLeast(risk, "high") ? CRISIS_RESOURCES : [],
    provider: result.provider,
    degraded: result.degraded,
  });
}
