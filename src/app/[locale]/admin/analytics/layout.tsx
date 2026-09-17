import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { DateRangePicker } from "@/components/admin/analytics/DateRangePicker";
import { FilterBar } from "@/components/admin/analytics/FilterBar";
import { ResetAnalyticsButton } from "@/components/admin/analytics/ResetAnalyticsButton";

/**
 * Common layout envelope for administrative analytics, providing unified header controls,
 * date boundary pickers, active filter chips, and primary section tab navigation.
 *
 * @param {Object} props - Component properties.
 * @param {React.ReactNode} props.children - Sub-route page view content.
 * @param {Promise<{ locale: string }>} props.params - Promise resolving to active locale code.
 * @returns {Promise<React.JSX.Element>} Rendered analytics layout frame.
 */
export default async function AnalyticsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  const site = await getActiveSite();
  if (!site) notFound();

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 shadow-2xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
              {t("title")}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {t("subtitle", { site: site.name })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <ResetAnalyticsButton siteId={site.id} />
        </div>
      </div>

      {/* Persistent Filters Bar */}
      <FilterBar />

      {/* Sub-page Navigation Tabs */}
      <AnalyticsNav />

      {/* Active Sub-Route Page Content */}
      <div className="pt-1">{children}</div>
    </div>
  );
}
