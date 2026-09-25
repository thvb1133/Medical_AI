import { SAFETY_LABELS, type SafetyLevel } from "@/lib/types";

const STYLES: Record<SafetyLevel, string> = {
  0: "bg-safe-bg text-safe-text border-safe-border",
  1: "bg-amber-50 text-amber-800 border-amber-200",
  2: "bg-orange-50 text-orange-900 border-orange-300",
  3: "bg-red-50 text-red-900 border-red-300",
};

export function RiskBadge({ level }: { level: SafetyLevel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STYLES[level]}`}
    >
      Level {level} — {SAFETY_LABELS[level]}
    </span>
  );
}
