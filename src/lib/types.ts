/**
 * Domain model for a Neura consultation.
 *
 * The metric keys below are not arbitrary: the vitals mirror the fields the
 * Shen.AI SDK returns from a camera measurement, and the wellness/clinical
 * keys mirror Thymia's Helios and Apollo voice-biomarker panels. Keeping the
 * same shape means a real provider response can be dropped in without the UI
 * or the database schema changing.
 */

export type Role = "patient" | "clinician";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const EMOTION_KEYS = [
  "angry",
  "disgusted",
  "fearful",
  "happy",
  "neutral",
  "other",
  "sad",
  "surprised",
] as const;
export type EmotionKey = (typeof EMOTION_KEYS)[number];

export const EMOTION_LABELS: Record<EmotionKey, string> = {
  angry: "Angry",
  disgusted: "Disgusted",
  fearful: "Fearful",
  happy: "Happy",
  neutral: "Neutral",
  other: "Other",
  sad: "Sad",
  surprised: "Surprised",
};

export const WELLNESS_KEYS = [
  "distress",
  "stress",
  "burnout",
  "lowSelfEsteem",
  "fatigue",
] as const;
export type WellnessKey = (typeof WELLNESS_KEYS)[number];

export const WELLNESS_LABELS: Record<WellnessKey, string> = {
  distress: "Distress",
  stress: "Stress",
  burnout: "Burnout",
  lowSelfEsteem: "Low Self Esteem",
  fatigue: "Fatigue",
};

export const CLINICAL_KEYS = [
  "depression",
  "anxiety",
  "anhedonia",
  "lowMood",
  "lowEnergy",
  "sleepIssues",
  "appetiteIssues",
  "worthlessnessIssues",
  "concentrationIssues",
  "psychomotorIssues",
  "nervousness",
  "uncontrollableWorry",
  "excessiveWorry",
  "troubleRelaxing",
  "restlessness",
  "irritability",
  "dread",
] as const;
export type ClinicalKey = (typeof CLINICAL_KEYS)[number];

export const CLINICAL_LABELS: Record<ClinicalKey, string> = {
  depression: "Depression",
  anxiety: "Anxiety",
  anhedonia: "Anhedonia",
  lowMood: "Low Mood",
  lowEnergy: "Low Energy",
  sleepIssues: "Sleep Issues",
  appetiteIssues: "Appetite Issues",
  worthlessnessIssues: "Worthlessness Issues",
  concentrationIssues: "Concentration Issues",
  psychomotorIssues: "Psychomotor Issues",
  nervousness: "Nervousness",
  uncontrollableWorry: "Uncontrollable Worry",
  excessiveWorry: "Excessive Worry",
  troubleRelaxing: "Trouble Relaxing",
  restlessness: "Restlessness",
  irritability: "Irritability",
  dread: "Dread",
};

/**
 * The right-hand rail renders Apollo in two columns; splitting here rather
 * than in the component keeps the column break identical across the live
 * console and the clinician's read-only replay.
 */
export const CLINICAL_COLUMN_SPLIT = 9;

export type EmotionScores = Record<EmotionKey, number>;
export type WellnessScores = Record<WellnessKey, number>;
export type ClinicalScores = Record<ClinicalKey, number>;

export interface RealtimeVitals {
  heartRateBpm: number | null;
  hrvSdnnMs: number | null;
  stressIndex: number | null;
  breathingRateBpm: number | null;
}

export interface MeasurementResults {
  estimatedAgeYears: number | null;
  heartRateBpm: number | null;
  hrvSdnnMs: number | null;
  stressIndex: number | null;
  breathingRateBpm: number | null;
  systolicBpMmhg: number | null;
  diastolicBpMmhg: number | null;
  cardiacWorkload: number | null;
  signalQualityPct: number | null;
}

export type SafetyLevel = 0 | 1 | 2 | 3;

export interface SafetyAnalysis {
  level: SafetyLevel;
  label: string;
  guidance: string;
  reviewer: string;
  urgency: string;
}

export const SAFETY_LABELS: Record<SafetyLevel, string> = {
  0: "None",
  1: "Low",
  2: "Elevated",
  3: "Crisis",
};

export const BASELINE_SAFETY: SafetyAnalysis = {
  level: 0,
  label: SAFETY_LABELS[0],
  guidance: "Continue normal conversation; no additional mental health prompts needed.",
  reviewer: "No action required.",
  urgency: "Routine",
};

/** One sampled frame of everything the analytics rail displays. */
export interface MetricSnapshot {
  at: string;
  measurementProgressPct: number;
  realtime: RealtimeVitals;
  results: MeasurementResults;
  emotions: EmotionScores;
  wellness: WellnessScores;
  clinical: ClinicalScores;
  safety: SafetyAnalysis;
  /** True when the values came from a live provider rather than the simulator. */
  live: boolean;
}

export type MessageAuthor = "patient" | "agent";

export interface Message {
  id: string;
  sessionId: string;
  author: MessageAuthor;
  text: string;
  at: string;
}

export type SessionStatus = "active" | "ended";

export interface ConsultationSession {
  id: string;
  patientId: string;
  patientName: string;
  clinicianId: string | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  peakSafetyLevel: SafetyLevel;
  latestSafety: SafetyAnalysis;
  latestSnapshot: MetricSnapshot | null;
  summary: string | null;
}

/** Which integrations are actually configured, so the client can degrade cleanly. */
export interface RuntimeCapabilities {
  llm: boolean;
  avatar: boolean;
  realtimeVoice: boolean;
  cameraVitals: boolean;
  voiceBiomarkers: boolean;
  persistence: boolean;
}
