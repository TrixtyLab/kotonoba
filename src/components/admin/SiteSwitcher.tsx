"use client";

import { useState } from "react";
import { Globe, ChevronDown, Check, Plus } from "lucide-react";
import { useRouter } from "@/i18n/routing";

export interface SiteOption {
  id: string;
  name: string;
  domain: string;
}

/**
 * Multi-tenant blog switcher dropdown for managing multiple blogs within the admin dashboard.
 */
export function SiteSwitcher({
  currentSite,
  allSites,
}: {
  currentSite: SiteOption;
  allSites: SiteOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Switch active blog"
        aria-expanded={isOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface/60 hover:bg-surface-hover transition-colors btn-press text-xs font-semibold text-text max-w-[200px]"
      >
        <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate">{currentSite.name}</span>
        <ChevronDown className="w-3 h-3 text-text-muted shrink-0 ml-auto" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-56 glass-strong rounded-lg shadow-2xl z-50 p-2 border border-border animate-slide-down">
            <p className="text-[10px] uppercase font-bold text-text-muted px-2 py-1 tracking-wider">
              Managed Blogs ({allSites.length})
            </p>
            <div className="space-y-1 my-1">
              {allSites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/admin?site=${s.id}`);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded hover:bg-surface-hover transition-colors text-text"
                >
                  <div className="truncate">
                    <p className="font-medium text-text truncate">{s.name}</p>
                    <p className="text-[10px] text-text-muted truncate">{s.domain}</p>
                  </div>
                  {currentSite.id === s.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
            <div className="pt-1 mt-1 border-t border-border/50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/admin/sites");
                }}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-primary font-medium hover:bg-primary/10 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manage & Add Sites</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
