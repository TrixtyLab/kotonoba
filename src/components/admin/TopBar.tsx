"use client";

import React from "react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Menu } from "lucide-react";

/**
 * Properties configuring the TopBar header component.
 */
export interface TopBarProps {
  /** Authenticated user identity metadata. */
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  /** Callback fired to reveal the mobile drawer sidebar. */
  onOpenMobileSidebar: () => void;
}

/**
 * Administrative panel top bar header rendering user profile badge, language switcher, and theme toggle controls.
 *
 * @param props - TopBarProps configuring active user metadata and drawer trigger.
 * @returns React JSX header element.
 */
export function TopBar({ user, onOpenMobileSidebar }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LocaleSwitcher />
        <ThemeToggle />

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        <div className="flex items-center gap-2 pl-1">
          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs">
            {user.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left leading-none">
            <p className="text-xs font-bold text-text truncate max-w-[120px]">
              {user.displayName}
            </p>
            <p className="text-[10px] text-text-muted capitalize font-medium mt-0.5">
              {user.role.replace("_", " ")}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
