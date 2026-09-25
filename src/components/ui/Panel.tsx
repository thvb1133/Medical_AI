import type { ReactNode } from "react";

/**
 * The console repeats one visual idiom everywhere: a small uppercase caption
 * sitting above a hairline-bordered box. Both halves live here so the spacing
 * stays identical between the live console and the clinician's replay.
 */
export function SectionLabel({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <span className="section-heading">{children}</span>
      {trailing}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`panel-card ${className}`}>{children}</div>;
}

export function LabelledPanel({
  label,
  trailing,
  children,
  bodyClassName = "px-2.5 py-2",
}: {
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section>
      <SectionLabel trailing={trailing}>{label}</SectionLabel>
      <Panel className={bodyClassName}>{children}</Panel>
    </section>
  );
}
