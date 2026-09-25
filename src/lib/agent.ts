import "server-only";
import OpenAI from "openai";
import { serverConfig } from "./config";
import { CRISIS_RESOURCES, analysisForLevel, ruleLevel } from "./safety";
import type { Message, SafetyAnalysis } from "./types";

/**
 * The conversational therapist.
 *
 * The persona is deliberately narrow: it listens, reflects, and asks one
 * question at a time. It is not allowed to diagnose or to reassure someone out
 * of a disclosure, because the clinical value of the transcript depends on the
 * patient's own words rather than the model's interpretation of them.
 */

const PERSONA_NAME = "Fergus";

function systemPrompt(safety: SafetyAnalysis, patientName: string): string {
  return [
    `You are ${PERSONA_NAME}, a warm, plain-spoken mental health support companion`,
    `speaking with ${patientName} over video as part of an NHS-style monitoring service.`,
    "",
    "How you speak:",
    "- Two or three sentences at most. This is spoken aloud by an avatar, so keep it natural.",
    "- Ask exactly one question per turn, and make it open rather than yes/no.",
    "- Reflect back what you actually heard before moving on. Never change the subject away from distress.",
    "- Plain language. No clinical jargon, no lists, no markdown, no emoji.",
    "",
    "Boundaries:",
    "- You are not a clinician. Never diagnose, never suggest medication, never promise confidentiality.",
    "- Do not try to talk someone out of what they feel, and do not rush to fix things.",
    "- If the patient asks about their own biomarker readings, you may state them plainly and factually.",
    "",
    "Safety:",
    `- Current assessed risk level is ${safety.level} (${safety.label}).`,
    "- At level 2, ask directly and without euphemism whether they are having thoughts of suicide.",
    "- At level 3, stop assessing. Say clearly that you are concerned for their life, urge them to",
    `  contact ${CRISIS_RESOURCES[0].name} on ${CRISIS_RESOURCES[0].contact} or emergency services now,`,
    "  ask whether they are safe at this moment, and ask if a trusted person can be with them.",
    "- Never leave a level 3 turn without naming a concrete way to get help immediately.",
  ].join("\n");
}

/**
 * Reflective fallback used when no LLM key is configured. It is scripted, but
 * it still escalates correctly, which is the part that must not depend on a
 * third-party API being reachable.
 */
function scriptedReply(messages: Message[], safety: SafetyAnalysis): string {
  const last = [...messages].reverse().find((m) => m.author === "patient");
  const text = last?.text.trim() ?? "";

  if (safety.level >= 3) {
    return `I'm really sorry you're feeling this way, and I'm worried about your safety right now. Please call ${CRISIS_RESOURCES[0].name} on ${CRISIS_RESOURCES[0].contact}, or emergency services, right now. Are you somewhere safe at this moment, and is there someone you trust who can be with you?`;
  }
  if (safety.level === 2) {
    return "Thank you for telling me that — it takes something to say it out loud. I need to ask you directly: are you having thoughts of ending your life?";
  }
  if (safety.level === 1) {
    return "That sounds genuinely heavy, and I'm glad you said it rather than carrying it quietly. What has been feeling hardest lately?";
  }
  if (messages.filter((m) => m.author === "patient").length <= 1) {
    return `Thank you for sharing that with me. How are you feeling physically and emotionally right now?`;
  }
  if (text.endsWith("?")) {
    return "That's a fair question, and I'd rather be honest than guess. Can you tell me a bit more about what prompted it?";
  }
  return "I hear you. Can you say a bit more about what that's been like for you day to day?";
}

export interface AgentReply {
  text: string;
  safety: SafetyAnalysis;
  /** False when the scripted fallback produced the reply. */
  fromModel: boolean;
}

export async function generateReply(
  messages: Message[],
  patientName: string,
  safety: SafetyAnalysis,
): Promise<AgentReply> {
  if (!serverConfig.openaiApiKey) {
    return { text: scriptedReply(messages, safety), safety, fromModel: false };
  }

  try {
    const client = new OpenAI({ apiKey: serverConfig.openaiApiKey });
    const completion = await client.chat.completions.create({
      model: serverConfig.openaiModel,
      temperature: 0.7,
      max_tokens: 160,
      messages: [
        { role: "system", content: systemPrompt(safety, patientName) },
        ...messages.slice(-20).map((m) => ({
          role: m.author === "patient" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { text: scriptedReply(messages, safety), safety, fromModel: false };

    // A model reply can itself reveal risk the rules missed, and the rules can
    // only ever raise the level, never lower what the transcript established.
    const escalated = Math.max(safety.level, ruleLevel(text)) as SafetyAnalysis["level"];
    return { text, safety: analysisForLevel(escalated), fromModel: true };
  } catch (error) {
    console.error("[neura] LLM reply failed, using scripted fallback:", error);
    return { text: scriptedReply(messages, safety), safety, fromModel: false };
  }
}

export async function summariseSession(
  messages: Message[],
  safety: SafetyAnalysis,
): Promise<string | null> {
  const patientTurns = messages.filter((m) => m.author === "patient");
  if (patientTurns.length === 0) return null;

  const fallback = `${patientTurns.length} patient turn${
    patientTurns.length === 1 ? "" : "s"
  }. Peak assessed risk: level ${safety.level} (${safety.label}).`;

  if (!serverConfig.openaiApiKey) return fallback;

  try {
    const client = new OpenAI({ apiKey: serverConfig.openaiApiKey });
    const completion = await client.chat.completions.create({
      model: serverConfig.openaiModel,
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "Summarise this mental health check-in for the reviewing clinician in 3 short sentences. " +
            "Report only what the patient said, quoting their own words where it matters. " +
            "State any risk disclosure explicitly and first. Do not diagnose or speculate.",
        },
        {
          role: "user",
          content: messages.map((m) => `${m.author.toUpperCase()}: ${m.text}`).join("\n"),
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() ?? fallback;
  } catch (error) {
    console.error("[neura] Session summary failed:", error);
    return fallback;
  }
}
