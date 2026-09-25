import {
  SAFETY_LABELS,
  type Message,
  type SafetyAnalysis,
  type SafetyLevel,
} from "./types";

/**
 * Risk triage for the transcript.
 *
 * This runs as a deterministic rule pass even when an LLM is available. A
 * language model is better at nuance, but it can also be talked out of a
 * judgement, and it is the wrong place to put the only safety net: the rules
 * below can raise the level the model returned, never lower it.
 */

interface Rule {
  level: SafetyLevel;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    level: 3,
    patterns: [
      /\bkill(ing)?\s+my\s?self\b/i,
      /\bend(ing)?\s+(it|my\s+life)\b/i,
      /\btake\s+my\s+own\s+life\b/i,
      /\bsuicid(e|al)\b/i,
      /\bi\s+(want|plan|intend)\s+to\s+die\b/i,
      /\bhurt(ing)?\s+my\s?self\b/i,
      /\bself[\s-]?harm\b/i,
      /\bi'?m\s+going\s+to\s+do\s+it\b/i,
      /\bthinking\s+about\s+it\b.*\byes\b/i,
    ],
  },
  {
    level: 2,
    patterns: [
      /\bdon'?t\s+want\s+to\s+(keep\s+)?(living|be\s+here|go\s+on)\b/i,
      /\bnot\s+sure\s+if\s+i\s+want\s+to\s+keep\s+living\b/i,
      /\bwhat'?s\s+the\s+point\b/i,
      /\bbetter\s+off\s+without\s+me\b/i,
      /\bcan'?t\s+(go\s+on|do\s+this\s+any\s?more|take\s+it\s+any\s?more)\b/i,
      /\bno\s+reason\s+to\s+(live|carry\s+on)\b/i,
      /\bwish\s+i\s+(was|were)\s+(dead|gone)\b/i,
    ],
  },
  {
    level: 1,
    patterns: [
      /\bhopeless\b/i,
      /\bworthless\b/i,
      /\bi\s+feel\s+(empty|numb|nothing)\b/i,
      /\bcan'?t\s+sleep\b/i,
      /\b(so|really|very)\s+(alone|lonely)\b/i,
      /\bnot\s+feeling\s+so\s+good\b/i,
      /\beverything\s+(is|feels)\s+(too\s+much|pointless)\b/i,
      /\bi'?m\s+(struggling|drowning|exhausted)\b/i,
    ],
  },
];

const GUIDANCE: Record<SafetyLevel, Omit<SafetyAnalysis, "level" | "label">> = {
  0: {
    guidance: "Continue normal conversation; no additional mental health prompts needed.",
    reviewer: "No action required.",
    urgency: "Routine",
  },
  1: {
    guidance:
      "Low mood indicators present. Stay with open questions and reflect back what you hear; avoid problem-solving too early.",
    reviewer: "Flag in the session notes for the next scheduled review.",
    urgency: "Routine",
  },
  2: {
    guidance:
      "Passive ideation detected. Ask directly and plainly about thoughts of suicide, and establish whether there is a plan or means.",
    reviewer: "Notify the responsible clinician before the end of the working day.",
    urgency: "Same-day",
  },
  3: {
    guidance:
      "Active risk to life. Stop assessment, stay with the patient, and escalate to emergency services or the crisis team now.",
    reviewer: "Escalate immediately. Do not leave the patient unattended.",
    urgency: "Immediate",
  },
};

export function analysisForLevel(level: SafetyLevel): SafetyAnalysis {
  return { level, label: SAFETY_LABELS[level], ...GUIDANCE[level] };
}

/** Highest level any rule matches across the supplied patient text. */
export function ruleLevel(text: string): SafetyLevel {
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.level;
  }
  return 0;
}

/**
 * Risk is sticky within a session: once someone has disclosed ideation, a
 * later "I'm fine" should not clear the flag for the reviewing clinician.
 */
export function assessTranscript(messages: Message[]): SafetyAnalysis {
  const patientText = messages
    .filter((m) => m.author === "patient")
    .map((m) => m.text)
    .join("\n");

  const recent = messages
    .filter((m) => m.author === "patient")
    .slice(-4)
    .map((m) => m.text)
    .join("\n");

  const level = Math.max(ruleLevel(patientText), ruleLevel(recent)) as SafetyLevel;
  return analysisForLevel(level);
}

/** Scalar in [0,1] that drives the simulated biomarkers. */
export function distressFromMessages(messages: Message[]): number {
  const level = assessTranscript(messages).level;
  const base = [0.08, 0.34, 0.66, 0.92][level];

  // Nudge upward when distress language is dense rather than a single remark.
  const patient = messages.filter((m) => m.author === "patient");
  if (patient.length === 0) return base;
  const flagged = patient.filter((m) => ruleLevel(m.text) > 0).length;
  const density = flagged / patient.length;
  return Math.min(1, base + density * 0.08);
}

export const CRISIS_RESOURCES = [
  { name: "Samaritans (UK)", contact: "116 123", detail: "Free, 24 hours a day, every day" },
  { name: "Suicide & Crisis Lifeline (US)", contact: "988", detail: "Call or text, 24/7" },
  { name: "Emergency services", contact: "999 / 911", detail: "If there is immediate danger to life" },
];
