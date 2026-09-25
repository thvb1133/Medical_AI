import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Emotion, RiskLevel } from "../types";

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientName: text("patient_name").notNull(),
    /** Pseudonymous reference a clinician can match to their own records. */
    patientRef: text("patient_ref").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: text("status").$type<"active" | "ended">().notNull().default("active"),
    risk: text("risk").$type<RiskLevel>().notNull().default("none"),
    consentVideo: boolean("consent_video").notNull().default(false),
    consentAudio: boolean("consent_audio").notNull().default(false),
    consentShare: boolean("consent_share").notNull().default(false),
    consentGrantedAt: timestamp("consent_granted_at", { withTimezone: true }),
  },
  (t) => [index("sessions_started_at_idx").on(t.startedAt)],
);

export const telemetry = pgTable(
  "telemetry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    bpm: integer("bpm"),
    hrvMs: integer("hrv_ms"),
    signalQuality: real("signal_quality").notNull().default(0),
    emotion: text("emotion").$type<Emotion>().notNull().default("neutral"),
    emotionConfidence: real("emotion_confidence").notNull().default(0),
    eyeClosure: real("eye_closure").notNull().default(0),
    headMotion: real("head_motion").notNull().default(0),
    faceDetected: boolean("face_detected").notNull().default(false),
    pitchHz: integer("pitch_hz"),
    jitter: real("jitter").notNull().default(0),
    shimmer: real("shimmer").notNull().default(0),
    voiceEnergy: real("voice_energy").notNull().default(0),
    pauseRatio: real("pause_ratio").notNull().default(0),
    monotony: real("monotony").notNull().default(0),
    wellbeing: integer("wellbeing").notNull().default(50),
    stress: integer("stress").notNull().default(0),
    arousal: integer("arousal").notNull().default(0),
    valence: integer("valence").notNull().default(0),
    confidence: real("confidence").notNull().default(0),
  },
  (t) => [index("telemetry_session_at_idx").on(t.sessionId, t.at)],
);

export const turns = pgTable(
  "turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").$type<"patient" | "assistant">().notNull(),
    text: text("text").notNull(),
    risk: text("risk").$type<RiskLevel>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("turns_session_at_idx").on(t.sessionId, t.at)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    level: text("level").$type<RiskLevel>().notNull(),
    reason: text("reason").notNull(),
    /** Snapshot of the biomarkers at the moment the alert fired. */
    context: jsonb("context"),
    acknowledged: boolean("acknowledged").notNull().default(false),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alerts_session_at_idx").on(t.sessionId, t.at)],
);
