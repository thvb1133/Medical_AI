import { LabelledPanel } from "@/components/ui/Panel";
import { ScoreGrid } from "./ScoreGrid";
import {
  CLINICAL_COLUMN_SPLIT,
  CLINICAL_KEYS,
  CLINICAL_LABELS,
  EMOTION_KEYS,
  EMOTION_LABELS,
  WELLNESS_KEYS,
  WELLNESS_LABELS,
  type MetricSnapshot,
  type SafetyAnalysis,
} from "@/lib/types";

const SAFETY_STYLES: Record<number, string> = {
  0: "border-safe-border bg-safe-bg text-safe-text",
  1: "border-amber-200 bg-amber-50 text-amber-800",
  2: "border-orange-300 bg-orange-50 text-orange-900",
  3: "border-red-300 bg-red-50 text-red-900",
};

function SafetyPanel({ safety }: { safety: SafetyAnalysis }) {
  return (
    <div className={`rounded-card border px-2.5 py-2 ${SAFETY_STYLES[safety.level]}`}>
      <p className="text-panel font-semibold">
        Level {safety.level} — {safety.label}
      </p>
      <dl className="mt-1.5 space-y-1 text-micro leading-[13px]">
        <div>
          <dt className="inline font-semibold">Guidance: </dt>
          <dd className="inline opacity-90">{safety.guidance}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Reviewer: </dt>
          <dd className="inline opacity-90">{safety.reviewer}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Urgency: </dt>
          <dd className="inline opacity-90">{safety.urgency}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The clinician-facing rail. Deliberately read-only: nothing here is a control,
 * because acting on a reading is a decision for the professional, not a button
 * in the patient's consultation window.
 */
export function AnalyticsRail({ snapshot }: { snapshot: MetricSnapshot }) {
  return (
    <div className="flex flex-col gap-2.5">
      <LabelledPanel label="Emotions">
        <ScoreGrid
          splitAt={4}
          scores={EMOTION_KEYS.map((key) => ({
            label: EMOTION_LABELS[key],
            value: snapshot.emotions[key],
          }))}
        />
      </LabelledPanel>

      <LabelledPanel label="Helios — Wellness">
        <ScoreGrid
          scores={WELLNESS_KEYS.map((key) => ({
            label: WELLNESS_LABELS[key],
            value: snapshot.wellness[key],
          }))}
        />
      </LabelledPanel>

      <LabelledPanel label="Apollo — Clinical">
        <ScoreGrid
          splitAt={CLINICAL_COLUMN_SPLIT}
          scores={CLINICAL_KEYS.map((key) => ({
            label: CLINICAL_LABELS[key],
            value: snapshot.clinical[key],
          }))}
        />
      </LabelledPanel>

      <section>
        <p className="section-heading mb-1">Safety Analysis</p>
        <SafetyPanel safety={snapshot.safety} />
      </section>
    </div>
  );
}
