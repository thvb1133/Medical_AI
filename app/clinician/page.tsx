"use client";

import Link from "next/link";
import { useState } from "react";
import { AccessGate } from "@/components/clinician/AccessGate";
import { RiskBadge } from "@/components/clinician/RiskBadge";
import { usePolling } from "@/hooks/usePolling";
import { atLeast } from "@/lib/crisis";
import type { ProviderStatus, SessionSummary } from "@/lib/types";

function relativeTime(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export default function ClinicianPage() {
  const [unlockedAt, setUnlockedAt] = useState(0);
  const sessions = usePolling<{ sessions: SessionSummary[] }>(
    `/api/sessions?v=${unlockedAt}`,
    2500,
  );
  const config = usePolling<ProviderStatus>("/api/config", 60_000);

  if (sessions.error === "unauthorised") {
    return <AccessGate onUnlocked={() => setUnlockedAt(Date.now())} />;
  }

  const list = sessions.data?.sessions ?? [];
  // Anyone flagged rises to the top; within a tier the most recent first.
  const sorted = [...list].sort((a, b) => {
    const flagged = Number(atLeast(b.risk, "high")) - Number(atLeast(a.risk, "high"));
    return flagged !== 0 ? flagged : b.startedAt - a.startedAt;
  });

  const active = sorted.filter((s) => s.status === "active");
  const flagged = sorted.filter((s) => atLeast(s.risk, "high"));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-calm-50">Patient monitoring</h1>
          <p className="mt-1 text-sm text-calm-400">
            {active.length} in session · {flagged.length} needing attention
          </p>
        </div>
        <Link href="/" className="text-sm text-calm-400 underline-offset-4 hover:underline">
          Back to start
        </Link>
      </header>

      {config.data && !config.data.clinicianGate && (
        <p className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No clinician access code is set, so this page is public. Set
          <code className="mx-1 rounded bg-calm-950/50 px-1.5 py-0.5">CLINICIAN_ACCESS_CODE</code>
          before sharing this deployment.
        </p>
      )}

      {config.data?.storage === "memory" && (
        <p className="mt-3 rounded-lg border border-calm-700 bg-calm-900/50 px-4 py-3 text-sm text-calm-300">
          Running without a database. Sessions are held in server memory only and will not
          survive a redeploy or appear consistently across serverless instances.
        </p>
      )}

      {sessions.loading && !list.length && (
        <p className="mt-10 text-sm text-calm-500">Loading sessions...</p>
      )}

      {!sessions.loading && !list.length && (
        <div className="mt-10 rounded-xl border border-dashed border-calm-800 p-10 text-center">
          <p className="text-calm-300">No sessions yet.</p>
          <Link
            href="/session"
            className="mt-4 inline-block rounded-lg bg-calm-700 px-4 py-2 text-sm text-calm-50 hover:bg-calm-600"
          >
            Start a demo session
          </Link>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {sorted.map((session) => {
          const openAlerts = session.alerts.filter((a) => !a.acknowledged);
          return (
            <li key={session.id}>
              <Link
                href={`/clinician/${session.id}`}
                className={`block rounded-xl border p-5 transition hover:border-calm-500 ${
                  atLeast(session.risk, "high")
                    ? "border-alert-500/60 bg-alert-700/10"
                    : "border-calm-800 bg-calm-900/30"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-calm-50">{session.patientName}</span>
                    <span className="text-xs text-calm-500">{session.patientRef}</span>
                    <RiskBadge level={session.risk} />
                    {session.status === "active" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-calm-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        live
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-calm-500">
                    started {relativeTime(session.startedAt)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-calm-400">
                  <span>
                    HR{" "}
                    <span className="text-calm-100">
                      {session.latest?.video.bpm ?? "—"}
                      {session.latest?.video.bpm ? " bpm" : ""}
                    </span>
                  </span>
                  <span>
                    Wellbeing{" "}
                    <span className="text-calm-100">
                      {session.latest ? `${session.latest.scores.wellbeing}/100` : "—"}
                    </span>
                  </span>
                  <span>
                    Stress{" "}
                    <span className="text-calm-100">
                      {session.latest ? `${session.latest.scores.stress}/100` : "—"}
                    </span>
                  </span>
                  <span>
                    Expression{" "}
                    <span className="text-calm-100">
                      {session.latest?.video.faceDetected
                        ? session.latest.video.emotion
                        : "—"}
                    </span>
                  </span>
                </div>

                {openAlerts.length > 0 && (
                  <p className="mt-3 rounded-lg bg-alert-700/30 px-3 py-2 text-sm text-alert-100">
                    {openAlerts[0].reason}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
