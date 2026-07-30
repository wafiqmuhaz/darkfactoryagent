/** One plotted series: a fixed color slot and one value per date bucket. */
export interface Series {
  key: string;
  label: string;
  /** CSS custom property name, e.g. "--viz-series-1". Assignment is by entity. */
  colorVar: string;
  /** null renders a gap rather than a false zero. */
  values: (number | null)[];
}

/** Short axis label: "7/17" from "2026-07-17". */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}`;
}
