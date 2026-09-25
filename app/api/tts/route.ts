import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { ttsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams ElevenLabs speech straight through to the client.
 *
 * A 503 here is expected rather than exceptional: it means no key is set, and
 * the client answers by speaking the same text with the browser's built-in
 * voice.
 */
export async function POST(request: Request) {
  const key = env.elevenLabsKey();
  if (!key) {
    return NextResponse.json(
      { error: "ElevenLabs is not configured", fallback: "browser" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = ttsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid text payload" }, { status: 400 });
  }

  const voice = env.elevenLabsVoice();

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: env.elevenLabsModel(),
          voice_settings: {
            // A calm, steady delivery matters more here than expressiveness;
            // an animated therapist voice reads as performative.
            stability: 0.55,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      console.error("[neura] ElevenLabs error", response.status, detail);
      return NextResponse.json(
        { error: "Speech synthesis failed", fallback: "browser" },
        { status: 502 },
      );
    }

    return new Response(response.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[neura] ElevenLabs request failed", error);
    return NextResponse.json(
      { error: "Speech synthesis unavailable", fallback: "browser" },
      { status: 502 },
    );
  }
}
