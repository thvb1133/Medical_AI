import { NextResponse } from "next/server";
import { env } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guards against a runaway MediaRecorder blob being posted to a paid API. */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/**
 * Transcribes one recorded utterance with Deepgram.
 *
 * The browser does turn detection locally (silence-based) and posts a complete
 * utterance, so this stays a plain request/response route. That costs a little
 * latency versus a streaming socket but works on Vercel's serverless runtime
 * without a persistent connection.
 */
export async function POST(request: Request) {
  const key = env.deepgramKey();
  if (!key) {
    return NextResponse.json(
      { error: "Deepgram is not configured", fallback: "browser" },
      { status: 503 },
    );
  }

  const audio = await request.arrayBuffer();
  if (!audio.byteLength) {
    return NextResponse.json({ error: "Empty audio payload" }, { status: 400 });
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio payload too large" }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") ?? "audio/webm";
  const params = new URLSearchParams({
    model: env.deepgramModel(),
    smart_format: "true",
    punctuate: "true",
    language: "en",
  });

  try {
    const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
      body: audio,
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[neura] Deepgram error", response.status, detail);
      return NextResponse.json(
        { error: "Transcription failed", fallback: "browser" },
        { status: 502 },
      );
    }

    const data = await response.json();
    const alternative = data?.results?.channels?.[0]?.alternatives?.[0];

    return NextResponse.json({
      text: (alternative?.transcript ?? "").trim(),
      confidence: alternative?.confidence ?? 0,
    });
  } catch (error) {
    console.error("[neura] Deepgram request failed", error);
    return NextResponse.json(
      { error: "Transcription unavailable", fallback: "browser" },
      { status: 502 },
    );
  }
}
