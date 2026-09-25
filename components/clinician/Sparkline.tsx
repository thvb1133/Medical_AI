"use client";

/** Minimal trend line — shape over time matters here far more than precision. */
export function Sparkline({
  values,
  width = 160,
  height = 40,
  stroke = "#8fbab5",
  label,
}: {
  values: Array<number | null>;
  width?: number;
  height?: number;
  stroke?: string;
  label?: string;
}) {
  const points = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-calm-600"
        style={{ width, height }}
      >
        not enough data
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} role="img" aria-label={label ?? "trend"}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" />
    </svg>
  );
}
