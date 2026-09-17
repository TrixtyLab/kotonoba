import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { sql, desc, eq, and, like } from "drizzle-orm";
import { Link2, MousePointerClick, QrCode, ExternalLink, Tag } from "lucide-react";
import { getDubAnalyticsSummary } from "@/lib/dub";
import { PixelGeneratorCard } from "@/components/admin/analytics/PixelGeneratorCard";
import { DataTable, ColumnDef } from "@/components/admin/analytics/DataTable";

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface PixelHitRow {
  campaign: string;
  impressions: number;
  uniqueReaders: number;
  lastSeen: string;
}

/**
 * Campaign acquisition and external reach view managing Dub.co shortlinks and generating 1x1 tracking pixel tags.
 *
 * @param {PageProps} props - Route parameters with active locale code.
 * @returns {Promise<React.JSX.Element>} Rendered links and tracking pixel dashboard.
 */
export default async function AnalyticsLinksPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  const site = await getActiveSite();
  if (!site) notFound();

  const dubSummary = await getDubAnalyticsSummary(site.id);
  const db = getDb();

  // Query recorded pixel hits
  const rawPixelHits = db
    .select({
      campaign: sql<string>`coalesce(nullif(utm_campaign, ''), replace(path, '/pixel/', ''))`,
      impressions: sql<number>`count(*)`,
      uniqueReaders: sql<number>`count(distinct ip_hash)`,
      lastHitEpoch: sql<number>`max(created_at)`,
    })
    .from(analytics)
    .where(and(eq(analytics.siteId, site.id), like(analytics.path, "/pixel/%")))
    .groupBy(sql`coalesce(nullif(utm_campaign, ''), replace(path, '/pixel/', ''))`)
    .orderBy(desc(sql`count(*)`))
    .all();

  const pixelData: PixelHitRow[] = rawPixelHits.map((p) => {
    const d = new Date(p.lastHitEpoch);
    return {
      campaign: p.campaign,
      impressions: p.impressions,
      uniqueReaders: p.uniqueReaders,
      lastSeen: !isNaN(d.getTime()) ? d.toLocaleDateString(locale) : "-",
    };
  });

  const pixelColumns: ColumnDef<PixelHitRow>[] = [
    {
      key: "campaign",
      header: t("pixelName"),
      render: (row) => <span className="font-mono font-semibold text-text">{row.campaign}</span>,
    },
    {
      key: "impressions",
      header: t("impressions"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-text tabular-nums">{row.impressions.toLocaleString()}</span>,
    },
    {
      key: "uniqueReaders",
      header: t("visitors"),
      align: "right",
      render: (row) => <span className="font-mono text-text-muted tabular-nums">{row.uniqueReaders.toLocaleString()}</span>,
    },
    {
      key: "lastSeen",
      header: t("lastSeen"),
      align: "right",
      render: (row) => <span className="font-mono text-text-muted">{row.lastSeen}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tracking Pixels Section */}
      <div className="space-y-4">
        <PixelGeneratorCard siteId={site.id} domain={site.domain} />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-pink-500" />
            <h3 className="text-xs font-bold text-text">{t("recordedPixels")}</h3>
          </div>
          <DataTable
            columns={pixelColumns}
            data={pixelData}
            emptyMessage={t("noPixelImpressions")}
            rowKey={(r) => r.campaign}
          />
        </div>
      </div>

      {/* Dub.co Links Section */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text">{t("dubAnalytics")}</h3>
              <p className="text-[11px] text-text-muted">{t("dubSubtitle")}</p>
            </div>
          </div>
          {dubSummary.isConfigured && (
            <a
              href={`https://app.dub.co`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <span>{t("dubViewInDub")}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {!dubSummary.isConfigured ? (
          <div className="p-4 rounded-lg bg-bg border border-border text-center space-y-1.5">
            <p className="text-xs font-semibold text-text">{t("dubNotConfigured")}</p>
            <p className="text-[11px] text-text-muted max-w-md mx-auto">{t("dubConfigureHint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-bg border border-border rounded-lg">
                <span className="text-[11px] text-text-muted">{t("dubTotalClicks")}</span>
                <p className="text-xl font-bold text-text tabular-nums mt-0.5">{dubSummary.totalClicks.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-bg border border-border rounded-lg">
                <span className="text-[11px] text-text-muted">{t("dubTrackedLinks")}</span>
                <p className="text-xl font-bold text-text tabular-nums mt-0.5">{dubSummary.totalLinks.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-bg border border-border rounded-lg">
                <span className="text-[11px] text-text-muted">{t("dubTopLink")}</span>
                <p className="text-sm font-bold text-text truncate mt-0.5">
                  {dubSummary.topLink ? `${dubSummary.topLink.key} (${dubSummary.topLink.clicks} ${t("dubClicks")})` : "-"}
                </p>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {dubSummary.links.length > 0 ? (
                dubSummary.links.map((link) => (
                  <div key={link.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={link.shortLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-accent hover:underline flex items-center gap-1 truncate"
                      >
                        <span>{link.shortLink}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                      </a>
                      <p className="text-[10px] text-text-muted truncate mt-0.5">{link.url}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-mono font-bold text-text tabular-nums">{link.clicks.toLocaleString()}</span>
                        <span className="text-[10px] text-text-muted ml-1">{t("dubClicks")}</span>
                      </div>
                      {link.qrCode && (
                        <a
                          href={link.qrCode}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-text-muted hover:text-accent transition-colors"
                          title={t("dubQrCode")}
                        >
                          <QrCode className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-text-muted italic">{t("dubNoLinksYet")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
