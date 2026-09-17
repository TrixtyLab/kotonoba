"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Radio, Users, Eye, Globe, Monitor, Clock } from "lucide-react";
import { getRealtimeFeedAction, RealtimeDataResponse } from "@/actions/analytics";
import { CountryFlag, getCountryName } from "@/components/ui/CountryFlag";

interface RealtimeFeedClientProps {
  siteId: string;
  initialData: RealtimeDataResponse;
}

/**
 * Formats a UNIX millisecond timestamp into a localized relative duration (e.g., '12s ago', '2m ago').
 *
 * @param {number} timestamp - Epoch timestamp in milliseconds.
 * @param {(key: string, values?: Record<string, string | number>) => string} t - Translation resolver function.
 * @returns {string} Human-friendly relative time label.
 */
function formatRelativeTime(
  timestamp: number,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diff < 15) return t("justNow");
  if (diff < 60) return t("secondsAgo", { seconds: diff });
  const m = Math.floor(diff / 60);
  if (m < 60) return t("minutesAgo", { minutes: m });
  const h = Math.floor(m / 60);
  return t("hoursAgo", { hours: h });
}

/**
 * Interactive client-side live activity feed polling every 10 seconds for real-time visitor pulses.
 *
 * @param {RealtimeFeedClientProps} props - Initial telemetry snapshot and target site identifier.
 * @returns {React.JSX.Element} Auto-refreshing realtime dashboard stream.
 */
export function RealtimeFeedClient({ siteId, initialData }: RealtimeFeedClientProps): React.JSX.Element {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const [data, setData] = useState<RealtimeDataResponse>(initialData);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        setIsRefreshing(true);
        const res = await getRealtimeFeedAction(siteId);
        if (res.success && res.data) {
          setData(res.data);
        }
      } catch {
        // Silently catch polling failures
      } finally {
        setIsRefreshing(false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [siteId]);

  return (
    <div className="space-y-6">
      {/* Live Active Header Banner */}
      <div className="p-5 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-muted">{t("activeVisitorsNow")}</p>
            <p className="text-3xl font-extrabold text-text tabular-nums mt-0.5">
              {data.activeVisitorsNow.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono bg-surface-hover/80 px-3 py-1.5 rounded-lg w-fit">
          <span className={`w-2 h-2 rounded-full ${isRefreshing ? "bg-amber-500 animate-spin" : "bg-emerald-500"}`} />
          <span>{isRefreshing ? t("syncing") : t("liveAutoRefresh")}</span>
        </div>
      </div>

      {/* Currently Active Pages & Activity Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Pages */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Eye className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold text-text">{t("currentlyActivePages")}</h3>
          </div>
          <div className="divide-y divide-border/60">
            {data.activePages.length > 0 ? (
              data.activePages.map((p) => (
                <div key={p.path} className="py-2.5 flex items-center justify-between text-xs gap-2">
                  <span className="font-mono text-text truncate max-w-[75%]" title={p.path}>
                    {p.path}
                  </span>
                  <span className="font-mono font-bold text-emerald-500 tabular-nums shrink-0">
                    {p.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-text-muted italic">{t("noTrafficYet")}</p>
            )}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-500" />
              <h3 className="text-xs font-bold text-text">{t("liveActivity")}</h3>
            </div>
            <span className="text-[11px] font-mono text-text-muted">
              {data.recentHits.length} {tc("events")}
            </span>
          </div>

          <div className="divide-y divide-border/60 overflow-x-auto">
            {data.recentHits.length > 0 ? (
              data.recentHits.map((hit) => (
                <div key={hit.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-muted shrink-0 w-16">
                      {formatRelativeTime(hit.createdAt, t)}
                    </span>
                    <span className="font-mono font-medium text-text truncate max-w-xs" title={hit.path}>
                      {hit.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono shrink-0">
                    {(() => {
                      const isKnown = Boolean(hit.country && /^[A-Za-z]{2}$/.test(hit.country));
                      const englishName = isKnown ? getCountryName(hit.country, "en") : (hit.country || "Global / Unknown");

                      return (
                        <span
                          className="flex items-center gap-1.5 cursor-help select-none"
                          title={englishName}
                        >
                          <CountryFlag code={hit.country} size="xs" title={englishName} />
                          <span>{hit.country || "Global"}</span>
                        </span>
                      );
                    })()}
                    <span className="hidden sm:inline opacity-40">•</span>
                    <span className="hidden sm:flex items-center gap-1">
                      <Monitor className="w-3 h-3 opacity-60" />
                      {hit.browser || "Browser"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-text-muted italic">{t("noTrafficYet")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
