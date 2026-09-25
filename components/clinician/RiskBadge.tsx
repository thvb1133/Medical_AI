import type { RiskLevel } from "@/lib/types";

const STYLES: Record<RiskLevel, { label: string; className: string }> = {
  none: { label: "No flags", className: "bg-calm-800 text-calm-300" },
  low: { label: "Low", className: "bg-calm-700 text-calm-100" },
  moderate: { label: "Moderate", className: "bg-amber-500/20 text-amber-200" },
  high: { label: "High", className: "bg-alert-500/25 text-alert-100" },
  crisis: { label: "Crisis", className: "bg-alert-500 text-white" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const style = STYLES[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
