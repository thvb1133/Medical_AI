/**
 * Session persistence with two interchangeable backends.
 *
 * With DATABASE_URL set, everything goes to Postgres. Without it, an in-memory
 * store keeps the app fully usable for local development and demos — but note
 * that serverless instances do not share memory, so a deployed app without a
 * database will appear to "lose" sessions between requests. The clinician
 * dashboard surfaces this rather than letting it look like a bug.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, schema } from "./db";
import { maxRisk } from "./crisis";
import type {
  ConsentState,
  RiskLevel,
  SessionAlert,
  SessionDetail,
  SessionSummary,
  Telemetry,
  TranscriptTurn,
} from "./types";

const MEMORY_TELEMETRY_CAP = 900;

export type NewSession = {
  patientName: string;
  patientRef: string;
  consent: ConsentState;
};

type MemoryRecord = SessionDetail;

type MemoryStore = { sessions: Map<string, MemoryRecord> };

// Survives Next.js hot reloads, which otherwise re-evaluate this module and
// silently drop every in-flight demo session.
const memory: MemoryStore = ((globalThis as Record<string, unknown>).__neuraStore ??= {
  sessions: new Map(),
}) as MemoryStore;

function telemetryToRow(sessionId: string, t: Telemetry) {
  return {
    sessionId,
    at: new Date(t.at),
    bpm: t.video.bpm,
    hrvMs: t.video.hrvMs,
    signalQuality: t.video.quality,
    emotion: t.video.emotion,
    emotionConfidence: t.video.emotionConfidence,
    eyeClosure: t.video.eyeClosure,
    headMotion: t.video.headMotion,
    faceDetected: t.video.faceDetected,
    pitchHz: t.voice.pitchHz,
    jitter: t.voice.jitter,
    shimmer: t.voice.shimmer,
    voiceEnergy: t.voice.energy,
    pauseRatio: t.voice.pauseRatio,
    monotony: t.voice.monotony,
    wellbeing: t.scores.wellbeing,
    stress: t.scores.stress,
    arousal: t.scores.arousal,
    valence: t.scores.valence,
    confidence: t.scores.confidence,
  };
}

type TelemetryRow = typeof schema.telemetry.$inferSelect;

function rowToTelemetry(r: TelemetryRow): Telemetry {
  return {
    at: r.at.getTime(),
    video: {
      bpm: r.bpm,
      hrvMs: r.hrvMs,
      quality: r.signalQuality,
      emotion: r.emotion,
      emotionConfidence: r.emotionConfidence,
      eyeClosure: r.eyeClosure,
      headMotion: r.headMotion,
      faceDetected: r.faceDetected,
    },
    voice: {
      pitchHz: r.pitchHz,
      jitter: r.jitter,
      shimmer: r.shimmer,
      energy: r.voiceEnergy,
      pauseRatio: r.pauseRatio,
      monotony: r.monotony,
      speaking: r.voiceEnergy > 0.05,
    },
    scores: {
      wellbeing: r.wellbeing,
      stress: r.stress,
      arousal: r.arousal,
      valence: r.valence,
      confidence: r.confidence,
    },
  };
}

export async function createSession(input: NewSession): Promise<SessionSummary> {
  const db = getDb();
  const now = Date.now();

  if (db) {
    const [row] = await db
      .insert(schema.sessions)
      .values({
        patientName: input.patientName,
        patientRef: input.patientRef,
        consentVideo: input.consent.video,
        consentAudio: input.consent.audio,
        consentShare: input.consent.shareWithClinician,
        consentGrantedAt: input.consent.grantedAt ? new Date(input.consent.grantedAt) : null,
      })
      .returning();
    return {
      id: row.id,
      patientName: row.patientName,
      patientRef: row.patientRef,
      startedAt: row.startedAt.getTime(),
      endedAt: null,
      status: "active",
      consent: input.consent,
      latest: null,
      risk: "none",
      alerts: [],
      turnCount: 0,
    };
  }

  const record: MemoryRecord = {
    id: randomUUID(),
    patientName: input.patientName,
    patientRef: input.patientRef,
    startedAt: now,
    endedAt: null,
    status: "active",
    consent: input.consent,
    latest: null,
    risk: "none",
    alerts: [],
    turnCount: 0,
    transcript: [],
    history: [],
  };
  memory.sessions.set(record.id, record);
  return record;
}

export async function getSession(id: string): Promise<SessionDetail | null> {
  const db = getDb();
  if (!db) return memory.sessions.get(id) ?? null;

  const [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
  if (!row) return null;

  const [turnRows, alertRows, telemetryRows] = await Promise.all([
    db
      .select()
      .from(schema.turns)
      .where(eq(schema.turns.sessionId, id))
      .orderBy(asc(schema.turns.at)),
    db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.sessionId, id))
      .orderBy(desc(schema.alerts.at)),
    db
      .select()
      .from(schema.telemetry)
      .where(eq(schema.telemetry.sessionId, id))
      .orderBy(desc(schema.telemetry.at))
      .limit(240),
  ]);

  const history = telemetryRows.map(rowToTelemetry).reverse();

  return {
    id: row.id,
    patientName: row.patientName,
    patientRef: row.patientRef,
    startedAt: row.startedAt.getTime(),
    endedAt: row.endedAt?.getTime() ?? null,
    status: row.status,
    risk: row.risk,
    consent: {
      video: row.consentVideo,
      audio: row.consentAudio,
      shareWithClinician: row.consentShare,
      grantedAt: row.consentGrantedAt?.getTime() ?? null,
    },
    latest: history.at(-1) ?? null,
    alerts: alertRows.map((a) => ({
      id: a.id,
      level: a.level,
      reason: a.reason,
      at: a.at.getTime(),
      acknowledged: a.acknowledged,
    })),
    turnCount: turnRows.length,
    transcript: turnRows.map((t) => ({
      id: t.id,
      role: t.role,
      text: t.text,
      at: t.at.getTime(),
      risk: t.risk ?? undefined,
    })),
    history,
  };
}

export async function listSessions(): Promise<SessionSummary[]> {
  const db = getDb();
  if (!db) {
    return [...memory.sessions.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(({ transcript, history, ...rest }) => {
        void transcript;
        void history;
        return rest;
      });
  }

  const rows = await db
    .select()
    .from(schema.sessions)
    .orderBy(desc(schema.sessions.startedAt))
    .limit(50);

  return Promise.all(
    rows.map(async (row) => {
      const [latestRow] = await db
        .select()
        .from(schema.telemetry)
        .where(eq(schema.telemetry.sessionId, row.id))
        .orderBy(desc(schema.telemetry.at))
        .limit(1);
      const openAlerts = await db
        .select()
        .from(schema.alerts)
        .where(
          and(eq(schema.alerts.sessionId, row.id), eq(schema.alerts.acknowledged, false)),
        )
        .orderBy(desc(schema.alerts.at));

      return {
        id: row.id,
        patientName: row.patientName,
        patientRef: row.patientRef,
        startedAt: row.startedAt.getTime(),
        endedAt: row.endedAt?.getTime() ?? null,
        status: row.status,
        risk: row.risk,
        consent: {
          video: row.consentVideo,
          audio: row.consentAudio,
          shareWithClinician: row.consentShare,
          grantedAt: row.consentGrantedAt?.getTime() ?? null,
        },
        latest: latestRow ? rowToTelemetry(latestRow) : null,
        alerts: openAlerts.map((a) => ({
          id: a.id,
          level: a.level,
          reason: a.reason,
          at: a.at.getTime(),
          acknowledged: a.acknowledged,
        })),
        turnCount: 0,
      } satisfies SessionSummary;
    }),
  );
}

export async function appendTelemetry(id: string, samples: Telemetry[]): Promise<void> {
  if (!samples.length) return;
  const db = getDb();

  if (db) {
    await db.insert(schema.telemetry).values(samples.map((s) => telemetryToRow(id, s)));
    return;
  }

  const record = memory.sessions.get(id);
  if (!record) return;
  record.history.push(...samples);
  if (record.history.length > MEMORY_TELEMETRY_CAP) {
    record.history.splice(0, record.history.length - MEMORY_TELEMETRY_CAP);
  }
  record.latest = record.history.at(-1) ?? null;
}

export async function appendTurn(
  id: string,
  turn: Omit<TranscriptTurn, "id">,
): Promise<TranscriptTurn> {
  const db = getDb();

  if (db) {
    const [row] = await db
      .insert(schema.turns)
      .values({
        sessionId: id,
        role: turn.role,
        text: turn.text,
        risk: turn.risk ?? null,
        at: new Date(turn.at),
      })
      .returning();
    return { id: row.id, role: row.role, text: row.text, at: row.at.getTime(), risk: row.risk ?? undefined };
  }

  const record = memory.sessions.get(id);
  const saved: TranscriptTurn = { ...turn, id: randomUUID() };
  if (record) {
    record.transcript.push(saved);
    record.turnCount = record.transcript.length;
  }
  return saved;
}

export async function raiseAlert(
  id: string,
  alert: { level: RiskLevel; reason: string; context?: unknown },
): Promise<SessionAlert> {
  const db = getDb();
  const at = Date.now();

  if (db) {
    const [row] = await db
      .insert(schema.alerts)
      .values({
        sessionId: id,
        level: alert.level,
        reason: alert.reason,
        context: alert.context ?? null,
      })
      .returning();
    await db
      .update(schema.sessions)
      .set({ risk: alert.level })
      .where(eq(schema.sessions.id, id));
    return {
      id: row.id,
      level: row.level,
      reason: row.reason,
      at: row.at.getTime(),
      acknowledged: row.acknowledged,
    };
  }

  const saved: SessionAlert = {
    id: randomUUID(),
    level: alert.level,
    reason: alert.reason,
    at,
    acknowledged: false,
  };
  const record = memory.sessions.get(id);
  if (record) {
    record.alerts.unshift(saved);
    record.risk = maxRisk(record.risk, alert.level);
  }
  return saved;
}

export async function acknowledgeAlert(sessionId: string, alertId: string): Promise<void> {
  const db = getDb();
  if (db) {
    await db
      .update(schema.alerts)
      .set({ acknowledged: true })
      .where(and(eq(schema.alerts.id, alertId), eq(schema.alerts.sessionId, sessionId)));
    return;
  }
  const record = memory.sessions.get(sessionId);
  const alert = record?.alerts.find((a) => a.id === alertId);
  if (alert) alert.acknowledged = true;
}

export async function updateRisk(id: string, level: RiskLevel): Promise<void> {
  const db = getDb();
  if (db) {
    await db.update(schema.sessions).set({ risk: level }).where(eq(schema.sessions.id, id));
    return;
  }
  const record = memory.sessions.get(id);
  if (record) record.risk = maxRisk(record.risk, level);
}

export async function endSession(id: string): Promise<void> {
  const db = getDb();
  if (db) {
    await db
      .update(schema.sessions)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(schema.sessions.id, id));
    return;
  }
  const record = memory.sessions.get(id);
  if (record) {
    record.status = "ended";
    record.endedAt = Date.now();
  }
}
