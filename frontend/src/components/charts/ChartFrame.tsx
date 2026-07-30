import { useId, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { shortDate } from './series';
import type { Series } from './series';

export interface ChartFrameProps {
  title: string;
  subtitle?: string;
  dates: string[];
  series: Series[];
  /** Formats a value for the tooltip and table. */
  format?: (value: number) => string;
  children: (ctx: { hovered: number | null; setHovered: (i: number | null) => void }) => React.ReactNode;
}

const defaultFormat = (v: number) => v.toLocaleString();

/**
 * Shared chrome for every chart on the agent dashboard: title, legend, the
 * hovered-bucket tooltip, and a table view. The table is the relief for series
 * colors that sit below 3:1 on the light surface, so it is always reachable.
 */
export const ChartFrame = ({
  title,
  subtitle,
  dates,
  series,
  format = defaultFormat,
  children,
}: ChartFrameProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <section className="bg-background border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title={showTable ? 'Show chart' : 'Show data table'}
        >
          {showTable ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
          <span className="sr-only">{showTable ? 'Show chart' : 'Show data table'}</span>
        </button>
      </div>

      {/* A legend is present whenever identity is carried by more than one color. */}
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: `var(${s.colorVar})` }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {showTable ? (
        <div id={tableId} className="max-h-60 overflow-auto">
          <table className="w-full text-xs tabular-nums">
            <caption className="sr-only">{title} — data table</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="text-left font-medium py-1 pr-3">Date</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="text-right font-medium py-1 px-2">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date, i) => (
                <tr key={date} className="border-t border-border">
                  <th scope="row" className="text-left font-normal py-1 pr-3">{shortDate(date)}</th>
                  {series.map((s) => (
                    <td key={s.key} className="text-right py-1 px-2">
                      {s.values[i] === null || s.values[i] === undefined
                        ? '—'
                        : format(s.values[i] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {children({ hovered, setHovered })}

          {hovered !== null && dates[hovered] && (
            <div
              role="status"
              className="absolute top-0 right-0 pointer-events-none z-10 rounded-md border border-border bg-background px-2 py-1.5 shadow-md text-xs"
            >
              <div className="font-medium mb-0.5">{shortDate(dates[hovered])}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: `var(${s.colorVar})` }}
                  />
                  <span>{s.label}</span>
                  <span className="ml-auto pl-2 text-foreground tabular-nums">
                    {s.values[hovered] === null || s.values[hovered] === undefined
                      ? '—'
                      : format(s.values[hovered] as number)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
