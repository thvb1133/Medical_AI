import { NextResponse } from "next/server";
import { assessCombined, assessText, atLeast, CRISIS_RESOURCES } from "@/lib/crisis";
import { complete, type ChatMessage } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
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
  const risk = combined.level;

  await appendTurn(sessionId, { role: "patient", text: message, at: Date.now(), risk });

  let alertRaised = false;
  if (combined.escalate || textRisk.escalate) {
    await raiseAlert(sessionId, {
      level: risk,
      reason: textRisk.level === "crisis" ? textRisk.reason : combined.reason,
      context: telemetry,
    });
    alertRaised = true;
  } else if (atLeast(risk, "moderate")) {
    await updateRisk(sessionId, risk);
  }

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

  // getSession already includes the turn we just wrote; when falling back to
  // client history it does not, so append it to avoid asking the model to
  // reply to nothing.
  if (!session?.transcript?.length || messages.at(-1)?.content !== message) {
    messages.push({ role: "user", content: message });
  }

  const system = buildSystemPrompt(session?.patientName ?? "", telemetry, risk);
  const result = await complete(system, messages, risk);

  const assistantTurn = await appendTurn(sessionId, {
    role: "assistant",
    text: result.text,
    at: Date.now(),
  });

  return NextResponse.json({
    reply: result.text,
    turnId: assistantTurn.id,
    risk,
    riskReason: combined.reason,
    escalated: alertRaised,
    resources: atLeast(risk, "high") ? CRISIS_RESOURCES : [],
    provider: result.provider,
    degraded: result.degraded,
  });
}
