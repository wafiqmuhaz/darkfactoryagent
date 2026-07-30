import { ChartFrame } from './ChartFrame';
import { shortDate } from './series';
import type { Series } from './series';

const WIDTH = 320;
const HEIGHT = 96;
const PAD_BOTTOM = 16;
const PLOT_H = HEIGHT - PAD_BOTTOM;
/** Surface-colored gap between adjacent columns — white does the separating. */
const GAP = 2;
const MAX_BAR = 24;

interface BarChartProps {
  title: string;
  subtitle?: string;
  dates: string[];
  series: Series[];
  /** Stack the series instead of drawing one column per series. */
  stacked?: boolean;
  format?: (value: number) => string;
}

/**
 * Column chart, single-series or stacked. Grows from one baseline; segments are
 * separated by a 2px surface gap, never by a stroke. Rounded cap on the top of
 * each column, square where it meets the baseline.
 */
export const BarChart = ({ title, subtitle, dates, series, stacked = true, format }: BarChartProps) => {
  const buckets = dates.length || 1;
  const slot = WIDTH / buckets;
  const barWidth = Math.min(slot - GAP, MAX_BAR);
  const offset = (slot - barWidth) / 2;

  const totals = dates.map((_, i) =>
    series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0)
  );
  const perSeriesMax = Math.max(
    ...series.flatMap((s) => s.values.map((v) => Math.max(0, v ?? 0))),
    0
  );
  const max = Math.max(stacked ? Math.max(...totals, 0) : perSeriesMax, 1);

  // Label only the tallest column; a value on every column reads as noise.
  const peak = totals.indexOf(Math.max(...totals));
  const hasData = totals.some((t) => t > 0);

  return (
    <ChartFrame title={title} subtitle={subtitle} dates={dates} series={series} format={format}>
      {({ hovered, setHovered }) => (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-24 overflow-visible"
          role="img"
          aria-label={`${title}. ${hasData ? 'Use the table view for exact values.' : 'No data in this period.'}`}
        >
          {/* Baseline — recessive, hairline, solid. */}
          <line
            x1={0}
            y1={PLOT_H}
            x2={WIDTH}
            y2={PLOT_H}
            stroke="var(--viz-axis)"
            strokeWidth={1}
          />

          {dates.map((date, i) => {
            let cursor = PLOT_H;
            const x = i * slot + offset;

            return (
              <g key={date}>
                {/* Hit target spans the whole slot, not just the drawn column. */}
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
                {series.map((s, si) => {
                  const value = Math.max(0, s.values[i] ?? 0);
                  if (value === 0) return null;

                  const h = (value / max) * (PLOT_H - 4);
                  if (stacked) {
                    const y = cursor - h;
                    cursor = y - GAP;
                    return (
                      <rect
                        key={s.key}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={h}
                        rx={si === series.length - 1 || cursor <= 0 ? 4 : 0}
                        fill={`var(${s.colorVar})`}
                        opacity={hovered === null || hovered === i ? 1 : 0.45}
                      />
                    );
                  }

                  const groupWidth = (barWidth - GAP * (series.length - 1)) / series.length;
                  return (
                    <rect
                      key={s.key}
                      x={x + si * (groupWidth + GAP)}
                      y={PLOT_H - h}
                      width={groupWidth}
                      height={h}
                      rx={4}
                      fill={`var(${s.colorVar})`}
                      opacity={hovered === null || hovered === i ? 1 : 0.45}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Direct label on the peak only, in ink — never in the series color. */}
          {hasData && (
            <text
              x={peak * slot + slot / 2}
              y={PLOT_H - (totals[peak]! / max) * (PLOT_H - 4) - 3}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              className="text-foreground"
            >
              {format ? format(totals[peak]!) : totals[peak]}
            </text>
          )}

          {/* First, middle, last tick — enough to orient without crowding. */}
          {[0, Math.floor(buckets / 2), buckets - 1].map((i) =>
            dates[i] ? (
              <text
                key={i}
                x={i * slot + slot / 2}
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
