"use client";

/**
 * Shown the moment the safety screen flags high or crisis risk.
 *
 * It does not block the conversation. Someone in crisis who is finally talking
 * should not have a modal slammed in front of them — the numbers sit alongside
 * Fergus, always reachable, never trapping them.
 */

import type { CrisisResource } from "@/lib/crisis";

type Props = {
  resources: CrisisResource[];
  level: "high" | "crisis";
  onDismiss: () => void;
};

export function CrisisOverlay({ resources, level, onDismiss }: Props) {
  const urgent = level === "crisis";

  return (
    <aside
      role="alert"
      className={`animate-fade-up rounded-xl border p-5 ${
        urgent
          ? "border-alert-500 bg-alert-700/20"
          : "border-calm-600 bg-calm-900/60"
      }`}
    >
      <h2 className="text-lg font-semibold text-calm-50">
        {urgent ? "Please talk to someone now" : "Support is available"}
      </h2>
      <p className="mt-2 text-sm text-calm-200">
        {urgent
          ? "What you said matters, and you deserve help from a real person right away. Your care team has been notified."
          : "It sounds like things are heavy at the moment. These lines are free and open to anyone."}
      </p>

      <ul className="mt-4 space-y-2">
        {resources.map((r) => (
          <li
            key={`${r.name}-${r.contact}`}
            className="rounded-lg bg-calm-950/50 px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-calm-50">{r.name}</span>
              <span className="text-xs uppercase tracking-wide text-calm-400">
                {r.region}
              </span>
            </div>
            <div className="mt-1 text-lg font-semibold text-calm-200">{r.contact}</div>
            <div className="text-sm text-calm-400">{r.note}</div>
          </li>
        ))}
      </ul>

      {!urgent && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 text-sm text-calm-400 underline underline-offset-4 hover:text-calm-200"
        >
          Hide these for now
        </button>
      )}
    </aside>
  );
}
