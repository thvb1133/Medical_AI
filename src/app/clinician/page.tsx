import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/clinician/DashboardShell";
import { RiskBadge } from "@/components/clinician/RiskBadge";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { ConsultationSession, SafetyLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionRow({ session }: { session: ConsultationSession }) {
  const hr = session.latestSnapshot?.realtime.heartRateBpm;
  return (
    <Link
      href={`/clinician/sessions/${session.id}`}
      className="flex items-center gap-3 border-b border-hairline-light px-3 py-2.5 transition last:border-b-0 hover:bg-[#f7f8f9] dark:border-hairline-dark dark:hover:bg-hairline-dark/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium">{session.patientName}</p>
        <p className="mt-0.5 text-[10.5px] text-ink-400">
          {when(session.startedAt)} · {session.messageCount} message
          {session.messageCount === 1 ? "" : "s"}
          {session.status === "active" && " · in progress"}
        </p>
      </div>

      {hr != null && (
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-vital">
          {hr} bpm
        </span>
      )}
      <RiskBadge level={session.peakSafetyLevel} />
    </Link>
  );
}

export default async function ClinicianDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "clinician") redirect("/session");

  const store = getStore();
  const [patients, sessions] = await Promise.all([
    store.listUsersByRole("patient"),
    store.listSessions({ limit: 200 }),
  ]);

  // Anything at level 2 or above needs a human decision, so it is pulled to
  // the top of the page rather than left to be found by scrolling.
  const needsAttention = sessions.filter((session) => session.peakSafetyLevel >= 2);

  const statsBySession = new Map<string, ConsultationSession[]>();
  for (const session of sessions) {
    const list = statsBySession.get(session.patientId) ?? [];
    list.push(session);
    statsBySession.set(session.patientId, list);
  }

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-[18px] font-semibold">Monitoring dashboard</h1>
        <p className="mt-1 text-[12px] text-ink-500">
          {patients.length} patient{patients.length === 1 ? "" : "s"} · {sessions.length} session
          {sessions.length === 1 ? "" : "s"} recorded
          {!store.durable && " · in-memory storage, not durable"}
        </p>
      </div>

      {needsAttention.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-semibold text-red-700">
            Needs attention ({needsAttention.length})
          </h2>
          <div className="panel-card overflow-hidden border-red-200">
            {needsAttention.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">Patients</h2>
          {patients.length === 0 ? (
            <p className="panel-card px-3 py-6 text-center text-[11.5px] text-ink-400">
              No patients have registered yet.
            </p>
          ) : (
            <div className="panel-card overflow-hidden">
              {patients.map((patient) => {
                const theirs = statsBySession.get(patient.id) ?? [];
                const peak = theirs.reduce<SafetyLevel>(
                  (max, session) => (session.peakSafetyLevel > max ? session.peakSafetyLevel : max),
                  0,
                );
                return (
                  <div
                    key={patient.id}
                    className="flex items-center gap-3 border-b border-hairline-light px-3 py-2.5 last:border-b-0 dark:border-hairline-dark"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{patient.name}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-ink-400">
                        {patient.email} · {theirs.length} session{theirs.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <RiskBadge level={peak} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-semibold">Recent sessions</h2>
          {sessions.length === 0 ? (
            <p className="panel-card px-3 py-6 text-center text-[11.5px] text-ink-400">
              No sessions recorded yet.
            </p>
          ) : (
            <div className="panel-card overflow-hidden">
              {sessions.slice(0, 12).map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
