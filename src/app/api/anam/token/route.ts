import { fail, handleError, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { serverConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANAM_SESSION_TOKEN_URL = "https://api.anam.ai/v1/auth/session-token";

/**
 * Exchanges the Anam API key for a short-lived session token.
 *
 * The browser needs a credential to open the avatar WebRTC stream, but it must
 * never be the API key itself, so the exchange happens here.
 */
export async function POST() {
  try {
    await requireUser();

    const { anamApiKey, anamAvatarId, anamVoiceId, anamLlmId, anamPersonaName } = serverConfig;
    if (!anamApiKey) return fail("Anam is not configured on this deployment", 503);

    // Only send a persona override when an avatar is actually specified;
    // otherwise let the Anam account's default persona apply.
    const body = anamAvatarId
      ? {
          personaConfig: {
            name: anamPersonaName,
            avatarId: anamAvatarId,
            ...(anamVoiceId ? { voiceId: anamVoiceId } : {}),
            ...(anamLlmId ? { llmId: anamLlmId } : {}),
          },
        }
      : {};

    const response = await fetch(ANAM_SESSION_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anamApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[neura] Anam session token request failed:", response.status, detail);
      return fail("Could not start the avatar session", 502);
    }

    const data = (await response.json()) as { sessionToken?: string };
    if (!data.sessionToken) return fail("Anam did not return a session token", 502);

    return json({ sessionToken: data.sessionToken });
  } catch (error) {
    return handleError(error);
  }
}
