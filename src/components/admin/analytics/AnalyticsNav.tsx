"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui/Tabs";
import {
  LayoutDashboard,
  Files,
  Users,
  Share2,
  Zap,
  Radio,
  Link2,
  GitCompare,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "navOverview", href: "/admin/analytics", icon: LayoutDashboard, exact: true },
  { key: "navPages", href: "/admin/analytics/pages", icon: Files },
  { key: "navVisitors", href: "/admin/analytics/visitors", icon: Users },
  { key: "navSources", href: "/admin/analytics/sources", icon: Share2 },
  { key: "navPerformance", href: "/admin/analytics/performance", icon: Zap },
  { key: "navRealtime", href: "/admin/analytics/realtime", icon: Radio },
  { key: "navLinks", href: "/admin/analytics/links", icon: Link2 },
  { key: "navCompare", href: "/admin/analytics/compare", icon: GitCompare },
  { key: "navRetention", href: "/admin/analytics/retention", icon: RotateCcw },
  { key: "navSegments", href: "/admin/analytics/segments", icon: SlidersHorizontal },
];

/**
 * Top-level secondary navigation bar for transitioning between analytics sub-pages while maintaining query parameters.
 */
export function AnalyticsNav(): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams ?? new URLSearchParams();
  const router = useRouter();
  const t = useTranslations("analytics");

  const queryString = query.toString();
  const suffix = queryString ? `?${queryString}` : "";

  const activeItem = NAV_ITEMS.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <nav aria-label={t("navAriaLabel")} className="w-full border-b border-border bg-surface">
      <div className="px-1 py-1.5 sm:px-2">
        <Tabs
          variant="pills"
          ariaLabel={t("navAriaLabel")}
          activeKey={activeItem?.href || ""}
          onSelect={(href) => router.push(`${href}${suffix}`)}
          items={NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem?.href === item.href;
            return {
              key: item.href,
              label: t(item.key),
              icon: <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-accent" : "text-text-muted"}`} />,
            };
          })}
        />
      </div>
    </nav>
  );
}
