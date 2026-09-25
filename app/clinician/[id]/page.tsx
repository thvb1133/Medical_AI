"use client";

import Link from "next/link";
import { use } from "react";
import { RiskBadge } from "@/components/clinician/RiskBadge";
import { Sparkline } from "@/components/clinician/Sparkline";
import { VitalsGrid } from "@/components/clinician/VitalsGrid";
import { usePolling } from "@/hooks/usePolling";
import { atLeast } from "@/lib/crisis";
import type { SessionDetail } from "@/lib/types";

const timeOf = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ClinicianSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, loading } = usePolling<SessionDetail>(`/api/sessions/${id}`, 2000);

  if (loading && !data) {
    return <main className="p-10 text-calm-400">Loading session...</main>;
  }

  if (!data) {
    return (
      <main className="p-10">
        <p className="text-calm-300">That session could not be found.</p>
        <Link href="/clinician" className="mt-4 inline-block text-calm-400 underline">
          Back to all patients
        </Link>
      </main>
    );
  }

  const history = data.history ?? [];
  const openAlerts = data.alerts.filter((a) => !a.acknowledged);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/clinician" className="text-sm text-calm-400 underline-offset-4 hover:underline">
        ← All patients
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-calm-50">{data.patientName}</h1>
          <span className="text-sm text-calm-500">{data.patientRef}</span>
          <RiskBadge level={data.risk} />
        </div>
        <span className="text-sm text-calm-500">
          {data.status === "active" ? "In session" : "Ended"} · started {timeOf(data.startedAt)}
        </span>
      </header>

      {openAlerts.length > 0 && (
        <section className="mt-6 space-y-2">
          {openAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-alert-500 bg-alert-700/20 px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={alert.level} />
                  <span className="text-sm text-alert-100">{alert.reason}</span>
                </div>
                <span className="text-xs text-calm-400">{timeOf(alert.at)}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  void fetch(`/api/alerts/${alert.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId: data.id }),
                  })
                }
                className="rounded-lg border border-alert-300/50 px-3 py-1.5 text-sm text-alert-100 hover:bg-alert-700/40"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-calm-500">
          Current readings
        </h2>
        <div className="mt-3">
          <VitalsGrid telemetry={data.latest} />
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Heart rate", values: history.map((h) => h.video.bpm), stroke: "#f7a9a9" },
          { label: "Wellbeing", values: history.map((h) => h.scores.wellbeing), stroke: "#8fbab5" },
          { label: "Stress", values: history.map((h) => h.scores.stress), stroke: "#f0c06a" },
          { label: "Mood", values: history.map((h) => h.scores.valence), stroke: "#9fc3e8" },
        ].map((chart) => (
          <div
            key={chart.label}
            className="rounded-lg border border-calm-800 bg-calm-900/40 p-4"
          >
            <div className="text-xs uppercase tracking-wide text-calm-500">{chart.label}</div>
            <div className="mt-2">
              <Sparkline
                values={chart.values}
                stroke={chart.stroke}
                label={`${chart.label} over the session`}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-calm-500">
          Conversation
        </h2>
        <div className="mt-3 space-y-3 rounded-xl border border-calm-800 bg-calm-900/30 p-5">
          {data.transcript.length === 0 && (
            <p className="text-sm text-calm-500">Nothing said yet.</p>
          )}
          {data.transcript.map((turn) => (
            <div key={turn.id} className="flex gap-3">
              <span className="w-12 shrink-0 pt-0.5 text-xs text-calm-600">
                {timeOf(turn.at)}
              </span>
              <div>
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    turn.role === "patient" ? "text-calm-300" : "text-calm-500"
                  }`}
                >
                  {turn.role === "patient" ? data.patientName : "Fergus"}
                </span>
                <p
                  className={`text-sm ${
                    turn.risk && atLeast(turn.risk, "high")
                      ? "rounded bg-alert-700/25 px-2 py-1 text-alert-100"
                      : "text-calm-100"
                  }`}
                >
                  {turn.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-calm-800 bg-calm-900/30 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-calm-500">Consent</h2>
        <ul className="mt-3 space-y-1 text-sm text-calm-300">
          <li>Camera: {data.consent.video ? "granted" : "declined"}</li>
          <li>Microphone: {data.consent.audio ? "granted" : "declined"}</li>
          <li>
            Share with care team: {data.consent.shareWithClinician ? "granted" : "declined"}
          </li>
          {data.consent.grantedAt && <li>Given at {timeOf(data.consent.grantedAt)}</li>}
        </ul>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-calm-600">
        Camera-derived heart rate and expression estimates are screening signals only. They
        are affected by lighting, movement and skin tone, and must not be used as the basis
        for a clinical decision without corroboration.
      </p>
    </main>
  );
}
