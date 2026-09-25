/** Shared domain types for the patient session and the clinician dashboard. */

export type RiskLevel = "none" | "low" | "moderate" | "high" | "crisis";

export type Emotion =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "surprised"
  | "disgusted";

/** One snapshot of everything the browser measured at a moment in time. */
export type Telemetry = {
  at: number;
  video: {
    bpm: number | null;
    hrvMs: number | null;
    /** 0..1 confidence in the camera-derived cardiac signal. */
    quality: number;
    emotion: Emotion;
    /** 0..1 strength of the dominant expression. */
    emotionConfidence: number;
    /** 0..1, higher means more eye closure — a fatigue proxy. */
    eyeClosure: number;
    /** 0..1, how much the head moved recently — a restlessness proxy. */
    headMotion: number;
    faceDetected: boolean;
  };
  voice: {
    /** Fundamental frequency in Hz, null during silence. */
    pitchHz: number | null;
    /** Cycle-to-cycle pitch variation, a vocal-instability proxy. */
    jitter: number;
    /** Cycle-to-cycle amplitude variation. */
    shimmer: number;
    /** 0..1 loudness. */
    energy: number;
    /** Fraction of the window that was silence. */
    pauseRatio: number;
    /** 0..1 flatness of intonation — elevated in low mood. */
    monotony: number;
    speaking: boolean;
  };
  scores: WellbeingScores;
};

export type WellbeingScores = {
  /** 0..100, higher is better. */
  wellbeing: number;
  /** 0..100, higher means more physiological arousal/stress. */
  stress: number;
  /** 0..100, higher means more activated. */
  arousal: number;
  /** -100..100, negative is low mood. */
  valence: number;
  /** 0..1 how much of the input was actually usable. */
  confidence: number;
};

export type TranscriptTurn = {
  id: string;
  role: "patient" | "assistant";
  text: string;
  at: number;
  risk?: RiskLevel;
};

export type SessionAlert = {
  id: string;
  level: RiskLevel;
  reason: string;
  at: number;
  acknowledged: boolean;
};

export type SessionSummary = {
  id: string;
  patientName: string;
  patientRef: string;
  startedAt: number;
  endedAt: number | null;
  status: "active" | "ended";
  consent: ConsentState;
  latest: Telemetry | null;
  risk: RiskLevel;
  alerts: SessionAlert[];
  turnCount: number;
};

export type SessionDetail = SessionSummary & {
  transcript: TranscriptTurn[];
  history: Telemetry[];
};

export type ConsentState = {
  video: boolean;
  audio: boolean;
  shareWithClinician: boolean;
  grantedAt: number | null;
};

/** Which integrations are actually configured on the server. */
export type ProviderStatus = {
  llm: "anthropic" | "openai" | "fallback";
  stt: "deepgram" | "browser";
  tts: "elevenlabs" | "browser";
  avatar: "anam" | "canvas";
  storage: "postgres" | "memory";
  clinicianGate: boolean;
};
