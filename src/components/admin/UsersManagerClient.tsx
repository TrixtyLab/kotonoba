"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createUser, updateUser, deleteUser, type UserRecord } from "@/actions/users";
import type { UpdateUserInput } from "@/lib/security/validate";
import type { AuthRole } from "@/lib/auth/site-access";
import { canManageSites } from "@/lib/auth/roles";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { UserFormModal } from "@/components/admin/UserFormModal";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Edit,
  Trash2,
  Search,
  FileText,
  Globe,
  User,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";

/** Site option model for tenant assignment dropdowns. */
export interface SiteOption {
  id: string;
  name: string;
  domain: string;
}

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
 * Modern user and team management interface with role-based access control, search filtering, and user provisioning.
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
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const isSuper = canManageSites(currentUserRole);

  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);

  const [formDisplayName, setFormDisplayName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<AuthRole>("author");
  const [formSiteId, setFormSiteId] = useState<string>("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const stats = useMemo(() => {
    return {
      total: users.length,
      superAdmins: users.filter((u) => u.role === "super_admin").length,
      admins: users.filter((u) => u.role === "admin").length,
      editors: users.filter((u) => u.role === "editor").length,
      authors: users.filter((u) => u.role === "author").length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesSite =
        siteFilter === "all" ||
        (siteFilter === "global" ? !u.siteId : u.siteId === siteFilter);
      return matchesSearch && matchesRole && matchesSite;
    });
  }, [users, searchQuery, roleFilter, siteFilter]);

  function openCreateModal() {
    setEditingUser(null);
    setFormDisplayName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("author");
    setFormSiteId(isSuper ? "" : (availableSites[0]?.id || ""));
    setFormAvatarUrl("");
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(user: UserRecord) {
    setEditingUser(user);
    setFormDisplayName(user.displayName);
    setFormEmail(user.email);
    setFormPassword("");
    setFormRole(user.role);
    setFormSiteId(user.siteId || "");
    setFormAvatarUrl(user.avatarUrl || "");
    setFormErrors({});
    setModalOpen(true);
  }

  async function handleSaveUser() {
    setFormErrors({});

    if (!formDisplayName.trim()) {
      setFormErrors({ displayName: [tc("title")] });
      return;
    }
    if (!formEmail.trim()) {
      setFormErrors({ email: [t("email")] });
      return;
    }
    if (!editingUser && (!formPassword || formPassword.length < 8)) {
      setFormErrors({ password: [t("passwordPlaceholder")] });
      return;
    }

    startTransition(async () => {
      const resolvedSiteName = availableSites.find((s) => s.id === formSiteId)?.name || null;

      if (editingUser) {
        const payload: Partial<UpdateUserInput> = {
          displayName: formDisplayName.trim(),
          email: formEmail.trim(),
          role: formRole,
          siteId: formSiteId || null,
          avatarUrl: formAvatarUrl.trim() || null,
        };
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }

        const res = await updateUser(editingUser.id, payload);
        if (res.success) {
          toast.success(t("userUpdated"));
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUser.id
                ? {
                    ...u,
                    displayName: formDisplayName.trim(),
                    email: formEmail.trim().toLowerCase(),
                    role: formRole,
                    siteId: formSiteId || null,
                    siteName: resolvedSiteName,
                    avatarUrl: formAvatarUrl.trim() || null,
                  }
                : u
            )
          );
          setModalOpen(false);
          router.refresh();
        } else if (res.errors) {
          setFormErrors(res.errors);
        } else {
          toast.error(res.error || tc("save"));
        }
      } else {
        const res = await createUser({
          displayName: formDisplayName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          role: formRole,
          siteId: formSiteId || null,
          avatarUrl: formAvatarUrl.trim() || null,
        });

        if (res.success) {
          toast.success(t("userCreated"));
          const newUserObj: UserRecord = {
            id: res.id || "",
            displayName: formDisplayName.trim(),
            email: formEmail.trim().toLowerCase(),
            role: formRole,
            siteId: formSiteId || null,
            siteName: resolvedSiteName,
            avatarUrl: formAvatarUrl.trim() || null,
            postCount: 0,
            createdAt: new Date(),
          };
          setUsers((prev) => [newUserObj, ...prev]);
          setModalOpen(false);
          router.refresh();
        } else if (res.errors) {
          setFormErrors(res.errors);
        } else {
          toast.error(res.error || tc("save"));
        }
      }
    });
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    startTransition(async () => {
      const res = await deleteUser(userToDelete.id);
      if (res.success) {
        toast.success(t("userDeleted"));
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
        setUserToDelete(null);
        router.refresh();
      } else {
        toast.error(res.error || tc("delete"));
      }
    });
  }

  function renderRoleBadge(role: UserRecord["role"]) {
    switch (role) {
      case "super_admin":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShieldCheck className="w-3 h-3" />
            {t("roleSuperAdmin")}
          </span>
        );
      case "admin":
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
            onClick={openCreateModal}
            icon={<UserPlus className="w-4 h-4" />}
            className="text-xs shadow-sm"
          >
            {t("newUser")}
          </Button>
        }
      />

      {/* Metric Counters */}
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface p-3 rounded-xl border border-border">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-hover/50 border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-36">
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "all", label: t("allRoles") },
                { value: "super_admin", label: t("roleSuperAdmin") },
                { value: "admin", label: t("roleAdmin") },
                { value: "editor", label: t("roleEditor") },
                { value: "author", label: t("roleAuthor") },
              ]}
            />
          </div>

          {isSuper && availableSites.length > 1 && (
            <div className="w-40">
              <Select
                value={siteFilter}
                onChange={setSiteFilter}
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

      <AdminDataTable
        columns={columns}
        isEmpty={filteredUsers.length === 0}
        emptyIcon={<Users className="w-8 h-8 opacity-40" />}
        emptyTitle={t("noUsersFound")}
        emptyDescription={t("noUsersFoundDesc")}
      >
        {filteredUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const canManage = isSuper || (currentUserRole === "admin" && user.role !== "super_admin");

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
                      {renderRoleBadge(user.role)}
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
                {renderRoleBadge(user.role)}
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
                    onClick={() => openEditModal(user)}
                    disabled={!canManage}
                    title={tc("edit")}
                    className="min-w-[36px] min-h-[36px] sm:h-7 sm:w-7 p-0 text-text-muted hover:text-text"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUserToDelete(user)}
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
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isEditing={Boolean(editingUser)}
        isPending={isPending}
        currentUserRole={currentUserRole}
        availableSites={availableSites}
        displayName={formDisplayName}
        onChangeDisplayName={setFormDisplayName}
        email={formEmail}
        onChangeEmail={setFormEmail}
        password={formPassword}
        onChangePassword={setFormPassword}
        role={formRole}
        onChangeRole={setFormRole}
        siteId={formSiteId}
        onChangeSiteId={setFormSiteId}
        avatarUrl={formAvatarUrl}
        onChangeAvatarUrl={setFormAvatarUrl}
        formErrors={formErrors}
        onSave={handleSaveUser}
      />

      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteDesc", { name: userToDelete?.displayName || "" })}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
