"use client";

import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SiteSwitcher, type SiteOption } from "./SiteSwitcher";
import { Menu } from "lucide-react";

export interface TopBarProps {
  currentSite: SiteOption;
  allSites: SiteOption[];
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  onOpenMobileSidebar: () => void;
}

/**
 * Top navigation bar of admin panel with SiteSwitcher, LocaleSwitcher, ThemeToggle, and user profile.
 */
export function TopBar({ currentSite, allSites, user, onOpenMobileSidebar }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-6 glass border-b border-border">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <SiteSwitcher currentSite={currentSite} allSites={allSites} />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LocaleSwitcher />
        <ThemeToggle />

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs">
            {user.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-text truncate max-w-[120px]">{user.displayName}</p>
            <p className="text-[10px] text-text-muted capitalize">{user.role.replace("_", " ")}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
