"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import type { UserRecord } from "@/actions/users";
import type { AuthRole } from "@/lib/auth/site-access";
import { ROLES } from "@/lib/config/constants";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { UserFormModal } from "@/components/admin/UserFormModal";
import {
  UserRoleBadge,
  UsersFilterBar,
  UsersStatsGrid,
} from "@/components/admin/UsersFilterBar";
import { useUsersManager, type SiteOption } from "@/hooks/useUsersManager";
import { Users, UserPlus, Edit, Trash2, FileText, Globe } from "lucide-react";

export type { SiteOption };

/** Properties configuring the UsersManagerClient component. */
export interface UsersManagerClientProps {
  /** Catalog of initial user records. */
  initialUsers: UserRecord[];
  /** Catalog of available sites for tenant assignment. */
  availableSites: SiteOption[];
  /** Active user's unique identifier. */
  currentUserId: string;
  /** Active user's access role. */
  currentUserRole: AuthRole;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name[0] || "U").toUpperCase();
}

/**
 * Team and role-based access management workspace delegating filtering and CRUD handlers to {@link useUsersManager}.
 */
export function UsersManagerClient({
  initialUsers,
  availableSites,
  currentUserId,
  currentUserRole,
}: UsersManagerClientProps) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const locale = useLocale();
  const mgr = useUsersManager({ initialUsers, availableSites, currentUserRole });

  const columns: AdminTableColumn[] = [
    { key: "name", label: t("displayName") },
    { key: "role", label: t("role"), className: "hidden sm:table-cell" },
    { key: "site", label: t("assignedSite"), className: "hidden md:table-cell" },
    { key: "posts", label: t("postsCount"), className: "text-center hidden md:table-cell" },
    { key: "created", label: t("created"), className: "hidden lg:table-cell" },
    { key: "actions", label: tc("actions"), className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("description")}
        icon={<Users className="w-6 h-6" />}
        actions={
          <Button
            variant="primary"
            onClick={mgr.openCreateModal}
            icon={<UserPlus className="w-4 h-4" />}
            className="text-xs shadow-sm"
          >
            {t("newUser")}
          </Button>
        }
      />

      <UsersStatsGrid stats={mgr.stats} />

      <UsersFilterBar
        searchQuery={mgr.searchQuery}
        onSearchChange={mgr.setSearchQuery}
        roleFilter={mgr.roleFilter}
        onRoleFilterChange={mgr.setRoleFilter}
        siteFilter={mgr.siteFilter}
        onSiteFilterChange={mgr.setSiteFilter}
        isSuper={mgr.isSuper}
        availableSites={availableSites}
      />

      <AdminDataTable
        columns={columns}
        isEmpty={mgr.filteredUsers.length === 0}
        emptyIcon={<Users className="w-8 h-8 opacity-40" />}
        emptyTitle={t("noUsersFound")}
        emptyDescription={t("noUsersFoundDesc")}
      >
        {mgr.filteredUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const canManage = mgr.isSuper || (currentUserRole === ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN);

          return (
            <tr key={user.id} className="hover:bg-surface-hover/30 transition-colors group">
              <td className="py-3.5 px-4">
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-bold flex items-center justify-center text-xs shrink-0 border border-accent/20">
                      {getInitials(user.displayName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-text truncate">{user.displayName}</span>
                      {isSelf && (
                        <Badge variant="secondary" size="sm" className="text-[9px]">
                          Tú
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted block truncate font-mono">
                      {user.email}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1 sm:hidden flex-wrap">
                      <UserRoleBadge role={user.role} />
                      {user.siteName && (
                        <span className="text-[10px] text-text-muted flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {user.siteName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>

              <td className="py-3.5 px-4 whitespace-nowrap hidden sm:table-cell">
                <UserRoleBadge role={user.role} />
              </td>

              <td className="py-3.5 px-4 whitespace-nowrap hidden md:table-cell">
                {user.siteName ? (
                  <span className="inline-flex items-center gap-1.5 text-text text-xs font-medium">
                    <Globe className="w-3.5 h-3.5 text-text-muted" />
                    <span>{user.siteName}</span>
                  </span>
                ) : (
                  <span className="text-text-muted text-[11px] italic">{t("globalSite")}</span>
                )}
              </td>

              <td className="py-3.5 px-4 text-center font-mono text-xs hidden md:table-cell">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-muted">
                  <FileText className="w-3 h-3" />
                  <span>{user.postCount}</span>
                </span>
              </td>

              <td className="py-3.5 px-4 whitespace-nowrap text-text-muted text-[11px] font-mono hidden lg:table-cell">
                {formatDate(new Date(user.createdAt), locale)}
              </td>

              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mgr.openEditModal(user)}
                    disabled={!canManage}
                    title={tc("edit")}
                    className="min-w-[36px] min-h-[36px] sm:h-7 sm:w-7 p-0 text-text-muted hover:text-text"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mgr.setUserToDelete(user)}
                    disabled={!canManage || isSelf}
                    title={tc("delete")}
                    className="min-w-[36px] min-h-[36px] sm:h-7 sm:w-7 p-0 text-text-muted hover:text-rose-500 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </AdminDataTable>

      <UserFormModal
        isOpen={mgr.modalOpen}
        onClose={() => mgr.setModalOpen(false)}
        isEditing={Boolean(mgr.editingUser)}
        isPending={mgr.isPending}
        currentUserRole={currentUserRole}
        availableSites={availableSites}
        displayName={mgr.formDisplayName}
        onChangeDisplayName={mgr.setFormDisplayName}
        email={mgr.formEmail}
        onChangeEmail={mgr.setFormEmail}
        password={mgr.formPassword}
        onChangePassword={mgr.setFormPassword}
        role={mgr.formRole}
        onChangeRole={mgr.setFormRole}
        siteId={mgr.formSiteId}
        onChangeSiteId={mgr.setFormSiteId}
        avatarUrl={mgr.formAvatarUrl}
        onChangeAvatarUrl={mgr.setFormAvatarUrl}
        formErrors={mgr.formErrors}
        onSave={mgr.handleSaveUser}
      />

      <ConfirmModal
        isOpen={!!mgr.userToDelete}
        onClose={() => mgr.setUserToDelete(null)}
        onConfirm={mgr.handleDeleteUser}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteDesc", { name: mgr.userToDelete?.displayName || "" })}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={mgr.isPending}
      />
    </div>
  );
}
