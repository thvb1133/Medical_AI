import type { MeasurementResults, RealtimeVitals } from "@/lib/types";

/**
 * Camera-based vitals via the Shen.AI WASM SDK.
 *
 * The SDK is fetched from the CDN at runtime rather than bundled. Its .mjs
 * entry point resolves shenai_sdk.wasm relative to its own URL, so letting the
 * bundler rewrite that path is the usual way this integration breaks; loading
 * it from the CDN keeps the two files together and keeps the WASM out of the
 * Vercel function bundle entirely.
 */

const SDK_VERSION = "3.1.15";
const SDK_URL = `https://cdn.jsdelivr.net/npm/@shenai/sdk@${SDK_VERSION}/index.mjs`;

export interface VitalsReading {
  progressPct: number;
  realtime: RealtimeVitals;
  results: MeasurementResults;
}

export interface VitalsController {
  read(): VitalsReading | null;
  stop(): void;
}

interface ShenaiLike {
  initialize(
    apiKey: string,
    userId: string,
    settings: Record<string, unknown>,
    onResult: (result: unknown) => void,
  ): void;
  isInitialized(): boolean;
  deinitialize(): void;
  attachToCanvas(canvasId: string, exclusive?: boolean): void;
  getMeasurementProgressPercentage(): number;
  getRealtimeHeartRate(): number | null;
  getRealtimeHrvSdnn(): number | null;
  getRealtimeCardiacStress(): number | null;
  getRealtimeMetrics(periodSec: number): RawResults | null;
  getMeasurementResults(): RawResults | null;
  InitializationResult: { OK: unknown };
}

interface RawResults {
  heart_rate_bpm: number;
  hrv_sdnn_ms: number | null;
  stress_index: number | null;
  breathing_rate_bpm: number | null;
  systolic_blood_pressure_mmhg: number | null;
  diastolic_blood_pressure_mmhg: number | null;
  cardiac_workload_mmhg_per_sec: number | null;
  age_years: number | null;
  average_signal_quality: number;
}

function round(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function toResults(raw: RawResults | null): MeasurementResults {
  if (!raw) {
    return {
      estimatedAgeYears: null,
      heartRateBpm: null,
      hrvSdnnMs: null,
      stressIndex: null,
      breathingRateBpm: null,
      systolicBpMmhg: null,
      diastolicBpMmhg: null,
      cardiacWorkload: null,
      signalQualityPct: null,
    };
  }
  return {
    estimatedAgeYears: round(raw.age_years),
    heartRateBpm: round(raw.heart_rate_bpm),
    hrvSdnnMs: round(raw.hrv_sdnn_ms),
    stressIndex: round(raw.stress_index),
    breathingRateBpm: round(raw.breathing_rate_bpm),
    systolicBpMmhg: round(raw.systolic_blood_pressure_mmhg),
    diastolicBpMmhg: round(raw.diastolic_blood_pressure_mmhg),
    cardiacWorkload: round(raw.cardiac_workload_mmhg_per_sec),
    // The SDK reports signal quality as a 0–1 fraction; the panel shows percent.
    signalQualityPct: round(raw.average_signal_quality * 100),
  };
}

export async function startCameraVitals(
  apiKey: string,
  userId: string,
  canvasId: string,
): Promise<VitalsController> {
  const sdkModule = (await import(/* webpackIgnore: true */ SDK_URL)) as {
    default: (config: Record<string, unknown>) => Promise<ShenaiLike>;
  };

  const sdk = await sdkModule.default({
    // Neura draws its own UI; the SDK should only supply the measurement.
    enablePreloadDisplay: false,
    preloadDisplayCanvasId: canvasId,
  });

  await new Promise<void>((resolve, reject) => {
    sdk.initialize(
      apiKey,
      userId,
      {
        showUserInterface: false,
        showFacePositioningOverlay: true,
        showVisualWarnings: false,
        showSignalQualityIndicator: false,
        showStartStopButton: false,
        hideShenaiLogo: true,
        enableSummaryScreen: false,
        enableHealthRisks: false,
        colorTheme: {
          themeColor: "#2e7df0",
          textColor: "#16181c",
          backgroundColor: "#1a1d21",
          tileColor: "#20242a",
        },
      },
      (result) => {
        if (result === sdk.InitializationResult.OK) resolve();
        else reject(new Error(`Shen.AI initialisation failed (${String(result)})`));
      },
    );
  });

  sdk.attachToCanvas(canvasId);

  let stopped = false;

  return {
    read() {
      if (stopped || !sdk.isInitialized()) return null;
      return {
        progressPct: Math.round(sdk.getMeasurementProgressPercentage()),
        realtime: {
          heartRateBpm: round(sdk.getRealtimeHeartRate()),
          hrvSdnnMs: round(sdk.getRealtimeHrvSdnn()),
          stressIndex: round(sdk.getRealtimeCardiacStress()),
          breathingRateBpm: round(sdk.getRealtimeMetrics(10)?.breathing_rate_bpm ?? null),
        },
        results: toResults(sdk.getMeasurementResults()),
      };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        sdk.deinitialize();
      } catch (error) {
        console.warn("[neura] Shen.AI teardown failed:", error);
      }
    },
  };
}
