"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "@/i18n/routing";
import { Sidebar } from "@/components/admin/Sidebar";
import { TopBar } from "@/components/admin/TopBar";
import type { SiteOption } from "@/components/admin/SiteSwitcher";

/**
 * Properties configuring the root administrative client layout.
 */
export interface AdminClientLayoutProps {
  /** Nested dashboard page elements. */
  children: React.ReactNode;
  /** Currently active workspace site. */
  currentSite: SiteOption;
  /** Catalog of all registered sites for tenant switching. */
  allSites: SiteOption[];
  /** Flag indicating whether the caller has permissions to create/manage sites (super_admin). */
  canManageSites?: boolean;
  /** Authenticated user identity metadata. */
  user: {
    displayName: string;
    email: string;
    role: string;
  };
}

const SIDEBAR_STORAGE_KEY = "kotonoba_admin_sidebar_open";

/**
 * Master client layout shell for the administration dashboard managing desktop sidebar collapse states and mobile drawer visibility.
 *
 * @param {AdminClientLayoutProps} props - Component properties configuring sites, user metadata, and children.
 * @returns {React.JSX.Element} Dashboard layout shell with responsive drawer management.
 */
export function AdminClientLayout({
  children,
  currentSite,
  allSites,
  canManageSites = false,
  user,
}: AdminClientLayoutProps): React.JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) {
        setSidebarOpen(stored === "true");
      }
    } catch {
      // Gracefully ignore environments where localStorage is restricted
    }
  }, []);

  useEffect(() => {
    const handleDeploymentSkew = (event: PromiseRejectionEvent | ErrorEvent) => {
      const error = "reason" in event ? event.reason : event.error;
      const msg = error?.message || (typeof error === "string" ? error : "");

      const isMismatch =
        msg.includes("Failed to find Server Action") ||
        msg.includes("Server Reference ID") ||
        (typeof error === "object" &&
          error !== null &&
          "__NEXT_ERROR_CODE" in error &&
          (error as Record<string, unknown>).__NEXT_ERROR_CODE === "E975");

      if (isMismatch) {
        console.warn("[Deployment Skew] Server action mismatch detected. Reloading to sync assets...");
        window.location.reload();
      }
    };

    window.addEventListener("unhandledrejection", handleDeploymentSkew);
    window.addEventListener("error", handleDeploymentSkew);
    return () => {
      window.removeEventListener("unhandledrejection", handleDeploymentSkew);
      window.removeEventListener("error", handleDeploymentSkew);
    };
  }, []);

  /**
   * Toggles the collapsed state of the desktop navigation sidebar and persists the user preference in local storage.
   */
  const handleToggleSidebar = (): void => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Gracefully ignore local storage write exceptions
      }
      return next;
    });
  };

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {mobileSidebarOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity cursor-pointer touch-manipulation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        isMobileOpen={mobileSidebarOpen}
        onToggle={handleToggleSidebar}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        currentSite={currentSite}
        allSites={allSites}
        canManageSites={canManageSites}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarOpen ? "lg:pl-56" : "lg:pl-16"
        }`}
      >
        <TopBar
          user={user}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
