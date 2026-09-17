"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, Plus, Trash2, CheckCircle, ArrowRight } from "lucide-react";
import { createSegmentAction, deleteSegmentAction } from "@/actions/analytics";

export interface SegmentItem {
  id: string;
  name: string;
  filters: string;
  createdAt: number;
}

interface SegmentsManagerClientProps {
  siteId: string;
  initialSegments: SegmentItem[];
}

/**
 * Interactive segments management interface allowing creation, application, and deletion of custom analytics filter combinations.
 *
 * @param {SegmentsManagerClientProps} props - Target site ID and initial segment definitions.
 * @returns {React.JSX.Element} Interactive segment control component.
 */
export function SegmentsManagerClient({
  siteId,
  initialSegments,
}: SegmentsManagerClientProps): React.JSX.Element {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [segments, setSegments] = useState<SegmentItem[]>(initialSegments);
  const [name, setName] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Extract current filters from searchParams
  const activeFilters: Record<string, string> = {};
  for (const key of ["country", "browser", "device", "os"]) {
    const val = searchParams.get(key);
    if (val) activeFilters[key] = val;
  }
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setFeedback(null);
    try {
      const filtersJson = JSON.stringify(activeFilters);
      const res = await createSegmentAction({
        siteId,
        name: name.trim(),
        filtersJson,
      });

      if (res.success && res.data) {
        setSegments([
          {
            id: res.data.id,
            name: name.trim(),
            filters: filtersJson,
            createdAt: Date.now(),
          },
          ...segments,
        ]);
        setName("");
        setFeedback({ type: "success", message: t("segmentSaved") });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        const errorMsg = !res.success ? res.error : t("segmentSaveError");
        setFeedback({ type: "error", message: errorMsg });
      }
    } catch {
      setFeedback({ type: "error", message: t("segmentSaveError") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      const res = await deleteSegmentAction(id);
      if (res.success) {
        setSegments(segments.filter((s) => s.id !== id));
      }
    } catch {
      // Ignore deletion network errors
    }
  };

  const handleApply = (filtersJson: string): void => {
    try {
      const parsed = JSON.parse(filtersJson || "{}") as Record<string, string>;
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(parsed)) {
        if (v) params.set(k, v);
      }
      const qs = params.toString();
      router.push(qs ? `/admin/analytics?${qs}` : "/admin/analytics");
    } catch {
      router.push("/admin/analytics");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Segment Card */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <SlidersHorizontal className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-bold text-text">{t("saveSegment")}</h3>
        </div>

        {hasActiveFilters ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-bg rounded-lg border border-border text-xs">
              <span className="font-semibold text-text-muted">{t("activeFilters")}:</span>
              {Object.entries(activeFilters).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded bg-surface border border-border text-text font-mono text-[11px]">
                  {k}: <span className="font-bold">{v}</span>
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("segmentNamePlaceholder")}
                className="w-full sm:w-80 px-3 py-1.5 text-xs rounded-lg bg-bg border border-border text-text focus:outline-hidden focus:border-accent"
                required
              />
              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="w-full sm:w-auto px-4 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSaving ? tc("saving") : t("saveBtn")}</span>
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-text-muted italic">
            {t("noActiveFiltersHint")}
          </p>
        )}

        {feedback && (
          <p
            className={`text-xs font-medium ${
              feedback.type === "success" ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>

      {/* Saved Segments List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-text">{t("segmentsTitle")}</h3>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-2xs">
          {segments.length > 0 ? (
            segments.map((seg) => {
              let parsedFilters: Record<string, string> = {};
              try {
                parsedFilters = JSON.parse(seg.filters || "{}");
              } catch {
                parsedFilters = {};
              }

              return (
                <div key={seg.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/30 transition-colors">
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-text">{seg.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {Object.entries(parsedFilters).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-bg border border-border text-text-muted font-mono text-[11px]">
                          {k}: <span className="font-semibold text-text">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleApply(seg.filters)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-border hover:border-accent hover:text-accent transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span>{t("applySegment")}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(seg.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title={t("deleteSegment")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-10 text-center text-xs text-text-muted italic">{t("noSegments")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
