import "server-only";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { serverConfig } from "./config";
import {
  BASELINE_SAFETY,
  type ConsultationSession,
  type Message,
  type MessageAuthor,
  type MetricSnapshot,
  type Role,
  type SafetyAnalysis,
  type SafetyLevel,
  type User,
} from "./types";

/**
 * Persistence with two interchangeable drivers.
 *
 * Postgres is used whenever DATABASE_URL is present; otherwise everything is
 * held in process memory so the app can be deployed and demonstrated before a
 * database exists. The in-memory driver is explicitly not durable, and the
 * clinician dashboard says so rather than pretending the history is safe.
 */

export interface StoredUser extends User {
  passwordHash: string;
}

export interface NewSession {
  patientId: string;
  patientName: string;
  clinicianId: string | null;
}

export interface Store {
  readonly durable: boolean;
  createUser(input: Omit<StoredUser, "id" | "createdAt">): Promise<StoredUser>;
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(id: string): Promise<StoredUser | null>;
  listUsersByRole(role: Role): Promise<User[]>;
  createSession(input: NewSession): Promise<ConsultationSession>;
  getSession(id: string): Promise<ConsultationSession | null>;
  listSessions(filter?: { patientId?: string; limit?: number }): Promise<ConsultationSession[]>;
  endSession(id: string, summary: string | null): Promise<void>;
  recordSnapshot(sessionId: string, snapshot: MetricSnapshot): Promise<void>;
  listSnapshots(sessionId: string, limit?: number): Promise<MetricSnapshot[]>;
  addMessage(sessionId: string, author: MessageAuthor, text: string): Promise<Message>;
  listMessages(sessionId: string): Promise<Message[]>;
}

function emptySession(id: string, input: NewSession): ConsultationSession {
  return {
    id,
    patientId: input.patientId,
    patientName: input.patientName,
    clinicianId: input.clinicianId,
    status: "active",
    startedAt: new Date().toISOString(),
    endedAt: null,
    messageCount: 0,
    peakSafetyLevel: 0,
    latestSafety: BASELINE_SAFETY,
    latestSnapshot: null,
    summary: null,
  };
}

/* ------------------------------------------------------------------ memory */

interface MemoryState {
  users: Map<string, StoredUser>;
  sessions: Map<string, ConsultationSession>;
  messages: Map<string, Message[]>;
  snapshots: Map<string, MetricSnapshot[]>;
}

const memoryState: MemoryState = ((
  globalThis as unknown as { __neuraMemory?: MemoryState }
).__neuraMemory ??= {
  users: new Map(),
  sessions: new Map(),
  messages: new Map(),
  snapshots: new Map(),
});

/** Snapshots are sampled once a second; cap the tail we keep per session. */
const MAX_SNAPSHOTS = 600;

