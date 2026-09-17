"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X, Filter, RotateCcw } from "lucide-react";
import { CountryFlag } from "@/components/ui/CountryFlag";

const FILTER_KEYS = ["country", "browser", "device", "os", "campaign"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

/**
 * Filter badge container displaying active telemetry filters and enabling rapid removal or clearance.
 *
 * @returns {React.JSX.Element | null} Badge bar or null if no filters are active.
 */
export function FilterBar(): React.JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("analytics");

  const activeFilters: { key: FilterKey; value: string }[] = [];
  for (const key of FILTER_KEYS) {
    const val = searchParams.get(key);
    if (val) {
      activeFilters.push({ key, value: val });
    }
  }

  if (activeFilters.length === 0) {
    return null;
  }

  const removeFilter = (key: FilterKey): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const clearAllFilters = (): void => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 px-3 bg-accent/5 border border-accent/20 rounded-xl text-xs">
      <div className="flex items-center gap-1.5 text-accent font-semibold shrink-0">
        <Filter className="w-3.5 h-3.5" />
        <span>{t("activeFilters")}:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {activeFilters.map((f) => (
          <span
            key={f.key}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-surface border border-accent/30 text-text font-medium text-[11px] shadow-2xs"
          >
            <span className="text-text-muted capitalize">{f.key}:</span>
            <span className="font-semibold inline-flex items-center gap-1">
              {f.key === "country" && <CountryFlag code={f.value} size="xs" />}
              <span>{f.value}</span>
            </span>
            <button
              type="button"
              onClick={() => removeFilter(f.key)}
              className="p-0.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
              title={t("removeFilter")}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={clearAllFilters}
        className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-danger font-medium transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        <span>{t("clearFilters")}</span>
      </button>
    </div>
  );
}
