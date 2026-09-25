import type { Telemetry } from "@/lib/types";

/**
 * Every number here is shown with its confidence. A bare "86 bpm" invites a
 * clinician to trust a camera estimate as if it were a pulse oximeter, and the
 * original project's own demo showed how far off it can drift when lighting is
 * poor — so quality is part of the reading, not a footnote.
 */

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    neutral: "text-calm-100",
    good: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-alert-300",
  }[tone];

  return (
    <div className="rounded-lg border border-calm-800 bg-calm-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-calm-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-calm-500">{sub}</div>}
    </div>
  );
}

function qualityLabel(q: number): string {
  if (q >= 0.6) return "good signal";
  if (q >= 0.3) return "low signal";
  return "very low signal";
}

export function VitalsGrid({ telemetry }: { telemetry: Telemetry | null }) {
  if (!telemetry) {
    return (
      <p className="rounded-lg border border-dashed border-calm-800 p-6 text-sm text-calm-500">
        No biomarker readings yet.
      </p>
    );
  }

  const { video, voice, scores } = telemetry;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Heart rate"
        value={video.bpm !== null ? `${video.bpm} bpm` : "—"}
        sub={qualityLabel(video.quality)}
        tone={video.quality < 0.3 ? "warn" : "neutral"}
      />
      <Stat
        label="HRV (SDNN)"
        value={video.hrvMs !== null ? `${video.hrvMs} ms` : "—"}
        sub="camera-derived, trend only"
      />
      <Stat
        label="Wellbeing"
        value={`${scores.wellbeing}/100`}
        sub={`confidence ${Math.round(scores.confidence * 100)}%`}
        tone={scores.wellbeing < 35 ? "bad" : scores.wellbeing < 55 ? "warn" : "good"}
      />
      <Stat
        label="Stress"
        value={`${scores.stress}/100`}
        tone={scores.stress > 70 ? "bad" : scores.stress > 45 ? "warn" : "good"}
      />
      <Stat
        label="Expression"
        value={video.faceDetected ? video.emotion : "no face"}
        sub={
          video.faceDetected
            ? `confidence ${Math.round(video.emotionConfidence * 100)}%`
            : "patient out of frame"
        }
      />
      <Stat
        label="Mood (valence)"
        value={`${scores.valence > 0 ? "+" : ""}${scores.valence}`}
        sub="-100 low, +100 positive"
        tone={scores.valence < -35 ? "bad" : scores.valence < -10 ? "warn" : "neutral"}
      />
      <Stat
        label="Voice"
        value={voice.pitchHz !== null ? `${voice.pitchHz} Hz` : "silent"}
        sub={`${voice.monotony > 0.6 ? "flat intonation" : "varied intonation"}, pauses ${Math.round(
          voice.pauseRatio * 100,
        )}%`}
        tone={voice.monotony > 0.6 ? "warn" : "neutral"}
      />
      <Stat
        label="Restlessness"
        value={`${Math.round(video.headMotion * 100)}%`}
        sub={`eye closure ${Math.round(video.eyeClosure * 100)}%`}
      />
    </div>
  );
}
