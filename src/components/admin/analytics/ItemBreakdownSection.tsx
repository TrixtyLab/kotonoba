import React from "react";
import { getTranslations } from "next-intl/server";
import { Globe, Smartphone, Laptop, Tablet, Share2, Tag, Layers, Clock, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { CountryFlag, getCountryName } from "@/components/ui/CountryFlag";
import { cleanReferrerDomain, type ItemAnalyticsReport } from "@/lib/queries/analytics";

interface ItemBreakdownSectionProps {
  report: ItemAnalyticsReport;
  locale: string;
}

/**
 * Displays UTM attribution, visitor activity logs, referrer domains, devices, browsers, and country distribution.
 */
export async function ItemBreakdownSection({ report, locale }: ItemBreakdownSectionProps) {
  const t = await getTranslations({ locale, namespace: "analytics" });
  const tc = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5 text-accent" />
              <span>{t("utmSources")}</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              {report.utmSources.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text font-medium flex items-center gap-1.5 truncate max-w-[160px]">
                    <Tag className="w-3 h-3 text-accent" />
                    {s.source}
                  </span>
                  <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                    {s.count}
                  </span>
                </div>
              ))}
              {report.utmSources.length === 0 && <p className="text-xs text-text-muted py-2">{t("noUtmSources")}</p>}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t("utmCampaignsHeader")}</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              {report.utmCampaigns.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text font-medium truncate max-w-[160px]">{c.campaign}</span>
                  <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                    {c.count}
                  </span>
                </div>
              ))}
              {report.utmCampaigns.length === 0 && (
                <p className="text-xs text-text-muted py-2">{t("noUtmCampaigns")}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <span>{t("recentVisitsLog")}</span>
            </h3>
            <span className="text-xs font-mono text-text-muted">
              {report.recentLogs.length} {tc("logs")}
            </span>
          </div>

          <div className="divide-y divide-border/60 text-xs">
            {report.recentLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 text-text font-medium">
                    <span className="capitalize">{log.device || "desktop"}</span>
                    <span>•</span>
                    <span>{log.browser || "Browser"}</span>
                    {log.country && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-text-muted font-mono">
                          <CountryFlag code={log.country} locale={locale} size="xs" />
                          <span>{log.country}</span>
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted truncate">
                    {log.referrer ? cleanReferrerDomain(log.referrer) : tc("direct")}
                    {log.utmSource ? ` (utm_source: ${log.utmSource})` : ""}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-text-muted shrink-0">
                  {log.createdAt ? formatDate(log.createdAt, locale) : ""}
                </span>
              </div>
            ))}

            {report.recentLogs.length === 0 && (
              <p className="text-xs text-text-muted py-6 text-center">{t("noTrafficYet")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-4 space-y-5">
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
            <ArrowLeft className="w-3.5 h-3.5 text-accent rotate-135" />
            <span>{t("referrers")}</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            {report.topReferrers.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-text truncate max-w-[170px] font-medium">{r.domain}</span>
                <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                  {r.count}
                </span>
              </div>
            ))}
            {report.topReferrers.length === 0 && <p className="text-xs text-text-muted py-1.5">{t("noReferrers")}</p>}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
            <Laptop className="w-3.5 h-3.5 text-accent" />
            <span>{t("devicesAndBrowsers")}</span>
          </h3>

          <div className="space-y-2 text-xs">
            {report.deviceStats.map((d, i) => {
              const pct = Math.round((d.count / report.totalDevicesCount) * 100);
              const Icon = d.device === "mobile" ? Smartphone : d.device === "tablet" ? Tablet : Laptop;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-text">
                    <span className="capitalize flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-text-muted" />
                      {d.device === "mobile" ? t("mobile") : d.device === "tablet" ? t("tablet") : t("desktop")}
                    </span>
                    <span className="font-mono text-text-muted">{pct}% ({d.count})</span>
                  </div>
                  <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                    <div className="h-full bg-accent/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {report.deviceStats.length === 0 && <p className="text-xs text-text-muted py-1">{t("noDevices")}</p>}
          </div>

          {report.browserStats.length > 0 && (
            <div className="pt-2 border-t border-border space-y-1.5 text-xs">
              <p className="text-[11px] font-semibold text-text-muted">{t("topBrowsers")}</p>
              <div className="flex flex-wrap gap-1.5">
                {report.browserStats.map((b, i) => {
                  const browserLabel = b.browser === "Other" || !b.browser ? t("otherBrowser") : b.browser;
                  return (
                    <span key={i} className="text-[11px] bg-surface-hover px-2 py-0.5 rounded border border-border text-text">
                      {browserLabel}: <span className="font-mono text-text-muted">{b.count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-accent" />
            <span>{t("geoDistribution")}</span>
          </h3>
          <div className="space-y-2 text-xs">
            {report.topCountries.map((c, i) => {
              const isKnown = Boolean(c.country && c.country !== t("globalUnknown"));
              const countryName = isKnown ? getCountryName(c.country, locale) : c.country || t("globalUnknown");
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CountryFlag code={c.country} locale={locale} />
                    <span className="text-text truncate">{countryName}</span>
                    {isKnown && <span className="font-mono text-[10px] text-text-muted shrink-0">{c.country}</span>}
                  </div>
                  <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px] shrink-0">
                    {c.count}
                  </span>
                </div>
              );
            })}
            {report.topCountries.length === 0 && <p className="text-xs text-text-muted py-1.5">{t("noGeo")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
