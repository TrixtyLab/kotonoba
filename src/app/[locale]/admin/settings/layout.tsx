"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  Settings,
  Palette,
  Compass,
  HardDrive,
  Search,
  Sparkles,
  Archive,
  Share2,
  Image as ImageIcon,
} from "lucide-react";

/**
 * Properties for the SettingsLayout component.
 */
export interface SettingsLayoutProps {
  /** Nested settings view content. */
  children: React.ReactNode;
}

/**
 * Layout shell for administrative settings providing categorical navigation tabs for general, branding, navigation, banners, storage, SEO, integrations, AI, and backups.
 * Renders as a horizontally scrollable strip on mobile devices and a sticky sidebar on desktop screens.
 *
 * @param {SettingsLayoutProps} props - Component properties containing children.
 * @returns {React.JSX.Element} React JSX settings navigation shell.
 */
export default function SettingsLayout({
  children,
}: SettingsLayoutProps): React.JSX.Element {
  const t = useTranslations("settings");
  const pathname = usePathname();

  const navTabs = [
    { href: "/admin/settings/general", label: t("general"), icon: Settings, desc: t("generalDesc") },
    { href: "/admin/settings/branding", label: t("branding"), icon: Palette, desc: t("brandingDesc") },
    { href: "/admin/settings/navigation", label: t("navigation"), icon: Compass, desc: t("navigationDesc") },
    { href: "/admin/settings/banners", label: t("banners"), icon: ImageIcon, desc: t("bannersDesc") },
    { href: "/admin/settings/storage", label: t("storage"), icon: HardDrive, desc: t("storageDesc") },
    { href: "/admin/settings/seo", label: t("seo"), icon: Search, desc: t("seoDesc") },
    { href: "/admin/settings/integrations", label: t("integrations"), icon: Share2, desc: t("integrationsDesc") },
    { href: "/admin/settings/ai", label: t("ai"), icon: Sparkles, desc: t("aiDesc") },
    { href: "/admin/settings/backup", label: t("backup"), icon: Archive, desc: t("backupDesc") },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight flex items-center gap-2.5">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
          <span>{t("title")}</span>
        </h1>
        <p className="text-xs text-text-muted mt-1 max-w-2xl">
          {t("subtitle")}
        </p>
      </div>

      {/* 2-Column Settings Layout with responsive mobile scroll */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Navigation Tabs (Horizontal on mobile/tablet, vertical sticky on desktop) */}
        <div className="lg:col-span-3 flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 lg:gap-1 bg-surface border border-border rounded-xl p-1.5 sm:p-2 shadow-xs lg:sticky lg:top-20 no-scrollbar">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href || (tab.href === "/admin/settings/general" && pathname === "/admin/settings");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  isActive
                    ? "bg-accent/10 text-accent border border-accent/20 shadow-xs"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-accent" : "text-text-muted"}`} />
                <span className="whitespace-nowrap lg:whitespace-normal lg:truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-9 bg-surface border border-border rounded-xl p-4 sm:p-6 lg:p-8 shadow-xs">
          {children}
        </div>
      </div>
    </div>
  );
}
