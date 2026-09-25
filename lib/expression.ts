/**
 * Facial-expression biomarkers from MediaPipe's face landmarker.
 *
 * The model returns 52 ARKit-style blendshape activations; we fold those into
 * a coarse emotion label plus two behavioural proxies (eye closure, head
 * motion). Everything runs on-device — no frame ever leaves the browser.
 *
 * The WASM runtime and model weights are fetched from a CDN on first use. If
 * that fetch fails the app stays functional: `available` goes false and the
 * rest of the pipeline continues without expression data.
 */

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { Emotion } from "./types";

const WASM_BASE =
  process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_URL ??
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

const MODEL_URL =
  process.env.NEXT_PUBLIC_FACE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type ExpressionReading = {
  available: boolean;
  faceDetected: boolean;
  emotion: Emotion;
  emotionConfidence: number;
  eyeClosure: number;
  headMotion: number;
  /** Normalised face box in video coordinates, for the rPPG region of interest. */
  faceBox: { x: number; y: number; w: number; h: number } | null;
};

const EMPTY: ExpressionReading = {
  available: false,
  faceDetected: false,
  emotion: "neutral",
  emotionConfidence: 0,
  eyeClosure: 0,
  headMotion: 0,
  faceBox: null,
};

type Shapes = Record<string, number>;

const pick = (s: Shapes, ...names: string[]): number =>
  names.reduce((max, n) => Math.max(max, s[n] ?? 0), 0);

const pair = (s: Shapes, base: string): number =>
  ((s[`${base}Left`] ?? 0) + (s[`${base}Right`] ?? 0)) / 2;

/**
 * Blendshape combinations approximating the six basic expressions. These are
 * heuristics tuned for a talking head at desk distance, not a trained
 * classifier, and they should never be presented to a clinician as a
 * diagnosis on their own.
 */
function classify(s: Shapes): { emotion: Emotion; confidence: number } {
  const smile = pair(s, "mouthSmile");
  const frown = pair(s, "mouthFrown");
  const browDown = pair(s, "browDown");
  const browInnerUp = s.browInnerUp ?? 0;
  const browOuterUp = pair(s, "browOuterUp");
  const eyeWide = pair(s, "eyeWide");
  const eyeSquint = pair(s, "eyeSquint");
  const jawOpen = s.jawOpen ?? 0;
  const noseSneer = pair(s, "noseSneer");
  const mouthPress = pair(s, "mouthPress");
  const mouthStretch = pair(s, "mouthStretch");
  const cheekSquint = pair(s, "cheekSquint");

  const scores: Record<Emotion, number> = {
    // A genuine (Duchenne) smile engages the cheeks, so cheekSquint separates
    // real positive affect from a polite mouth-only smile.
    happy: smile * 0.75 + cheekSquint * 0.35,
    sad: frown * 0.55 + browInnerUp * 0.5 + mouthPress * 0.15,
    angry: browDown * 0.6 + eyeSquint * 0.25 + mouthPress * 0.3 + noseSneer * 0.15,
    fearful: eyeWide * 0.45 + browInnerUp * 0.3 + browOuterUp * 0.2 + mouthStretch * 0.3,
    surprised: eyeWide * 0.4 + browOuterUp * 0.4 + jawOpen * 0.4,
    disgusted: noseSneer * 0.7 + pair(s, "mouthUpperUp") * 0.3,
    neutral: 0.16,
  };

  let best: Emotion = "neutral";
  for (const key of Object.keys(scores) as Emotion[]) {
    if (scores[key] > scores[best]) best = key;
  }
  return { emotion: best, confidence: Math.min(1, Number(scores[best].toFixed(2))) };
}

export class ExpressionAnalyser {
  private landmarker: FaceLandmarker | null = null;
  private loading: Promise<void> | null = null;
  private failed = false;
  private lastCentre: { x: number; y: number } | null = null;
  private motion = 0;
  private lastTimestamp = -1;

  get ready(): boolean {
    return this.landmarker !== null;
  }

  get unavailable(): boolean {
    return this.failed;
  }

  async load(): Promise<void> {
    if (this.landmarker || this.failed) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });
      } catch {
        this.failed = true;
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastCentre = null;
    this.motion = 0;
    this.lastTimestamp = -1;
  }

  detect(video: HTMLVideoElement, now: number): ExpressionReading {
    if (!this.landmarker || !video.videoWidth) return EMPTY;

    // MediaPipe rejects non-monotonic timestamps, which happens whenever the
    // tab is throttled and two frames land in the same millisecond.
    const timestamp = now <= this.lastTimestamp ? this.lastTimestamp + 1 : now;
    this.lastTimestamp = timestamp;

    let result;
    try {
      result = this.landmarker.detectForVideo(video, timestamp);
    } catch {
      return { ...EMPTY, available: true };
    }

    const landmarks = result.faceLandmarks?.[0];
    if (!landmarks?.length) {
      return { ...EMPTY, available: true };
    }

    const categories = result.faceBlendshapes?.[0]?.categories ?? [];
    const shapes: Shapes = {};
    for (const c of categories) shapes[c.categoryName] = c.score;

    const { emotion, confidence } = classify(shapes);
    const eyeClosure = Math.min(1, pick(shapes, "eyeBlinkLeft", "eyeBlinkRight"));

    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (const p of landmarks) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    if (this.lastCentre) {
      const delta = Math.hypot(centre.x - this.lastCentre.x, centre.y - this.lastCentre.y);
      // Exponential smoothing so a single twitch does not spike restlessness.
      this.motion = this.motion * 0.85 + Math.min(1, delta * 20) * 0.15;
    }
    this.lastCentre = centre;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    return {
      available: true,
      faceDetected: true,
      emotion,
      emotionConfidence: confidence,
      eyeClosure: Number(eyeClosure.toFixed(2)),
      headMotion: Number(this.motion.toFixed(3)),
      faceBox: {
        x: minX * vw,
        y: minY * vh,
        w: (maxX - minX) * vw,
        h: (maxY - minY) * vh,
      },
    };
  }
}

/**
 * Forehead strip of a detected face — the region with the strongest pulsatile
 * colour signal and the least occlusion from facial movement while speaking.
 */
export function foreheadRoi(
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  return {
    x: box.x + box.w * 0.25,
    y: box.y + box.h * 0.1,
    w: box.w * 0.5,
    h: box.h * 0.22,
  };
}
