"use client";

import React, { useState, useEffect } from "react";
import { usePathname, Link } from "@/i18n/routing";
import {
  LayoutDashboard, FileText, Files, Image as ImageIcon, FolderTree, Tag, BarChart3,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen, ExternalLink, Users, ArrowUpCircle
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { checkForUpdates, type UpdateInfo } from "@/actions/updates";
import { useRouter } from "@/i18n/routing";
import { SiteSwitcher, type SiteOption } from "@/components/admin/SiteSwitcher";
import { useTranslations } from "next-intl";

/**
 * Properties configuring the admin Sidebar navigation column.
 */
export interface SidebarProps {
  /** Expanded or collapsed width toggle for desktop viewport. */
  isOpen: boolean;
  /** Visibility state of the off-canvas drawer on mobile devices. */
  isMobileOpen?: boolean;
  /** Callback fired to toggle sidebar collapse state on desktop. */
  onToggle: () => void;
  /** Callback fired to close mobile drawer on link selection or backdrop click. */
  onCloseMobile: () => void;
  /** Currently active workspace site. */
  currentSite: SiteOption;
  /** Catalog of all registered sites for multi-tenant switching. */
  allSites: SiteOption[];
  /** Flag indicating whether the caller can manage and create sites (super_admin). */
  canManageSites?: boolean;
}

/**
 * Derives the canonical HTTP/HTTPS origin URL for a given domain string.
 *
 * @param {string | null | undefined} domain - Configured domain hostname or origin.
 * @returns {string} Normalized absolute website URL.
 */
function getSitePublicUrl(domain?: string | null): string {
  if (!domain) return "/";
  const clean = domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim();
  if (!clean) return "/";

  const isLocal =
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.endsWith(".localhost") ||
    clean.startsWith("localhost:");

  const protocol = isLocal ? "http" : "https";
  return `${protocol}://${clean}`;
}

/**
 * Modern administration panel sidebar with integrated workspace switcher, collapsible icons, and categorized navigation links.
 *
 * @param {SidebarProps} props - Configuration properties specifying navigation states, tenant catalogs, and toggle handlers.
 * @returns {React.JSX.Element} React JSX sidebar element.
 */
export function Sidebar({
  isOpen,
  isMobileOpen = false,
  onToggle,
  onCloseMobile,
  currentSite,
  allSites,
  canManageSites = false,
}: SidebarProps): React.JSX.Element {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/updates", { cache: "no-store" })
      .then((res) => res.json())
      .then((info) => {
        if (mounted && info && typeof info.updateAvailable === "boolean") {
          setUpdateInfo(info);
        }
      })
      .catch(() => {
        checkForUpdates()
          .then((info) => {
            if (mounted) {
              setUpdateInfo(info);
            }
          })
          .catch(() => {});
      });
    return () => {
      mounted = false;
    };
  }, []);

  const navSections = [
    {
      title: t("content"),
      items: [
        { label: t("dashboard"), href: "/admin", icon: LayoutDashboard, exact: true },
        { label: t("posts"), href: "/admin/posts", icon: FileText },
        { label: t("pages"), href: "/admin/pages", icon: Files },
        { label: t("media"), href: "/admin/media", icon: ImageIcon },
      ],
    },
    {
      title: t("structure"),
      items: [
        { label: t("categories"), href: "/admin/categories", icon: FolderTree },
        { label: t("tags"), href: "/admin/tags", icon: Tag },
      ],
    },
    {
      title: t("configuration"),
      items: [
        { label: t("analytics"), href: "/admin/analytics", icon: BarChart3 },
        { label: t("users"), href: "/admin/users", icon: Users },
        { label: t("settings"), href: "/admin/settings", icon: Settings },
      ],
    },
  ];

  async function handleLogout(): Promise<void> {
    await logoutAction();
    router.push("/login");
  }

  const blogPublicUrl = getSitePublicUrl(currentSite?.domain);

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-50 lg:z-40 flex flex-col bg-surface border-r border-border transition-transform lg:transition-[width] duration-200 w-72 max-w-[85vw] ${
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      } lg:translate-x-0 ${isOpen ? "lg:w-56" : "lg:w-16"} select-none`}
    >
      {/* Expanded Header (Mobile off-canvas drawer & Desktop expanded) */}
      <div
        className={`flex items-center justify-between h-14 px-3.5 border-b border-border shrink-0 ${
          !isOpen ? "lg:hidden" : ""
        }`}
      >
        <Link
          href="/admin"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 min-w-0 overflow-hidden group cursor-pointer"
        >
          <img
            src="/icon.svg"
            alt="Kotonoba"
            className="w-7 h-7 object-contain shrink-0 transition-transform duration-200 group-hover:scale-110 drop-shadow-2xs"
          />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs text-text tracking-tight block truncate">
              Kotonoba
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent shrink-0">
              言の場
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={onToggle}
          className="hidden lg:flex p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
          aria-label={t("collapseSidebar")}
          title={t("collapseSidebar")}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
          aria-label={t("closeMobileMenu")}
          title={t("closeMobileMenu")}
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>

      {/* Collapsed Desktop Header (Width 16 = 64px, centered logo with expand transition) */}
      {!isOpen && (
        <div className="hidden lg:flex items-center justify-center h-14 border-b border-border shrink-0">
          <button
            type="button"
            onClick={onToggle}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-hover transition-all duration-200 cursor-pointer group relative"
            aria-label={t("expandSidebar")}
            title={`Kotonoba — ${t("expandSidebar")}`}
          >
            <img
              src="/icon.svg"
              alt="Kotonoba"
              className="w-7 h-7 object-contain transition-all duration-200 group-hover:scale-0 group-hover:opacity-0"
            />
            <PanelLeftOpen className="w-5 h-5 transition-all duration-200 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 absolute text-accent" />
          </button>
        </div>
      )}

      <div className="p-2 border-b border-border">
        <div className={!isOpen ? "lg:hidden" : ""}>
          <SiteSwitcher
            currentSite={currentSite}
            allSites={allSites}
            canManageSites={canManageSites}
            collapsed={false}
          />
        </div>
        {!isOpen && (
          <div className="hidden lg:block">
            <SiteSwitcher
              currentSite={currentSite}
              allSites={allSites}
              canManageSites={canManageSites}
              collapsed={true}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className={`px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider ${!isOpen ? "lg:hidden" : ""}`}>
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors min-h-[40px] ${
                    isActive
                      ? "bg-accent text-white font-semibold shadow-xs"
                      : "text-text-muted hover:text-text hover:bg-surface-hover"
                  } ${!isOpen ? "lg:justify-center lg:px-0" : ""}`}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : ""}`} />
                  <span className={`truncate ${!isOpen ? "lg:hidden" : ""}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {updateInfo?.updateAvailable ? (
        <div className="p-2 border-t border-border">
          <div className={!isOpen ? "lg:hidden" : ""}>
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-accent">
                <ArrowUpCircle className="w-4 h-4 shrink-0 text-accent animate-pulse" />
                <span className="truncate">{t("updateAvailable")}</span>
              </div>
              <p className="text-[11px] text-text-muted leading-tight">
                {t("newVersionAvailable", { version: updateInfo.latestVersion })}
              </p>
              <a
                href={updateInfo.containerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold text-center rounded-lg transition-colors shadow-2xs"
              >
                <span>{t("updateNow")}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>
          {!isOpen && (
            <div className="hidden lg:block">
              <a
                href={updateInfo.containerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-2 rounded-lg bg-accent/15 text-accent hover:bg-accent hover:text-white transition-colors relative"
                title={`${t("updateAvailable")}: v${updateInfo.latestVersion}`}
              >
                <ArrowUpCircle className="w-4 h-4 shrink-0" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent animate-ping" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
              </a>
            </div>
          )}
        </div>
      ) : updateInfo ? (
        <div className="px-3 py-1.5 border-t border-border/60">
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-[10px] font-mono text-text-muted/70 hover:text-text-muted transition-colors ${
              !isOpen ? "lg:justify-center" : "justify-between"
            }`}
            title={`Kotonoba v${updateInfo.currentVersion} (${t("upToDate")})`}
          >
            <span>v{updateInfo.currentVersion}</span>
            <span className={`flex items-center gap-1 text-[9px] text-emerald-500 font-sans font-medium ${!isOpen ? "lg:hidden" : ""}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {t("upToDate")}
            </span>
          </a>
        </div>
      ) : null}

      <div className="p-2 border-t border-border space-y-1">
        <a
          href={blogPublicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors min-h-[40px] ${
            !isOpen ? "lg:justify-center lg:px-0" : ""
          }`}
          title={!isOpen ? t("viewSite") : undefined}
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span className={`truncate ${!isOpen ? "lg:hidden" : ""}`}>{t("viewSite")}</span>
        </a>

        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-danger/80 hover:text-danger hover:bg-danger/10 transition-colors min-h-[40px] ${
            !isOpen ? "lg:justify-center lg:px-0" : ""
          }`}
          title={!isOpen ? t("logout") : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={`truncate ${!isOpen ? "lg:hidden" : ""}`}>{t("logout")}</span>
        </button>
      </div>
    </aside>
  );
}
