/**
 * Model provider abstraction. Anthropic is preferred when both keys are set,
 * OpenAI is the fallback, and a scripted reflective responder covers the case
 * where neither is configured so the app never hard-fails mid-conversation.
 */

import { env } from "./config";
import { fallbackReply } from "./prompt";
import type { RiskLevel } from "./types";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CompletionResult = {
  text: string;
  provider: "anthropic" | "openai" | "fallback";
  degraded: boolean;
};

/** Crisis replies must stay short; normal turns get a little more room. */
function maxTokensFor(risk: RiskLevel): number {
  return risk === "crisis" || risk === "high" ? 120 : 220;
}

async function viaAnthropic(
  system: string,
  messages: ChatMessage[],
  risk: RiskLevel,
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const response = await client.messages.create({
    model: env.anthropicModel(),
    max_tokens: maxTokensFor(risk),
    temperature: 0.7,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return response.content
    .filter((block): block is { type: "text"; text: string; citations: never } =>
      block.type === "text",
    )
    .map((block) => block.text)
    .join("")
    .trim();
}

async function viaOpenAI(
  system: string,
  messages: ChatMessage[],
  risk: RiskLevel,
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: env.openaiKey() });
  const response = await client.chat.completions.create({
    model: env.openaiModel(),
    max_tokens: maxTokensFor(risk),
    temperature: 0.7,
    messages: [{ role: "system", content: system }, ...messages],
  });
  return (response.choices[0]?.message?.content ?? "").trim();
}

const CLASSIFIER_SYSTEM = `You are a suicide-risk triage classifier. Read the patient's most recent message in context and reply with exactly one word, nothing else:

CRISIS - explicit or strongly implied suicidal ideation, intent, a plan, or active self-harm.
HIGH - hopelessness, feeling like a burden, wanting to escape or disappear, or passive ideation.
MODERATE - significant distress: depression, anxiety, panic, grief, severe isolation.
LOW - mild or situational strain.
NONE - no distress indicators.

Judge only what the patient said. When genuinely uncertain between two levels, choose the more severe one.`;

const LEVELS: Record<string, RiskLevel> = {
  CRISIS: "crisis",
  HIGH: "high",
  MODERATE: "moderate",
  LOW: "low",
  NONE: "none",
};

/**
 * Second-stage risk check, run in parallel with generating the reply so it
 * costs no extra latency.
 *
 * The lexical screen catches the explicit cases deterministically and without
 * a network call; this catches the oblique phrasing that patterns cannot —
 * metaphor, indirection, or risk that only makes sense given what was said
 * three turns ago. Neither one can lower the other's verdict: the final risk
 * is always the more severe of the two.
 */
export async function classifyRisk(messages: ChatMessage[]): Promise<RiskLevel | null> {
  const transcript = messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "PATIENT" : "ASSISTANT"}: ${m.content}`)
    .join("\n");

  try {
    if (env.anthropicKey()) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: env.anthropicKey() });
      const response = await client.messages.create({
        model: env.anthropicModel(),
        max_tokens: 8,
        temperature: 0,
        system: CLASSIFIER_SYSTEM,
        messages: [{ role: "user", content: transcript }],
      });
      const text = response.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim()
        .toUpperCase();
      return LEVELS[text] ?? null;
    }

    if (env.openaiKey()) {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: env.openaiKey() });
      const response = await client.chat.completions.create({
        model: env.openaiModel(),
        max_tokens: 8,
        temperature: 0,
        messages: [
          { role: "system", content: CLASSIFIER_SYSTEM },
          { role: "user", content: transcript },
        ],
      });
      const text = (response.choices[0]?.message?.content ?? "").trim().toUpperCase();
      return LEVELS[text] ?? null;
    }
  } catch (error) {
    // A failed classifier must never block a reply. The lexical screen has
    // already run and its verdict stands on its own.
    console.error("[neura] risk classification failed", error);
  }

  return null;
}

export async function complete(
  system: string,
  messages: ChatMessage[],
  risk: RiskLevel,
): Promise<CompletionResult> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (env.anthropicKey()) {
    try {
      const text = await viaAnthropic(system, messages, risk);
      if (text) return { text, provider: "anthropic", degraded: false };
    } catch (error) {
      console.error("[neura] Anthropic completion failed", error);
    }
  }

  if (env.openaiKey()) {
    try {
      const text = await viaOpenAI(system, messages, risk);
      if (text) return { text, provider: "openai", degraded: false };
    } catch (error) {
      console.error("[neura] OpenAI completion failed", error);
    }
  }

  return { text: fallbackReply(lastUser, risk), provider: "fallback", degraded: true };
}
