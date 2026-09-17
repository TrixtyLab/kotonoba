"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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

interface NavItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
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
 * Top-level secondary navigation bar for transitioning between analytics sub-pages while maintaining active query parameters.
 *
 * @returns {React.JSX.Element} Responsive horizontal tab strip.
 */
export function AnalyticsNav(): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("analytics");

  const queryString = searchParams.toString();
  const suffix = queryString ? `?${queryString}` : "";

  return (
    <nav aria-label={t("navAriaLabel")} className="w-full border-b border-border bg-surface/50 backdrop-blur-xs">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-1 py-1.5 sm:px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(`${item.href}${suffix}`)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all select-none shrink-0 ${
                isActive
                  ? "bg-accent/10 text-accent font-bold shadow-2xs"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/80"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-accent" : "text-text-muted"}`} />
              <span>{t(item.key)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
