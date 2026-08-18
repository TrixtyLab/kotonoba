"use client";

import { useState } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { TopBar } from "@/components/admin/TopBar";
import type { SiteOption } from "@/components/admin/SiteSwitcher";

export interface AdminClientLayoutProps {
  children: React.ReactNode;
  currentSite: SiteOption;
  allSites: SiteOption[];
  user: {
    displayName: string;
    email: string;
    role: string;
  };
}

/**
 * Responsive client wrapper managing sidebar collapse state and mobile drawer overlay.
 */
export function AdminClientLayout({ children, currentSite, allSites, user }: AdminClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-text flex">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        siteName={currentSite.name}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarOpen ? "lg:pl-60" : "lg:pl-16"
        }`}
      >
        <TopBar
          currentSite={currentSite}
          allSites={allSites}
          user={user}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
