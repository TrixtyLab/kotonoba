import React from "react";

export interface BarChartItem {
  label: string;
  value: number;
  secondaryLabel?: string;
  percentage?: number;
  color?: string;
  href?: string;
}

export interface BarChartProps {
  items: BarChartItem[];
  orientation?: "vertical" | "horizontal";
  height?: number | string;
  emptyMessage?: string;
  valueFormatter?: (val: number) => string;
}

/**
 * Pure CSS responsive chart visualizing quantitative distributions horizontally or chronologically vertically.
 *
 * @param {BarChartProps} props - Data items and rendering orientation parameters.
 * @returns {React.JSX.Element} Interactive CSS-driven bar graph.
 */
export function BarChart({
  items,
  orientation = "vertical",
  height = 160,
  emptyMessage = "No data available",
  valueFormatter = (val: number) => val.toLocaleString(),
}: BarChartProps): React.JSX.Element {
  if (!items || items.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center text-xs text-text-muted italic border border-dashed border-border rounded-xl"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const maxValue = Math.max(...items.map((i) => i.value), 1);

  if (orientation === "horizontal") {
    return (
      <div className="space-y-2.5 w-full">
        {items.map((item, idx) => {
          const pct = item.percentage ?? Math.round((item.value / maxValue) * 100);
          const content = (
            <div className="group space-y-1 block select-none">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-medium truncate max-w-[65%] ${
                    item.href ? "text-text group-hover:text-accent group-hover:underline" : "text-text"
                  }`}
                  title={item.label}
                >
                  {item.label}
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted shrink-0">
                  {item.secondaryLabel && <span>{item.secondaryLabel}</span>}
                  <span className="font-semibold text-text tabular-nums">{valueFormatter(item.value)}</span>
                  <span className="text-[10px] w-8 text-right opacity-70">({pct}%)</span>
                </div>
              </div>
              <div className="h-2 w-full bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 group-hover:opacity-80"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: item.color || "var(--color-accent)",
                  }}
                />
              </div>
            </div>
          );

          if (item.href) {
            return (
              <a key={idx} href={item.href} className="block cursor-pointer">
                {content}
              </a>
            );
          }
          return <div key={idx}>{content}</div>;
        })}
      </div>
    );
  }

  // Vertical timeline bars
  return (
    <div className="w-full pt-4 pb-2" style={{ minHeight: height }}>
      <div
        className="grid gap-1 sm:gap-2 items-end w-full"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          height: typeof height === "number" ? `${height}px` : height,
        }}
      >
        {items.map((item, idx) => {
          const heightPct = Math.round((item.value / maxValue) * 100);
          return (
            <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
              <span className="text-[10px] font-mono text-text-muted opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                {valueFormatter(item.value)}
              </span>
              <div className="w-full bg-surface-hover/80 rounded-t-md relative flex items-end h-full overflow-hidden">
                <div
                  className="w-full bg-accent hover:bg-accent/80 transition-all rounded-t-md"
                  style={{
                    height: `${Math.max(item.value > 0 ? 8 : 2, heightPct)}%`,
                    backgroundColor: item.color || undefined,
                  }}
                  title={`${item.label}: ${valueFormatter(item.value)}`}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-text-muted truncate w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
