"use client";

import React from "react";
import { usePathname, Link } from "@/i18n/routing";
import {
  LayoutDashboard, FileText, Image as ImageIcon, FolderTree, Tag, BarChart3,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen, ExternalLink
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { useRouter } from "@/i18n/routing";
import { SiteSwitcher, type SiteOption } from "@/components/admin/SiteSwitcher";
import { useTranslations } from "next-intl";

/**
 * Properties configuring the admin Sidebar navigation column.
 */
export interface SidebarProps {
  /** Expanded or collapsed width toggle. */
  isOpen: boolean;
  /** Callback fired to toggle sidebar collapse state. */
  onToggle: () => void;
  /** Callback fired to close mobile drawer on link selection. */
  onCloseMobile: () => void;
  /** Currently active workspace site. */
  currentSite: SiteOption;
  /** Catalog of all registered sites for multi-tenant switching. */
  allSites: SiteOption[];
}

/**
 * Modern administration panel sidebar with integrated workspace switcher, collapsible icons, and categorized navigation links.
 *
 * @param props - SidebarProps configuring active site, site list, and collapse status.
 * @returns React JSX sidebar element.
 */
export function Sidebar({
  isOpen,
  onToggle,
  onCloseMobile,
  currentSite,
  allSites,
}: SidebarProps) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  const navSections = [
    {
      title: t("content"),
      items: [
        { label: t("dashboard"), href: "/admin", icon: LayoutDashboard, exact: true },
        { label: t("posts"), href: "/admin/posts", icon: FileText },
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
        { label: t("settings"), href: "/admin/settings", icon: Settings },
      ],
    },
  ];

  async function handleLogout(): Promise<void> {
    await logoutAction();
    router.push("/login");
  }

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-surface border-r border-border transition-all duration-200 ${
        isOpen ? "w-56" : "w-16"
      } max-lg:${isOpen ? "translate-x-0" : "-translate-x-full"} max-lg:w-60 select-none shadow-xs`}
    >
      <div className="flex items-center justify-between h-14 px-3.5 border-b border-border shrink-0">
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-text text-bg flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
            K
          </div>
          {isOpen && (
            <span className="font-bold text-xs text-text tracking-tight block truncate">
              Kotonoba
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggle}
          className="hidden lg:flex p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          aria-label={isOpen ? "Colapsar barra lateral" : "Expandir barra lateral"}
        >
          {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
          aria-label="Cerrar menú móvil"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 border-b border-border">
        <SiteSwitcher
          currentSite={currentSite}
          allSites={allSites}
          collapsed={!isOpen}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {isOpen && (
              <p className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                {section.title}
              </p>
            )}
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
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-white font-semibold shadow-xs"
                      : "text-text-muted hover:text-text hover:bg-surface-hover"
                  } ${!isOpen ? "justify-center px-0" : ""}`}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : ""}`} />
                  {isOpen && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-border space-y-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors ${
            !isOpen ? "justify-center px-0" : ""
          }`}
          title={!isOpen ? "Ver Blog Público" : undefined}
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          {isOpen && <span className="truncate">{t("viewSite")}</span>}
        </a>

        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-danger/80 hover:text-danger hover:bg-danger/10 transition-colors ${
            !isOpen ? "justify-center px-0" : ""
          }`}
          title={!isOpen ? "Cerrar sesión" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {isOpen && <span className="truncate">{t("logout")}</span>}
        </button>
      </div>
    </aside>
  );
}
