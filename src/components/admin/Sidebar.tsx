"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import {
  LayoutDashboard, FileText, FolderTree, Tag, Globe, BarChart3,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen, ExternalLink, X
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { useRouter } from "@/i18n/routing";

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  siteName: string;
}

/**
 * Collapsible, 100% responsive admin sidebar with active state highlights and keyboard accessibility.
 */
export function Sidebar({ isOpen, onToggle, onCloseMobile, siteName }: SidebarProps) {
  const tCommon = useTranslations("common");
  const tAdmin = useTranslations("admin");
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: tCommon("dashboard"), href: "/admin", icon: LayoutDashboard },
    { label: tCommon("posts"), href: "/admin/posts", icon: FileText },
    { label: tCommon("categories"), href: "/admin/categories", icon: FolderTree },
    { label: tCommon("tags"), href: "/admin/tags", icon: Tag },
    { label: tCommon("sites"), href: "/admin/sites", icon: Globe },
    { label: tCommon("analytics"), href: "/admin/analytics", icon: BarChart3 },
    { label: tCommon("settings"), href: "/admin/settings", icon: Settings },
  ];

  async function handleLogout() {
    await logoutAction();
    router.push("/login");
  }

  return (
    <>
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col glass border-r border-border transition-all duration-200 ${
          isOpen ? "w-60" : "w-16"
        } max-lg:${isOpen ? "translate-x-0" : "-translate-x-full"} max-lg:w-64`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border/50">
          <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-sm shrink-0 shadow-sm shadow-primary/10">
              K
            </div>
            {isOpen && (
              <div className="truncate">
                <span className="font-bold text-sm text-text tracking-tight block truncate">Kotonoba</span>
                <span className="text-[10px] text-text-muted block truncate">{siteName}</span>
              </div>
            )}
          </Link>

          <button
            onClick={onToggle}
            className="hidden lg:flex p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
            aria-label="Close mobile sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  active
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {isOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50 space-y-1">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            title={!isOpen ? tAdmin("viewPublicBlog") : undefined}
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            {isOpen && <span>{tAdmin("viewPublicBlog")}</span>}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
            title={!isOpen ? tCommon("logout") : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isOpen && <span>{tCommon("logout")}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
