/**
 * Fuses the video and voice biomarkers into the four numbers the clinician
 * dashboard shows.
 *
 * This is a transparent weighted model rather than a learned one, deliberately:
 * a clinician can read the code and see exactly why a score moved, and no
 * training data means no hidden population bias baked into weights. Each score
 * carries a confidence that collapses toward zero when the inputs are poor.
 */

import type { Emotion, Telemetry, WellbeingScores } from "./types";
import type { VoiceReading } from "./voice";

type VideoInput = {
  bpm: number | null;
  hrvMs: number | null;
  quality: number;
  emotion: Emotion;
  emotionConfidence: number;
  eyeClosure: number;
  headMotion: number;
  faceDetected: boolean;
};

/** Emotional valence contribution, -1 (very negative) to +1 (very positive). */
const EMOTION_VALENCE: Record<Emotion, number> = {
  happy: 0.8,
  surprised: 0.15,
  neutral: 0,
  fearful: -0.6,
  disgusted: -0.5,
  sad: -0.85,
  angry: -0.7,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Resting adult heart rate sits around 60-80; map deviation above that to stress. */
function cardiacStress(bpm: number | null): number {
  if (bpm === null) return 0;
  return clamp((bpm - 70) / 45, -0.4, 1);
}

/** Low HRV is associated with poor autonomic regulation and higher strain. */
function hrvStress(hrvMs: number | null): number {
  if (hrvMs === null) return 0;
  return clamp((60 - hrvMs) / 60, -0.3, 1);
}

export function scoreWellbeing(video: VideoInput, voice: VoiceReading): WellbeingScores {
  const videoWeight = video.faceDetected ? clamp(video.quality, 0, 1) : 0;
  const voiceWeight = voice.speaking || voice.pauseRatio < 0.95 ? 1 : 0.2;
  const confidence = clamp(videoWeight * 0.55 + voiceWeight * 0.45, 0, 1);

  const stressRaw =
    cardiacStress(video.bpm) * 0.3 * videoWeight +
    hrvStress(video.hrvMs) * 0.2 * videoWeight +
    video.headMotion * 0.15 * videoWeight +
    voice.jitter * 0.2 * voiceWeight +
    voice.shimmer * 0.15 * voiceWeight;
  const stress = Math.round(clamp(stressRaw, 0, 1) * 100);

  const arousalRaw =
    clamp((video.bpm ?? 70) / 110, 0, 1) * 0.35 * videoWeight +
    voice.energy * 0.35 * voiceWeight +
    (1 - voice.pauseRatio) * 0.2 * voiceWeight +
    video.headMotion * 0.1 * videoWeight;
  const arousal = Math.round(clamp(arousalRaw, 0, 1) * 100);

  const expressionValence =
    EMOTION_VALENCE[video.emotion] * clamp(video.emotionConfidence, 0, 1);
  const vocalValence = -(voice.monotony * 0.6 + voice.pauseRatio * 0.4 - 0.35);
  const valenceRaw =
    expressionValence * 0.6 * (videoWeight || 0.2) + vocalValence * 0.4 * voiceWeight;
  const valence = Math.round(clamp(valenceRaw, -1, 1) * 100);

  // Wellbeing starts neutral and is pulled by mood, strain and fatigue. With
  // no usable signal it stays near the neutral midpoint rather than inventing
  // a confident reading.
  const wellbeingRaw =
    0.55 + (valence / 100) * 0.3 - (stress / 100) * 0.25 - video.eyeClosure * 0.08 * videoWeight;
  const neutral = 0.55;
  const wellbeing = Math.round(
    clamp(neutral + (wellbeingRaw - neutral) * confidence, 0, 1) * 100,
  );

  return {
    wellbeing,
    stress,
    arousal,
    valence,
    confidence: Number(confidence.toFixed(2)),
  };
}

/** Plain-language summary of a reading, used in the LLM context and the UI. */
export function describeTelemetry(t: Telemetry | null): string {
  if (!t) return "No biomarker data yet.";
  const parts: string[] = [];

  if (t.video.faceDetected && t.video.bpm !== null) {
    const q =
      t.video.quality >= 0.6 ? "good" : t.video.quality >= 0.3 ? "low" : "very low";
    parts.push(`heart rate ~${t.video.bpm} bpm (${q} signal quality)`);
    if (t.video.hrvMs !== null) parts.push(`HRV ~${t.video.hrvMs} ms`);
  } else {
    parts.push("no reliable camera signal");
  }

  if (t.video.faceDetected) {
    parts.push(`facial expression reads as ${t.video.emotion}`);
  }
  if (t.voice.speaking || t.voice.pitchHz !== null) {
    parts.push(
      `voice energy ${Math.round(t.voice.energy * 100)}%, ` +
        `intonation ${t.voice.monotony > 0.6 ? "flat" : "varied"}, ` +
        `pauses ${Math.round(t.voice.pauseRatio * 100)}%`,
    );
  }

  parts.push(
    `wellbeing ${t.scores.wellbeing}/100, stress ${t.scores.stress}/100, ` +
      `mood ${t.scores.valence > 15 ? "positive" : t.scores.valence < -15 ? "low" : "neutral"}`,
  );

  return parts.join("; ") + `. Overall confidence ${Math.round(t.scores.confidence * 100)}%.`;
}
