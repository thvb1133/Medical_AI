export interface Score {
  label: string;
  value: number;
}

/**
 * Percentages are colour-coded rather than uniformly styled so a clinician can
 * scan the rail and spot an elevated indicator without reading every number.
 */
export function scoreColour(value: number): string {
  if (value >= 75) return "text-scale-peak";
  if (value >= 50) return "text-scale-high";
  if (value >= 25) return "text-scale-mid";
  return "text-scale-low";
}

function Column({ scores }: { scores: Score[] }) {
  return (
    <div className="min-w-0 flex-1 space-y-[1px]">
      {scores.map((score) => (
        <div key={score.label} className="metric-row">
          <span className="metric-label text-micro leading-[13px]">{score.label}</span>
          <span
            className={`shrink-0 text-micro font-semibold tabular-nums leading-[13px] ${scoreColour(
              score.value,
            )}`}
          >
            {Math.round(score.value)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * `splitAt` controls where the list breaks into a second column, matching the
 * console layout exactly (Emotions breaks after 4, Apollo after 9).
 */
export function ScoreGrid({ scores, splitAt }: { scores: Score[]; splitAt?: number }) {
  if (splitAt === undefined) return <Column scores={scores} />;

  return (
    <div className="flex gap-3">
      <Column scores={scores.slice(0, splitAt)} />
      <Column scores={scores.slice(splitAt)} />
    </div>
  );
}
