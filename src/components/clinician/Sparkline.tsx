/**
 * Minimal trend line for a single vital across a session.
 *
 * There is deliberately no axis or gridline: at this size the only readable
 * signal is the shape, and the exact figures are already listed beside it.
 */
export function Sparkline({
  values,
  label,
  width = 180,
  height = 34,
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  const points = values.filter((value) => Number.isFinite(value));
  if (points.length < 2) {
    return <p className="text-[10.5px] text-ink-400">Not enough samples for a trend.</p>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series would divide by zero; give it a nominal band so it renders
  // as a centred straight line rather than collapsing to the top edge.
  const span = max - min || 1;

  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[34px] w-full"
      role="img"
      aria-label={`${label}: ${Math.round(min)} to ${Math.round(max)}`}
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke="#17a34a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
