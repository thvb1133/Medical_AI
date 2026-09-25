import type { ProviderStatus } from "./types";

const read = (name: string): string => (process.env[name] ?? "").trim();

export const env = {
  anthropicKey: () => read("ANTHROPIC_API_KEY"),
  openaiKey: () => read("OPENAI_API_KEY"),
  anthropicModel: () => read("ANTHROPIC_MODEL") || "claude-sonnet-4-5",
  openaiModel: () => read("OPENAI_MODEL") || "gpt-4o",
  deepgramKey: () => read("DEEPGRAM_API_KEY"),
  deepgramModel: () => read("DEEPGRAM_MODEL") || "nova-3",
  elevenLabsKey: () => read("ELEVENLABS_API_KEY"),
  elevenLabsVoice: () => read("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM",
  elevenLabsModel: () => read("ELEVENLABS_MODEL") || "eleven_turbo_v2_5",
  anamKey: () => read("ANAM_API_KEY"),
  anamPersona: () => read("ANAM_PERSONA_ID"),
  databaseUrl: () => read("DATABASE_URL"),
  clinicianCode: () => read("CLINICIAN_ACCESS_CODE"),
};

export function providerStatus(): ProviderStatus {
  return {
    llm: env.anthropicKey() ? "anthropic" : env.openaiKey() ? "openai" : "fallback",
    stt: env.deepgramKey() ? "deepgram" : "browser",
    tts: env.elevenLabsKey() ? "elevenlabs" : "browser",
    avatar: env.anamKey() ? "anam" : "canvas",
    storage: env.databaseUrl() ? "postgres" : "memory",
    clinicianGate: Boolean(env.clinicianCode()),
  };
}
