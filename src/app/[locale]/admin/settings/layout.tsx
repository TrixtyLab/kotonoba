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
 * Layout shell for administrative settings providing categorical navigation tabs for general, branding, navigation, banners, storage, SEO, integrations, AI, and backups.
 *
 * @param props - Object containing children elements.
 * @returns React JSX settings navigation shell.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <h1 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-accent" />
          <span>{t("title")}</span>
        </h1>
        <p className="text-xs text-text-muted mt-1 max-w-2xl">
          {t("subtitle")}
        </p>
      </div>

      {/* 2-Column Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-1 bg-surface border border-border rounded-xl p-2 shadow-xs sticky top-20">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href || (tab.href === "/admin/settings/general" && pathname === "/admin/settings");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-accent/10 text-accent border border-accent/20 shadow-xs"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-accent" : "text-text-muted"}`} />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-9 bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-xs">
          {children}
        </div>
      </div>
    </div>
  );
}
