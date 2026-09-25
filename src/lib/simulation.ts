import {
  BASELINE_SAFETY,
  CLINICAL_KEYS,
  EMOTION_KEYS,
  WELLNESS_KEYS,
  type ClinicalScores,
  type EmotionScores,
  type MetricSnapshot,
  type SafetyAnalysis,
  type WellnessScores,
} from "./types";

/**
 * Stand-in biomarker source used whenever Shen.AI or Thymia are not licensed.
 *
 * Two properties matter more than realism for its own sake. It is continuous,
 * so values drift the way a real sensor reading does instead of flickering
 * between frames; and it is driven by a `distress` term derived from what the
 * patient actually said, so the rail visibly responds to the conversation
 * rather than looking like decorative noise.
 */

const MEASUREMENT_DURATION_SEC = 60;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/** Smooth, seeded, continuous noise in [-1, 1]. */
function wave(seed: number, t: number, speed: number): number {
  const a = Math.sin(t * speed + seed * 31.7);
  const b = Math.sin(t * speed * 0.41 + seed * 12.9);
  const c = Math.sin(t * speed * 0.17 + seed * 57.3);
  return (a * 0.6 + b * 0.3 + c * 0.1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pct(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export interface SimulationInput {
  seed: string;
  elapsedSec: number;
  /** 0 = settled, 1 = acute distress. Derived from conversation analysis. */
  distress: number;
  safety?: SafetyAnalysis;
}

function emotions(seed: number, t: number, distress: number): EmotionScores {
  // A face is overwhelmingly "neutral" in a calm consultation; distress pulls
  // probability mass into sad/fearful, which is what the rail should show.
  const sad = pct(distress * 62 + wave(seed, t, 0.21) * 4 + 2);
  const fearful = pct(distress * 31 + wave(seed + 1, t, 0.27) * 3);
  const angry = pct(distress * 9 + wave(seed + 2, t, 0.18) * 2);
  const disgusted = pct(distress * 4 + wave(seed + 3, t, 0.23) * 1.5);
  const surprised = pct((1 - distress) * 3 + wave(seed + 4, t, 0.3) * 2);
  const happy = pct((1 - distress) * 9 + wave(seed + 5, t, 0.19) * 3 - 2);
  const other = pct(wave(seed + 6, t, 0.25) * 2);
  const neutral = pct(
    100 - (sad + fearful + angry + disgusted + surprised + happy + other),
  );

  const scores = { angry, disgusted, fearful, happy, neutral, other, sad, surprised };
  return EMOTION_KEYS.reduce((acc, key) => {
    acc[key] = scores[key];
    return acc;
  }, {} as EmotionScores);
}

function wellness(seed: number, t: number, distress: number): WellnessScores {
  const bases: Record<(typeof WELLNESS_KEYS)[number], [number, number]> = {
    distress: [18, 70],
    stress: [33, 55],
    burnout: [15, 58],
    lowSelfEsteem: [20, 62],
    fatigue: [55, 35],
  };
  return WELLNESS_KEYS.reduce((acc, key, i) => {
    const [base, gain] = bases[key];
    acc[key] = pct(base + distress * gain + wave(seed + i * 7, t, 0.09) * 4);
    return acc;
  }, {} as WellnessScores);
}

function clinical(seed: number, t: number, distress: number): ClinicalScores {
  // Baselines sit in the low-teens so an untroubled session reads as quiet;
  // the per-key gain decides how sharply each indicator reacts to distress.
  const bases: Record<(typeof CLINICAL_KEYS)[number], [number, number]> = {
    depression: [2, 78],
    anxiety: [1, 74],
    anhedonia: [16, 60],
    lowMood: [9, 76],
    lowEnergy: [19, 52],
    sleepIssues: [17, 48],
    appetiteIssues: [19, 40],
    worthlessnessIssues: [19, 68],
    concentrationIssues: [16, 46],
    psychomotorIssues: [22, 38],
    nervousness: [17, 62],
    uncontrollableWorry: [14, 66],
    excessiveWorry: [21, 58],
    troubleRelaxing: [14, 60],
    restlessness: [16, 50],
    irritability: [19, 44],
    dread: [13, 70],
  };
  return CLINICAL_KEYS.reduce((acc, key, i) => {
    const [base, gain] = bases[key];
    acc[key] = pct(base + distress * gain + wave(seed + i * 3, t, 0.07) * 3);
    return acc;
  }, {} as ClinicalScores);
}

export function simulateSnapshot(input: SimulationInput): MetricSnapshot {
  const seed = hashSeed(input.seed);
  const t = input.elapsedSec;
  const distress = clamp(input.distress, 0, 1);

  const progress = pct((t / MEASUREMENT_DURATION_SEC) * 100);
  const settled = progress >= 100;

  // Sympathetic arousal: heart rate climbs and HRV collapses under distress.
  const heartRate = Math.round(
    clamp(74 + distress * 26 + wave(seed, t, 0.35) * 5, 48, 150),
  );
  const hrv = Math.round(clamp(38 - distress * 28 + wave(seed + 2, t, 0.3) * 4, 4, 120));
  const stressIndex = Math.round(clamp(5 + distress * 34 + wave(seed + 4, t, 0.25) * 2, 1, 60));
  const breathing = Math.round(clamp(14 + distress * 7 + wave(seed + 6, t, 0.2) * 2, 6, 34));
  const systolic = Math.round(clamp(114 + distress * 22 + wave(seed + 8, t, 0.12) * 4, 90, 180));
  const diastolic = Math.round(clamp(71 + distress * 13 + wave(seed + 10, t, 0.12) * 3, 55, 110));
  const signalQuality = pct(79 + wave(seed + 12, t, 0.15) * 12);
  const age = Math.round(clamp(19 + wave(seed + 14, t, 0.04) * 2, 16, 80));

  const realtime = {
    heartRateBpm: heartRate,
    hrvSdnnMs: hrv,
    stressIndex,
    breathingRateBpm: breathing,
  };

  return {
    at: new Date().toISOString(),
    measurementProgressPct: progress,
    realtime,
    // Summary results only exist once the measurement window has filled.
    results: settled
      ? {
          estimatedAgeYears: age,
          heartRateBpm: heartRate - 1,
          hrvSdnnMs: hrv,
          stressIndex,
          breathingRateBpm: breathing,
          systolicBpMmhg: systolic,
          diastolicBpMmhg: diastolic,
          cardiacWorkload: Math.round((systolic * heartRate) / 51),
          signalQualityPct: signalQuality,
        }
      : {
          estimatedAgeYears: null,
          heartRateBpm: null,
          hrvSdnnMs: null,
          stressIndex: null,
          breathingRateBpm: null,
          systolicBpMmhg: null,
          diastolicBpMmhg: null,
          cardiacWorkload: null,
          signalQualityPct: null,
        },
    emotions: emotions(seed, t, distress),
    wellness: wellness(seed, t, distress),
    clinical: clinical(seed, t, distress),
    safety: input.safety ?? BASELINE_SAFETY,
    live: false,
  };
}
