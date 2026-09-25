import { NextResponse } from "next/server";
import { env } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a short-lived Anam session token for the video avatar.
 *
 * The long-lived API key stays server-side; the browser only ever receives a
 * token scoped to one session. Without a key the client renders the local
 * canvas avatar instead.
 */
export async function POST() {
  const key = env.anamKey();
  const personaId = env.anamPersona();

  if (!key) {
    return NextResponse.json(
      { error: "Anam is not configured", fallback: "canvas" },
      { status: 503 },
    );
  }

  try {
    const response = await fetch("https://api.anam.ai/v1/auth/session-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        personaId
          ? { personaConfig: { id: personaId } }
          : // Anam drives its own conversation when given a full persona
            // config; Neura only wants the face, because the therapeutic
            // content and the safety rules must come from our own prompt.
            { personaConfig: { name: "Fergus", avatarId: "default" } },
      ),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[neura] Anam token error", response.status, detail);
      return NextResponse.json(
        { error: "Avatar session unavailable", fallback: "canvas" },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({ sessionToken: data.sessionToken });
  } catch (error) {
    console.error("[neura] Anam request failed", error);
    return NextResponse.json(
      { error: "Avatar session unavailable", fallback: "canvas" },
      { status: 502 },
    );
  }
}
