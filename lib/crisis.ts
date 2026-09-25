/**
 * Risk detection for patient utterances.
 *
 * Design rule: this layer is deliberately over-sensitive. A false positive
 * costs a clinician a glance at a transcript; a false negative can cost a
 * life. It runs on every patient turn *before* the model replies, so the
 * safety response never depends on the model behaving correctly.
 *
 * It is a lexical screen, not an assessment. It cannot detect risk expressed
 * obliquely, in another language, or in metaphor, which is exactly why the
 * clinician dashboard surfaces the full transcript rather than just a score.
 */

import type { RiskLevel, Telemetry } from "./types";

const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|killing)\s+(myself|me)\b/i,
  /\bend(ing)?\s+(my|it)\s*(life|all)?\b/i,
  /\b(take|taking)\s+my\s+own\s+life\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(don'?t|do not|not)\s+want\s+to\s+(keep\s+)?(living|live|be here|exist)\b/i,
  /\b(want|going)\s+to\s+die\b/i,
  /\bbetter\s+off\s+(dead|without me)\b/i,
  /\bhurt(ing)?\s+myself\b/i,
  /\bself[-\s]?harm(ing)?\b/i,
  /\bcut(ting)?\s+myself\b/i,
  /\boverdos(e|ing)\b/i,
  /\bi\s+have\s+a\s+plan\b/i,
];

const HIGH_PATTERNS: RegExp[] = [
  /\bno\s+(point|reason)\s+(in\s+)?(going on|living|anything)\b/i,
  /\bcan'?t\s+(go on|take it|do this)\s*(anymore|any more)?\b/i,
  /\b(everyone|they)\s+would\s+be\s+better\s+off\b/i,
  /\bgive\s+up\b/i,
  /\bhopeless\b/i,
  /\bworthless\b/i,
  /\btrapped\b/i,
  /\bburden\b/i,
];

const MODERATE_PATTERNS: RegExp[] = [
  /\b(depress(ed|ion)|anxious|anxiety|panic)\b/i,
  /\b(can'?t sleep|not sleeping|insomnia)\b/i,
  /\b(alone|lonely|isolated)\b/i,
  /\b(empty|numb)\b/i,
  /\bcry(ing)?\b/i,
  /\bexhausted\b/i,
  /\bscared\b/i,
];

const LOW_PATTERNS: RegExp[] = [
  /\b(stressed|overwhelmed|struggling|tired|worried|low)\b/i,
];

const ORDER: RiskLevel[] = ["none", "low", "moderate", "high", "crisis"];

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

export function atLeast(level: RiskLevel, floor: RiskLevel): boolean {
  return ORDER.indexOf(level) >= ORDER.indexOf(floor);
}

export type RiskAssessment = {
  level: RiskLevel;
  reason: string;
  /** True when the app must show crisis resources and alert the clinician. */
  escalate: boolean;
};

export function assessText(text: string): RiskAssessment {
  const match = (patterns: RegExp[]) => patterns.find((p) => p.test(text));

  const crisis = match(CRISIS_PATTERNS);
  if (crisis) {
    return {
      level: "crisis",
      reason: "Patient expressed suicidal ideation or intent to self-harm.",
      escalate: true,
    };
  }

  const high = match(HIGH_PATTERNS);
  if (high) {
    return {
      level: "high",
      reason: "Patient expressed hopelessness or feeling like a burden.",
      escalate: true,
    };
  }

  if (match(MODERATE_PATTERNS)) {
    return {
      level: "moderate",
      reason: "Patient reported significant distress symptoms.",
      escalate: false,
    };
  }

  if (match(LOW_PATTERNS)) {
    return { level: "low", reason: "Patient reported mild distress.", escalate: false };
  }

  return { level: "none", reason: "No risk indicators detected.", escalate: false };
}

/**
 * Biomarkers alone never trigger an escalation — the evidence base does not
 * support that and it would pathologise, say, a fast heart rate from climbing
 * the stairs. They can only raise a risk level that language already
 * established, which is how they are meant to be used: corroboration.
 */
export function assessCombined(
  textLevel: RiskLevel,
  telemetry: Telemetry | null,
): RiskAssessment {
  const base = { level: textLevel, reason: "", escalate: atLeast(textLevel, "high") };
  if (!telemetry || telemetry.scores.confidence < 0.35) {
    return { ...base, reason: "Language-based assessment only; biomarkers unreliable." };
  }

  const distressed =
    telemetry.scores.valence < -35 ||
    (telemetry.scores.stress > 70 && telemetry.scores.wellbeing < 40);

  if (distressed && atLeast(textLevel, "moderate")) {
    const level = textLevel === "moderate" ? "high" : textLevel;
    return {
      level,
      reason:
        "Reported distress corroborated by biomarkers " +
        `(mood ${telemetry.scores.valence}, stress ${telemetry.scores.stress}).`,
      escalate: atLeast(level, "high"),
    };
  }

  return { ...base, reason: "Language-based assessment; biomarkers not corroborating." };
}

export type CrisisResource = {
  region: string;
  name: string;
  contact: string;
  note: string;
};

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    region: "UK",
    name: "Samaritans",
    contact: "116 123",
    note: "Free, 24 hours a day, every day.",
  },
  {
    region: "UK",
    name: "Shout",
    contact: "Text SHOUT to 85258",
    note: "Free 24/7 text support.",
  },
  {
    region: "UK",
    name: "NHS urgent mental health helpline",
    contact: "111, option 2",
    note: "Local NHS crisis team.",
  },
  {
    region: "US",
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    note: "Free, 24 hours a day, every day.",
  },
  {
    region: "Any",
    name: "Emergency services",
    contact: "999 (UK) / 911 (US) / 112 (EU)",
    note: "If there is immediate danger to life.",
  },
];
