import React from "react";

export type MetricColor = "blue" | "emerald" | "amber" | "indigo" | "violet" | "rose" | "teal";

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: MetricColor;
  trend?: {
    value: number;
    label?: string;
  };
}

const COLOR_MAP: Record<MetricColor, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-500" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-500" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-500" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-500" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-500" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-500" },
};

/**
 * Key performance indicator card presenting aggregate totals, trend comparisons, and thematic icons.
 *
 * @param {MetricCardProps} props - Metric configuration properties.
 * @returns {React.JSX.Element} Rendered stat container.
 */
export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
  trend,
}: MetricCardProps): React.JSX.Element {
  const colorStyles = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-2xs hover:border-border-hover transition-colors">
      <div className={`w-10 h-10 rounded-lg ${colorStyles.bg} ${colorStyles.text} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-text-muted truncate">{title}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-xl font-bold text-text tabular-nums truncate">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {trend && (
            <span
              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                trend.value >= 0
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[10px] text-text-muted mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
