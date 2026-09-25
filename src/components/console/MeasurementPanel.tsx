import { Panel, SectionLabel } from "@/components/ui/Panel";
import type { MetricSnapshot } from "@/lib/types";

interface Reading {
  label: string;
  value: number | null;
  unit?: string;
}

/**
 * A null reading renders as an em dash rather than a zero: before the
 * measurement window fills, "no value yet" and "a value of zero" mean very
 * different things to whoever is reading the panel.
 */
function ReadingRow({ reading }: { reading: Reading }) {
  const hasValue = reading.value !== null && Number.isFinite(reading.value);
  return (
    <div className="metric-row">
      <span className="metric-label">{reading.label}</span>
      <span
        className={`shrink-0 text-metric font-semibold tabular-nums ${
          hasValue ? "text-vital" : "text-ink-400"
        }`}
      >
        {hasValue ? `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}` : "—"}
      </span>
    </div>
  );
}

function ReadingList({ readings }: { readings: Reading[] }) {
  return (
    <Panel className="px-2.5 py-1.5">
      <div className="space-y-[1px]">
        {readings.map((reading) => (
          <ReadingRow key={reading.label} reading={reading} />
        ))}
      </div>
    </Panel>
  );
}

export function MeasurementPanel({ snapshot }: { snapshot: MetricSnapshot }) {
  const { realtime, results } = snapshot;
  const progress = Math.round(snapshot.measurementProgressPct);

  return (
    <Panel className="space-y-2 p-2.5">
      <div className="rounded-card border border-hairline-light px-2.5 py-2 dark:border-hairline-dark">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="section-heading">Measurement Progress</span>
          <span className="text-metric font-semibold tabular-nums text-ink-700">{progress}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-[#e8eaed] dark:bg-hairline-dark"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Measurement progress"
        >
          <div
            className="h-full rounded-full bg-progress transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <section>
        <SectionLabel>Realtime Vitals</SectionLabel>
        <ReadingList
          readings={[
            { label: "Heart Rate", value: realtime.heartRateBpm, unit: "bpm" },
            { label: "HRV (SDNN)", value: realtime.hrvSdnnMs, unit: "ms" },
            { label: "Stress Index", value: realtime.stressIndex },
            { label: "Breathing Rate", value: realtime.breathingRateBpm, unit: "bpm" },
          ]}
        />
      </section>

      <section>
        <SectionLabel>Measurement Results</SectionLabel>
        <ReadingList
          readings={[
            { label: "Estimated Age", value: results.estimatedAgeYears, unit: "yrs" },
            { label: "Heart Rate", value: results.heartRateBpm, unit: "bpm" },
            { label: "HRV (SDNN)", value: results.hrvSdnnMs, unit: "ms" },
            { label: "Stress Index", value: results.stressIndex },
            { label: "Breathing Rate", value: results.breathingRateBpm, unit: "bpm" },
            { label: "Systolic BP", value: results.systolicBpMmhg, unit: "mmHg" },
            { label: "Diastolic BP", value: results.diastolicBpMmhg, unit: "mmHg" },
            { label: "Cardiac Workload", value: results.cardiacWorkload },
            { label: "Signal Quality", value: results.signalQualityPct, unit: "%" },
          ]}
        />
      </section>
    </Panel>
  );
}
