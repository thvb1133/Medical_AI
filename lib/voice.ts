/**
 * Voice biomarkers computed in the browser from raw Web Audio frames.
 *
 * These are acoustic proxies, not clinical measures: pitch variability,
 * loudness and pause structure correlate with affect in the literature but a
 * single reading says very little. Always pair with the confidence value.
 */

export type VoiceReading = {
  pitchHz: number | null;
  jitter: number;
  shimmer: number;
  energy: number;
  pauseRatio: number;
  monotony: number;
  speaking: boolean;
};

const MIN_F0 = 70; // Hz, low male speech
const MAX_F0 = 400; // Hz, high female/child speech
const SILENCE_RMS = 0.012;

function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/**
 * Normalised autocorrelation pitch detection. Cheap and robust enough for
 * speech at 16-48kHz; returns null when the frame is unvoiced or too noisy.
 */
function detectPitch(frame: Float32Array, sampleRate: number): number | null {
  const level = rms(frame);
  if (level < SILENCE_RMS) return null;

  const minLag = Math.floor(sampleRate / MAX_F0);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_F0), frame.length - 1);
  if (maxLag <= minLag) return null;

  const correlations = new Float32Array(maxLag + 1);
  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i < frame.length - lag; i++) {
      corr += frame[i] * frame[i + lag];
      energyA += frame[i] * frame[i];
      energyB += frame[i + lag] * frame[i + lag];
    }
    const norm = corr / (Math.sqrt(energyA * energyB) + 1e-9);
    correlations[lag] = norm;
    if (norm > bestCorr) {
      bestCorr = norm;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorr < 0.45) return null;

  // Octave correction. A periodic signal correlates just as well at twice its
  // period, and taking the global maximum picks that longer lag often enough
  // to systematically halve the reported pitch of higher voices. Preferring
  // the earliest peak that is nearly as strong resolves it.
  const OCTAVE_TOLERANCE = 0.85;
  for (let lag = minLag + 1; lag < bestLag; lag++) {
    const isPeak =
      correlations[lag] >= correlations[lag - 1] && correlations[lag] >= correlations[lag + 1];
    if (isPeak && correlations[lag] >= bestCorr * OCTAVE_TOLERANCE) {
      bestLag = lag;
      break;
    }
  }

  const hz = sampleRate / bestLag;
  return hz >= MIN_F0 && hz <= MAX_F0 ? hz : null;
}

function mean(x: number[]): number {
  return x.reduce((a, b) => a + b, 0) / (x.length || 1);
}

function stdev(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length);
}

export class VoiceAnalyser {
  private pitches: Array<number | null> = [];
  private levels: number[] = [];
  private readonly capacity: number;

  /** `capacity` frames at ~20/s, so 200 is roughly a 10 second window. */
  constructor(capacity = 200) {
    this.capacity = capacity;
  }

  reset(): void {
    this.pitches = [];
    this.levels = [];
  }

  push(frame: Float32Array, sampleRate: number): void {
    this.pitches.push(detectPitch(frame, sampleRate));
    this.levels.push(rms(frame));
    if (this.pitches.length > this.capacity) {
      this.pitches.shift();
      this.levels.shift();
    }
  }

  read(): VoiceReading {
    const silent: VoiceReading = {
      pitchHz: null,
      jitter: 0,
      shimmer: 0,
      energy: 0,
      pauseRatio: 1,
      monotony: 0,
      speaking: false,
    };
    if (this.levels.length < 8) return silent;

    const voiced = this.pitches.filter((p): p is number => p !== null);
    const pauseRatio = 1 - voiced.length / this.pitches.length;
    const energy = Math.min(1, mean(this.levels.slice(-10)) * 12);
    const speaking = this.levels.slice(-5).some((l) => l >= SILENCE_RMS);

    if (voiced.length < 5) return { ...silent, energy, pauseRatio, speaking };

    const medianF0 = [...voiced].sort((a, b) => a - b)[Math.floor(voiced.length / 2)];

    // Jitter: mean absolute difference between consecutive periods, relative
    // to the mean period. Shimmer is the same idea applied to amplitude.
    let periodDiff = 0;
    for (let i = 1; i < voiced.length; i++) {
      periodDiff += Math.abs(1 / voiced[i] - 1 / voiced[i - 1]);
    }
    const jitter = Math.min(1, periodDiff / (voiced.length - 1) / (1 / medianF0));

    const loud = this.levels.filter((l) => l >= SILENCE_RMS);
    let ampDiff = 0;
    for (let i = 1; i < loud.length; i++) ampDiff += Math.abs(loud[i] - loud[i - 1]);
    const shimmer = Math.min(1, ampDiff / Math.max(1, loud.length - 1) / (mean(loud) + 1e-9));

    // Monotony: low pitch spread relative to the speaker's own median. Flat
    // intonation is a commonly cited correlate of depressed affect.
    const spread = stdev(voiced) / (medianF0 + 1e-9);
    const monotony = Math.max(0, Math.min(1, 1 - spread / 0.18));

    return {
      pitchHz: Math.round(medianF0),
      jitter: Number(jitter.toFixed(3)),
      shimmer: Number(shimmer.toFixed(3)),
      energy: Number(energy.toFixed(3)),
      pauseRatio: Number(pauseRatio.toFixed(3)),
      monotony: Number(monotony.toFixed(3)),
      speaking,
    };
  }
}
