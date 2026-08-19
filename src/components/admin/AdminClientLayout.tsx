"use client";

import React, { useState } from "react";
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
  /** Authenticated user identity metadata. */
  user: {
    displayName: string;
    email: string;
    role: string;
  };
}

/**
 * Master client layout shell for the administration dashboard managing desktop sidebar collapse states and mobile drawer visibility.
 *
 * @param props - AdminClientLayoutProps configuring sites, user metadata, and children.
 * @returns React JSX dashboard layout shell.
 */
export function AdminClientLayout({ children, currentSite, allSites, user }: AdminClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        currentSite={currentSite}
        allSites={allSites}
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