const memoryStore: Store = {
  durable: false,

  async createUser(input) {
    const user: StoredUser = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    memoryState.users.set(user.id, user);
    return user;
  },

  async getUserByEmail(email) {
    const target = email.toLowerCase();
    for (const user of memoryState.users.values()) {
      if (user.email.toLowerCase() === target) return user;
    }
    return null;
  },

  async getUserById(id) {
    return memoryState.users.get(id) ?? null;
  },

  async listUsersByRole(role) {
    return [...memoryState.users.values()]
      .filter((u) => u.role === role)
      .map(({ passwordHash: _ignored, ...rest }) => rest)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async createSession(input) {
    const session = emptySession(randomUUID(), input);
    memoryState.sessions.set(session.id, session);
    memoryState.messages.set(session.id, []);
    memoryState.snapshots.set(session.id, []);
    return session;
  },

  async getSession(id) {
    return memoryState.sessions.get(id) ?? null;
  },

  async listSessions(filter) {
    let all = [...memoryState.sessions.values()];
    if (filter?.patientId) all = all.filter((s) => s.patientId === filter.patientId);
    all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return filter?.limit ? all.slice(0, filter.limit) : all;
  },

  async endSession(id, summary) {
    const session = memoryState.sessions.get(id);
    if (!session) return;
    session.status = "ended";
    session.endedAt = new Date().toISOString();
    session.summary = summary;
  },

  async recordSnapshot(sessionId, snapshot) {
    const session = memoryState.sessions.get(sessionId);
    if (!session) return;
    session.latestSnapshot = snapshot;
    session.latestSafety = snapshot.safety;
    session.peakSafetyLevel = Math.max(
      session.peakSafetyLevel,
      snapshot.safety.level,
    ) as SafetyLevel;

    const list = memoryState.snapshots.get(sessionId) ?? [];
    list.push(snapshot);
    if (list.length > MAX_SNAPSHOTS) list.splice(0, list.length - MAX_SNAPSHOTS);
    memoryState.snapshots.set(sessionId, list);
  },

  async listSnapshots(sessionId, limit) {
    const list = memoryState.snapshots.get(sessionId) ?? [];
    return limit ? list.slice(-limit) : [...list];
  },

  async addMessage(sessionId, author, text) {
    const message: Message = {
      id: randomUUID(),
      sessionId,
      author,
      text,
      at: new Date().toISOString(),
    };
    const list = memoryState.messages.get(sessionId) ?? [];
    list.push(message);
    memoryState.messages.set(sessionId, list);

    const session = memoryState.sessions.get(sessionId);
    if (session) session.messageCount = list.length;
    return message;
  },

  async listMessages(sessionId) {
    return [...(memoryState.messages.get(sessionId) ?? [])];
  },
};

/* ---------------------------------------------------------------- postgres */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS neura_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS neura_sessions (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES neura_users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  clinician_id UUID REFERENCES neura_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  peak_safety_level INTEGER NOT NULL DEFAULT 0,
  latest_safety JSONB,
  latest_snapshot JSONB,
  summary TEXT
);
CREATE INDEX IF NOT EXISTS neura_sessions_started_idx ON neura_sessions (started_at DESC);
CREATE TABLE IF NOT EXISTS neura_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES neura_sessions(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS neura_messages_session_idx ON neura_messages (session_id, at);
CREATE TABLE IF NOT EXISTS neura_snapshots (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES neura_sessions(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS neura_snapshots_session_idx ON neura_snapshots (session_id, at);
`;

interface SessionRow {
  id: string;
  patient_id: string;
  patient_name: string;
  clinician_id: string | null;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  message_count: number;
  peak_safety_level: number;
  latest_safety: SafetyAnalysis | null;
  latest_snapshot: MetricSnapshot | null;
  summary: string | null;
}

function toSession(row: SessionRow): ConsultationSession {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    clinicianId: row.clinician_id,
    status: row.status === "ended" ? "ended" : "active",
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at ? row.ended_at.toISOString() : null,
    messageCount: row.message_count,
    peakSafetyLevel: row.peak_safety_level as SafetyLevel,
    latestSafety: row.latest_safety ?? BASELINE_SAFETY,
    latestSnapshot: row.latest_snapshot,
    summary: row.summary,
  };
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  created_at: Date;
}

function toUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "clinician" ? "clinician" : "patient",
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
  };
}

function createPostgresStore(connectionString: string): Store {
  const globalRef = globalThis as unknown as { __neuraPool?: Pool; __neuraSchema?: Promise<void> };
  const pool = (globalRef.__neuraPool ??= new Pool({
    connectionString,
    // Managed Postgres (Neon, Supabase, Vercel) terminates TLS with certs the
    // default Node trust store rejects; the connection is still encrypted.
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    max: 5,
  }));

  const ready = () => (globalRef.__neuraSchema ??= pool.query(SCHEMA).then(() => undefined));

  return {
    durable: true,

    async createUser(input) {
      await ready();
      const id = randomUUID();
      const { rows } = await pool.query<UserRow>(
        `INSERT INTO neura_users (id, email, name, role, password_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, input.email, input.name, input.role, input.passwordHash],
      );
      return toUser(rows[0]);
    },

    async getUserByEmail(email) {
      await ready();
      const { rows } = await pool.query<UserRow>(
        "SELECT * FROM neura_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [email],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },

    async getUserById(id) {
      await ready();
      const { rows } = await pool.query<UserRow>(
        "SELECT * FROM neura_users WHERE id = $1 LIMIT 1",
        [id],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },

    async listUsersByRole(role) {
      await ready();
      const { rows } = await pool.query<UserRow>(
        "SELECT * FROM neura_users WHERE role = $1 ORDER BY name",
        [role],
      );
      return rows.map((row) => {
        const { passwordHash: _ignored, ...rest } = toUser(row);
        return rest;
      });
    },

    async createSession(input) {
      await ready();
      const { rows } = await pool.query<SessionRow>(
        `INSERT INTO neura_sessions (id, patient_id, patient_name, clinician_id, latest_safety)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          randomUUID(),
          input.patientId,
          input.patientName,
          input.clinicianId,
          JSON.stringify(BASELINE_SAFETY),
        ],
      );
      return toSession(rows[0]);
    },

    async getSession(id) {
      await ready();
      const { rows } = await pool.query<SessionRow>(
        "SELECT * FROM neura_sessions WHERE id = $1 LIMIT 1",
        [id],
      );
      return rows[0] ? toSession(rows[0]) : null;
    },

    async listSessions(filter) {
      await ready();
      const limit = filter?.limit ?? 100;
      const { rows } = filter?.patientId
        ? await pool.query<SessionRow>(
            "SELECT * FROM neura_sessions WHERE patient_id = $1 ORDER BY started_at DESC LIMIT $2",
            [filter.patientId, limit],
          )
        : await pool.query<SessionRow>(
            "SELECT * FROM neura_sessions ORDER BY started_at DESC LIMIT $1",
            [limit],
          );
      return rows.map(toSession);
    },

    async endSession(id, summary) {
      await ready();
      await pool.query(
        "UPDATE neura_sessions SET status = 'ended', ended_at = NOW(), summary = $2 WHERE id = $1",
        [id, summary],
      );
    },

    async recordSnapshot(sessionId, snapshot) {
      await ready();
      await pool.query(
        "INSERT INTO neura_snapshots (id, session_id, snapshot) VALUES ($1, $2, $3)",
        [randomUUID(), sessionId, JSON.stringify(snapshot)],
      );
      await pool.query(
        `UPDATE neura_sessions
            SET latest_snapshot = $2,
                latest_safety = $3,
                peak_safety_level = GREATEST(peak_safety_level, $4)
          WHERE id = $1`,
        [sessionId, JSON.stringify(snapshot), JSON.stringify(snapshot.safety), snapshot.safety.level],
      );
    },

    async listSnapshots(sessionId, limit) {
      await ready();
      const { rows } = await pool.query<{ snapshot: MetricSnapshot }>(
        "SELECT snapshot FROM neura_snapshots WHERE session_id = $1 ORDER BY at DESC LIMIT $2",
        [sessionId, limit ?? MAX_SNAPSHOTS],
      );
      return rows.map((r) => r.snapshot).reverse();
    },

    async addMessage(sessionId, author, text) {
      await ready();
      const { rows } = await pool.query<{ id: string; at: Date }>(
        "INSERT INTO neura_messages (id, session_id, author, text) VALUES ($1, $2, $3, $4) RETURNING id, at",
        [randomUUID(), sessionId, author, text],
      );
      await pool.query(
        "UPDATE neura_sessions SET message_count = message_count + 1 WHERE id = $1",
        [sessionId],
      );
      return { id: rows[0].id, sessionId, author, text, at: rows[0].at.toISOString() };
    },

    async listMessages(sessionId) {
      await ready();
      const { rows } = await pool.query<{
        id: string;
        author: string;
        text: string;
        at: Date;
      }>("SELECT id, author, text, at FROM neura_messages WHERE session_id = $1 ORDER BY at", [
        sessionId,
      ]);
      return rows.map((row) => ({
        id: row.id,
        sessionId,
        author: row.author === "agent" ? ("agent" as const) : ("patient" as const),
        text: row.text,
        at: row.at.toISOString(),
      }));
    },
  };
}

let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    store = serverConfig.databaseUrl
      ? createPostgresStore(serverConfig.databaseUrl)
      : memoryStore;
  }
  return store;
}
