"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { updateSite } from "@/actions/sites";
import { NavigationManager } from "@/components/admin/NavigationManager";
import { Compass } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/routing";

/**
 * Configuration properties for the NavigationSettingsClient component.
 */
export interface NavigationSettingsClientProps {
  /** Target site entity with navigation links. */
  site: {
    id: string;
    navLinks?: string | null;
    navAlignment?: "left" | "center" | "right" | null;
  };
  /** Catalog of published custom pages available for navigation selection. */
  availablePages?: Array<{ id: string; title: string; slug: string; locale?: string }>;
}

/**
 * Administrative settings view for configuring the main website navigation menu links and alignment.
 *
 * @param props - NavigationSettingsClientProps configuring site navigation links.
 * @returns React JSX navigation settings view.
 */
export function NavigationSettingsClient({ site, availablePages = [] }: NavigationSettingsClientProps) {
  const t = useTranslations("settings");
  const toast = useToast();
  const router = useRouter();

  async function handleSave(navLinks: string, navAlignment: "left" | "center" | "right"): Promise<boolean> {
    const res = await updateSite(site.id, {
      navLinks,
      navAlignment,
    });

    if (res.success) {
      toast.success(t("saveSuccess"));
      router.refresh();
      return true;
    } else {
      toast.error(t("saveError"));
      return false;
    }
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <Compass className="w-5 h-5 text-accent" />
          <span>{t("navigation")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("navigationDesc")}</p>
      </div>

      <NavigationManager
        initialLinks={site.navLinks}
        initialAlignment={site.navAlignment}
        availablePages={availablePages}
        onSave={handleSave}
      />
    </div>
  );
}
