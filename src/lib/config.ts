import type { RuntimeCapabilities } from "./types";

/**
 * Every integration is optional. A missing key degrades one panel to simulated
 * data rather than breaking the app, which is what makes the deployment usable
 * before the Shen.AI / Thymia licences come through.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const serverConfig = {
  openaiApiKey: read("OPENAI_API_KEY"),
  openaiModel: read("OPENAI_MODEL") ?? "gpt-4o-mini",

  anamApiKey: read("ANAM_API_KEY"),
  anamPersonaName: read("ANAM_PERSONA_NAME") ?? "Fergus",
  anamAvatarId: read("ANAM_AVATAR_ID"),
  anamVoiceId: read("ANAM_VOICE_ID"),
  anamLlmId: read("ANAM_LLM_ID"),

  agoraAppId: read("AGORA_APP_ID") ?? read("NEXT_PUBLIC_AGORA_APP_ID"),
  agoraAppCertificate: read("AGORA_APP_CERTIFICATE"),

  thymiaApiKey: read("THYMIA_API_KEY"),

  databaseUrl: read("DATABASE_URL") ?? read("POSTGRES_URL"),
  authSecret: read("AUTH_SECRET"),

  // Branding shown in the console header.
  appTitle: read("NEXT_PUBLIC_APP_TITLE") ?? "Claude Hackathon at Imperial College",
  appSubtitle: read("NEXT_PUBLIC_APP_SUBTITLE") ?? "By Ben, Nick, Beejal, Anton, Tan",
} as const;

/** The opening line the therapist speaks before the patient has said anything. */
export const GREETING =
  "Hi there, I'm Fergus. I'd love to have a quick chat and learn a bit about how you're doing. What's your name?";

export function getCapabilities(): RuntimeCapabilities {
  return {
    llm: Boolean(serverConfig.openaiApiKey),
    avatar: Boolean(serverConfig.anamApiKey),
    realtimeVoice: Boolean(serverConfig.agoraAppId && serverConfig.agoraAppCertificate),
    // The Shen.AI licence key is used directly by the in-browser WASM SDK, so
    // it is the one credential that is intentionally public.
    cameraVitals: Boolean(
      process.env.NEXT_PUBLIC_SHENAI_API_KEY &&
        process.env.NEXT_PUBLIC_SHENAI_API_KEY.trim().length > 0,
    ),
    voiceBiomarkers: Boolean(serverConfig.thymiaApiKey),
    persistence: Boolean(serverConfig.databaseUrl),
  };
}

/**
 * Dev convenience only: without AUTH_SECRET set, sessions would silently fail
 * to verify, so fall back to a fixed development key and refuse it in prod.
 */
export function authSecret(): Uint8Array {
  const secret = serverConfig.authSecret;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32",
      );
    }
    return new TextEncoder().encode("neura-development-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(secret);
}
