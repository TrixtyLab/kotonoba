"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import type { SiteOption } from "@/hooks/useUsersManager";
import type { UserRecord } from "@/actions/users";
import { ROLES } from "@/lib/config/constants";
import { Search, ShieldCheck, Shield, Edit, User } from "lucide-react";

interface UsersStatsGridProps {
  stats: {
    total: number;
    superAdmins: number;
    admins: number;
    editors: number;
    authors: number;
  };
}

/**
 * Renders top summary counters for team roles and total members.
 */
export function UsersStatsGrid({ stats }: UsersStatsGridProps) {
  const t = useTranslations("users");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-1">
        <span className="text-[11px] font-medium text-text-muted">{t("totalUsers")}</span>
        <span className="text-xl font-bold text-text font-mono">{stats.total}</span>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-1">
        <span className="text-[11px] font-medium text-purple-400 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          {t("superAdmins")} / {t("admins")}
        </span>
        <span className="text-xl font-bold text-text font-mono">
          {stats.superAdmins + stats.admins}
        </span>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-1">
        <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
          <Edit className="w-3 h-3" />
          {t("editors")}
        </span>
        <span className="text-xl font-bold text-text font-mono">{stats.editors}</span>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-1">
        <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
          <User className="w-3 h-3" />
          {t("authors")}
        </span>
        <span className="text-xl font-bold text-text font-mono">{stats.authors}</span>
      </div>
    </div>
  );
}

interface UsersFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  roleFilter: string;
  onRoleFilterChange: (val: string) => void;
  siteFilter: string;
  onSiteFilterChange: (val: string) => void;
  isSuper: boolean;
  availableSites: SiteOption[];
}

/**
 * Filter bar for searching team members by name/email, role, and assigned tenant site.
 */
export function UsersFilterBar({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  siteFilter,
  onSiteFilterChange,
  isSuper,
  availableSites,
}: UsersFilterBarProps) {
  const t = useTranslations("users");

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface p-3 rounded-xl border border-border">
      <div className="relative w-full sm:w-72">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-9 pr-3 py-2 min-h-[40px] text-sm bg-input border border-border rounded-lg text-text placeholder:text-text-muted placeholder:italic focus:outline-hidden focus:border-accent"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="w-36">
          <Select
            value={roleFilter}
            onChange={onRoleFilterChange}
            options={[
              { value: "all", label: t("allRoles") },
              { value: ROLES.SUPER_ADMIN, label: t("roleSuperAdmin") },
              { value: ROLES.ADMIN, label: t("roleAdmin") },
              { value: ROLES.EDITOR, label: t("roleEditor") },
              { value: ROLES.AUTHOR, label: t("roleAuthor") },
            ]}
          />
        </div>

        {isSuper && availableSites.length > 1 && (
          <div className="w-40">
            <Select
              value={siteFilter}
              onChange={onSiteFilterChange}
              options={[
                { value: "all", label: t("allSites") },
                { value: "global", label: t("globalSite") },
                ...availableSites.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the semantic badge pill corresponding to a user's RBAC role.
 */
export function UserRoleBadge({ role }: { role: UserRecord["role"] }) {
  const t = useTranslations("users");

  switch (role) {
    case ROLES.SUPER_ADMIN:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <ShieldCheck className="w-3 h-3" />
          {t("roleSuperAdmin")}
        </span>
      );
    case ROLES.ADMIN:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Shield className="w-3 h-3" />
          {t("roleAdmin")}
        </span>
      );
    case "editor":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Edit className="w-3 h-3" />
          {t("roleEditor")}
        </span>
      );
    case "author":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
          <User className="w-3 h-3" />
          {t("roleAuthor")}
        </span>
      );
  }
}
