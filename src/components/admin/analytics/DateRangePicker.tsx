"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";

export type DateRangePreset = "24h" | "7d" | "30d" | "90d" | "all";

interface RangeOption {
  key: DateRangePreset;
  labelKey: string;
}

const RANGE_OPTIONS: RangeOption[] = [
  { key: "24h", labelKey: "range24h" },
  { key: "7d", labelKey: "range7d" },
  { key: "30d", labelKey: "range30d" },
  { key: "90d", labelKey: "range90d" },
  { key: "all", labelKey: "rangeAll" },
];

/**
 * Filter selector modifying date bounds via URL query parameters for persistent state synchronization.
 *
 * @returns {React.JSX.Element} Compact responsive date range switcher.
 */
export function DateRangePicker(): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("analytics");

  const currentRange = (searchParams.get("range") as DateRangePreset) || "30d";

  const handleSelect = (preset: DateRangePreset): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (preset === "30d") {
      params.delete("range");
    } else {
      params.set("range", preset);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl shadow-2xs">
      <div className="hidden sm:flex items-center pl-2 pr-1 text-text-muted">
        <Calendar className="w-3.5 h-3.5" />
      </div>
      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
        {RANGE_OPTIONS.map((opt) => {
          const isSelected = currentRange === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelect(opt.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                isSelected
                  ? "bg-accent text-white shadow-2xs"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/80"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
