import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/clinician/DashboardShell";
import { RiskBadge } from "@/components/clinician/RiskBadge";
import { Sparkline } from "@/components/clinician/Sparkline";
import { AnalyticsRail } from "@/components/console/AnalyticsRail";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { ruleLevel } from "@/lib/safety";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(startedAt: string, endedAt: string | null): string {
  const ms = new Date(endedAt ?? Date.now()).getTime() - new Date(startedAt).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  return minutes < 1 ? "under a minute" : `${minutes} min`;
}

export default async function SessionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "clinician") redirect("/session");

  const { id } = await params;
  const store = getStore();
  const session = await store.getSession(id);
  if (!session) notFound();

  const [messages, snapshots] = await Promise.all([
    store.listMessages(id),
    store.listSnapshots(id, 300),
  ]);

  const heartRates = snapshots
    .map((snapshot) => snapshot.realtime.heartRateBpm)
    .filter((value): value is number => value != null);
  const latest = snapshots.at(-1) ?? session.latestSnapshot;

  return (
    <DashboardShell user={user} breadcrumb={session.patientName}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold">{session.patientName}</h1>
          <p className="mt-1 text-[12px] text-ink-500">
            {when(session.startedAt)} · {duration(session.startedAt, session.endedAt)} ·{" "}
            {session.status === "active" ? "in progress" : "ended"}
          </p>
        </div>
        <RiskBadge level={session.peakSafetyLevel} />
      </div>

      {session.summary && (
        <section className="panel-card mb-5 p-4">
          <h2 className="section-heading mb-1.5">Clinical summary</h2>
          <p className="text-[12.5px] leading-[19px] text-ink-700 dark:text-ink-300">
            {session.summary}
          </p>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel-card flex flex-col overflow-hidden">
          <h2 className="border-b border-hairline-light px-4 py-2.5 text-[13px] font-semibold dark:border-hairline-dark">
            Transcript
          </h2>
          <div className="thin-scroll max-h-[32rem] space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-center text-[11.5px] text-ink-400">
                Nothing was said in this session.
              </p>
            )}
            {messages.map((message) => {
              // Highlight the patient's own turns that triggered escalation, so
              // the reviewer can find the disclosure without reading it all.
              const flagged = message.author === "patient" && ruleLevel(message.text) >= 2;
              return (
                <div key={message.id}>
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      {message.author === "patient" ? session.patientName : "Agent"}
                    </span>
                    <span className="text-[10px] text-ink-300">
                      {new Date(message.at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p
                    className={`rounded-md px-3 py-2 text-[12px] leading-[18px] ${
                      flagged
                        ? "border border-red-200 bg-red-50 text-red-900"
                        : message.author === "patient"
                          ? "bg-[#f1f2f4] text-ink-900 dark:bg-hairline-dark dark:text-white"
                          : "text-ink-700 dark:text-ink-300"
                    }`}
                  >
                    {message.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-4">
          {heartRates.length >= 2 && (
            <section className="panel-card p-3">
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="section-heading">Heart rate trend</h2>
                <span className="text-[10.5px] tabular-nums text-ink-400">
                  {Math.min(...heartRates)}–{Math.max(...heartRates)} bpm
                </span>
              </div>
              <Sparkline values={heartRates} label="Heart rate" />
            </section>
          )}

          {latest ? (
            <AnalyticsRail snapshot={latest} />
          ) : (
            <p className="panel-card px-3 py-6 text-center text-[11.5px] text-ink-400">
              No biomarker samples were recorded for this session.
            </p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
