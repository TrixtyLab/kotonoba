"use client";

import React from "react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Menu, Download } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Properties configuring the TopBar header component.
 */
export interface TopBarProps {
  /** Authenticated user identity metadata. */
  user: {
    /** Display name of the active user. */
    displayName: string;
    /** User's email address. */
    email: string;
    /** Permission role assigned to the user. */
    role: string;
  };
  /** Callback fired to reveal the mobile drawer sidebar. */
  onOpenMobileSidebar: () => void;
}

/**
 * Administrative panel top bar header rendering user profile badge, language switcher, and theme toggle controls.
 *
 * @param {TopBarProps} props - Configuration properties including active user details and mobile drawer trigger.
 * @returns {React.JSX.Element} React JSX header element.
 */
export function TopBar({ user, onOpenMobileSidebar }: TopBarProps): React.JSX.Element {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-3 sm:px-6 bg-surface border-b border-border">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
          aria-label={t("openNavigationMenu")}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        <LocaleSwitcher />
        <ThemeToggle />

        <div className="h-4 w-px bg-border mx-0.5 sm:mx-1 hidden sm:block" />

        <div className="flex items-center gap-2 pl-0.5 sm:pl-1">
          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
            {user.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left leading-none">
            <p className="text-sm font-semibold text-text truncate max-w-[140px]">
              {user.displayName}
            </p>
            <p className="text-xs text-text-muted capitalize font-medium mt-0.5">
              {user.role.replace("_", " ")}
            </p>
          </div>
          <a
            href="/api/users/me/export"
            download
            title={t("downloadMyData")}
            aria-label={t("downloadMyData")}
            className="min-w-[40px] min-h-[40px] rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors flex items-center justify-center"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
