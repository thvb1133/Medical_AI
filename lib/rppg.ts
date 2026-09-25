/**
 * Remote photoplethysmography (rPPG): estimates a pulse signal from subtle
 * colour changes in skin pixels captured by an ordinary webcam.
 *
 * This is a research-grade approximation, not a medical measurement. Readings
 * degrade badly with motion, poor lighting, and — importantly — the green
 * channel carries less pulsatile signal on darker skin tones, so quality
 * scores must always be surfaced alongside any value.
 */

export type RppgReading = {
  bpm: number | null;
  hrvMs: number | null;
  /** 0..1 confidence derived from spectral signal-to-noise ratio. */
  quality: number;
  /** Normalised waveform samples for display. */
  waveform: number[];
};

const MIN_HZ = 0.7; // 42 bpm
const MAX_HZ = 3.0; // 180 bpm

/** Iterative in-place radix-2 Cooley-Tukey FFT. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Removes slow drift (lighting changes, posture) via a moving-average subtraction. */
function detrend(x: number[], window: number): number[] {
  const out = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(x.length - 1, i + window);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += x[j];
    out[i] = x[i] - sum / (hi - lo + 1);
  }
  return out;
}

function standardise(x: number[]): number[] {
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const varr = x.reduce((a, b) => a + (b - mean) ** 2, 0) / x.length;
  const sd = Math.sqrt(varr) || 1e-9;
  return x.map((v) => (v - mean) / sd);
}

export class RppgEstimator {
  private samples: { t: number; g: number; motion: number }[] = [];
  private lastFrame: Float64Array | null = null;
  private readonly windowMs: number;

  constructor(windowMs = 10_000) {
    this.windowMs = windowMs;
  }

  reset(): void {
    this.samples = [];
    this.lastFrame = null;
  }

  /**
   * Feeds one frame. `roi` should already be cropped to skin (typically the
   * forehead/cheeks) and downscaled — 32x32 is plenty and keeps this cheap.
   */
  push(roi: ImageData, now: number): void {
    const { data, width, height } = roi;
    const px = width * height;
    let g = 0;
    const flat = new Float64Array(px);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Chrominance-style combination suppresses illumination noise better
      // than raw green alone while staying cheap enough for every frame.
      const v = 2 * data[i + 1] - data[i] - data[i + 2];
      flat[p] = v;
      g += v;
    }
    g /= px;

    let motion = 0;
    if (this.lastFrame && this.lastFrame.length === px) {
      for (let p = 0; p < px; p++) motion += Math.abs(flat[p] - this.lastFrame[p]);
      motion /= px;
    }
    this.lastFrame = flat;

    this.samples.push({ t: now, g, motion });
    const cutoff = now - this.windowMs;
    while (this.samples.length && this.samples[0].t < cutoff) this.samples.shift();
  }

  read(): RppgReading {
    const n = this.samples.length;
    const empty: RppgReading = { bpm: null, hrvMs: null, quality: 0, waveform: [] };
    if (n < 64) return empty;

    const durationS = (this.samples[n - 1].t - this.samples[0].t) / 1000;
    if (durationS < 4) return empty;
    const fps = (n - 1) / durationS;

    const signal = standardise(detrend(this.samples.map((s) => s.g), Math.round(fps)));

    // Motion penalty: large frame-to-frame differences mean the ROI moved and
    // the colour trace is dominated by artefact rather than blood volume.
    const meanMotion =
      this.samples.reduce((a, s) => a + s.motion, 0) / n;
    const motionPenalty = Math.max(0, 1 - meanMotion / 12);

    const size = 1 << Math.floor(Math.log2(n));
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    const offset = n - size;
    for (let i = 0; i < size; i++) {
      // Hann window reduces spectral leakage from the finite record length.
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
      re[i] = signal[offset + i] * w;
    }
    fft(re, im);

    let peakIdx = -1;
    let peakPower = 0;
    let bandPower = 0;
    const binHz = fps / size;
    for (let k = 1; k < size / 2; k++) {
      const hz = k * binHz;
      if (hz < MIN_HZ || hz > MAX_HZ) continue;
      const power = re[k] * re[k] + im[k] * im[k];
      bandPower += power;
      if (power > peakPower) {
        peakPower = power;
        peakIdx = k;
      }
    }
    if (peakIdx < 0 || bandPower <= 0) return { ...empty, waveform: signal.slice(-150) };

    const snr = peakPower / (bandPower - peakPower + 1e-9);
    const quality = Math.max(
      0,
      Math.min(1, (snr / (snr + 0.35)) * motionPenalty * Math.min(1, durationS / 8)),
    );
    const bpm = peakIdx * binHz * 60;

    return {
      bpm: Math.round(bpm),
      hrvMs: this.estimateHrv(signal, fps),
      quality: Number(quality.toFixed(2)),
      waveform: signal.slice(-150),
    };
  }

  /**
   * SDNN over beat-to-beat intervals found by peak picking. Camera-derived HRV
   * is far coarser than an ECG or a chest strap; treat it as a trend only.
   */
  private estimateHrv(signal: number[], fps: number): number | null {
    const minGap = Math.max(2, Math.round(fps * 0.4));
    const peaks: number[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] >= signal[i + 1] && signal[i] > 0.4) {
        if (!peaks.length || i - peaks[peaks.length - 1] >= minGap) peaks.push(i);
      }
    }
    if (peaks.length < 4) return null;

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(((peaks[i] - peaks[i - 1]) / fps) * 1000);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sdnn = Math.sqrt(
      intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length,
    );
    return Math.round(sdnn);
  }
}

/**
 * Picks the skin region to analyse. Uses the browser's native FaceDetector when
 * present, otherwise falls back to a fixed central box that assumes the user is
 * roughly framed in the middle of the shot.
 */
export async function pickFaceRoi(
  video: HTMLVideoElement,
  detector: { detect: (v: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> } | null,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const fallback = { x: vw * 0.35, y: vh * 0.15, w: vw * 0.3, h: vh * 0.25 };
  if (!detector) return fallback;
  try {
    const faces = await detector.detect(video);
    if (!faces.length) return fallback;
    const b = faces[0].boundingBox;
    // Forehead band: upper third of the detected face, inset horizontally to
    // avoid hair and the face outline.
    return {
      x: b.x + b.width * 0.25,
      y: b.y + b.height * 0.08,
      w: b.width * 0.5,
      h: b.height * 0.28,
    };
  } catch {
    return fallback;
  }
}
