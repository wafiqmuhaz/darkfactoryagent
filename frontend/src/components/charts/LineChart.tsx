import { ChartFrame } from './ChartFrame';
import { shortDate } from './series';
import type { Series } from './series';

const WIDTH = 320;
const HEIGHT = 96;
const PAD_BOTTOM = 16;
const PLOT_H = HEIGHT - PAD_BOTTOM;

interface LineChartProps {
  title: string;
  subtitle?: string;
  dates: string[];
  series: Series[];
  /** Fix the y-axis top, e.g. 100 for a percentage. */
  maxValue?: number;
  format?: (value: number) => string;
}

/**
 * Line chart with a 2px stroke, a ~10% area wash, and an end marker carrying a
 * 2px surface ring. Nulls break the path instead of drawing through them, so a
 * day with no runs reads as a gap rather than a real zero.
 */
export const LineChart = ({ title, subtitle, dates, series, maxValue, format }: LineChartProps) => {
  const buckets = dates.length || 1;
  const step = buckets > 1 ? WIDTH / (buckets - 1) : WIDTH;
  const observedMax = Math.max(
    ...series.flatMap((s) => s.values.map((v) => v ?? 0)),
    1
  );
  const max = maxValue ?? observedMax;

  const xOf = (i: number) => (buckets > 1 ? i * step : WIDTH / 2);
  const yOf = (v: number) => PLOT_H - (Math.max(0, Math.min(v, max)) / max) * (PLOT_H - 6) - 3;

  const hasData = series.some((s) => s.values.some((v) => v !== null && v !== undefined));

  return (
    <ChartFrame title={title} subtitle={subtitle} dates={dates} series={series} format={format}>
      {({ hovered, setHovered }) => (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-24 overflow-visible"
          role="img"
          aria-label={`${title}. ${hasData ? 'Use the table view for exact values.' : 'No data in this period.'}`}
        >
          <line x1={0} y1={PLOT_H} x2={WIDTH} y2={PLOT_H} stroke="var(--viz-axis)" strokeWidth={1} />

          {series.map((s) => {
            // Each run of consecutive non-null points is its own path.
            const runs: { i: number; v: number }[][] = [];
            let current: { i: number; v: number }[] = [];
            s.values.forEach((v, i) => {
              if (v === null || v === undefined) {
                if (current.length) runs.push(current);
                current = [];
              } else {
                current.push({ i, v });
              }
            });
            if (current.length) runs.push(current);

            const last = runs.at(-1)?.at(-1);

            return (
              <g key={s.key}>
                {runs.map((run, ri) => {
                  const line = run.map((p) => `${xOf(p.i)},${yOf(p.v)}`).join(' ');
                  const areaPath =
                    run.length > 1
                      ? `M ${xOf(run[0]!.i)},${PLOT_H} L ${run
                          .map((p) => `${xOf(p.i)},${yOf(p.v)}`)
                          .join(' L ')} L ${xOf(run.at(-1)!.i)},${PLOT_H} Z`
                      : null;

                  return (
                    <g key={ri}>
                      {areaPath && (
                        <path d={areaPath} fill={`var(${s.colorVar})`} opacity={0.1} />
                      )}
                      <polyline
                        points={line}
                        fill="none"
                        stroke={`var(${s.colorVar})`}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}

                {last && (
                  <circle
                    cx={xOf(last.i)}
                    cy={yOf(last.v)}
                    r={4}
                    fill={`var(${s.colorVar})`}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {/* Crosshair on hover, plus a marker on each series at that bucket. */}
          {hovered !== null && (
            <g pointerEvents="none">
              <line
                x1={xOf(hovered)}
                y1={0}
                x2={xOf(hovered)}
                y2={PLOT_H}
                stroke="var(--viz-axis)"
                strokeWidth={1}
              />
              {series.map((s) => {
                const v = s.values[hovered];
                if (v === null || v === undefined) return null;
                return (
                  <circle
                    key={s.key}
                    cx={xOf(hovered)}
                    cy={yOf(v)}
                    r={4}
                    fill={`var(${s.colorVar})`}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}

          {dates.map((date, i) => (
            <rect
              key={date}
              x={xOf(i) - step / 2}
              y={0}
              width={step}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {[0, Math.floor(buckets / 2), buckets - 1].map((i) =>
            dates[i] ? (
              <text
                key={i}
                x={xOf(i)}
                y={HEIGHT - 4}
                textAnchor={i === 0 ? 'start' : i === buckets - 1 ? 'end' : 'middle'}
                fontSize={9}
                fill="currentColor"
                className="text-muted-foreground"
              >
                {shortDate(dates[i])}
              </text>
            ) : null
          )}
        </svg>
      )}
    </ChartFrame>
  );
};
