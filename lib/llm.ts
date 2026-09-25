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
