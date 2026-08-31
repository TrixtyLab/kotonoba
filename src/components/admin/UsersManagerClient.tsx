"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createUser, updateUser, deleteUser, type UserRecord } from "@/actions/users";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SiteSelect } from "@/components/admin/SiteSelect";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Edit,
  Trash2,
  Search,
  FileText,
  Calendar,
  Globe,
  Lock,
  Mail,
  User,
  Image as ImageIcon,
  KeyRound,
  Filter,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";

/**
 * Site option model for tenant assignment dropdowns.
 */
export interface SiteOption {
  id: string;
  name: string;
  domain: string;
}

/**
 * Properties configuring the UsersManagerClient component.
 */
export interface UsersManagerClientProps {
  /** Catalog of initial user records. */
  initialUsers: UserRecord[];
  /** Catalog of available sites for tenant assignment. */
  availableSites: SiteOption[];
  /** Active user's unique identifier. */
  currentUserId: string;
  /** Active user's access role. */
  currentUserRole: "super_admin" | "admin" | "editor" | "author";
}

/**
 * Modern user and team management interface with role-based access control, search filtering, and user provisioning.
 *
 * @param props - UsersManagerClientProps configuring initial users, sites, and caller permissions.
 * @returns React JSX user management view.
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
  const [formRole, setFormRole] = useState<"super_admin" | "admin" | "editor" | "author">("author");
  const [formSiteId, setFormSiteId] = useState<string>("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const stats = useMemo(() => {
    const total = users.length;
    const superAdmins = users.filter((u) => u.role === "super_admin").length;
    const admins = users.filter((u) => u.role === "admin").length;
    const editors = users.filter((u) => u.role === "editor").length;
    const authors = users.filter((u) => u.role === "author").length;
    return { total, superAdmins, admins, editors, authors };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

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
    setFormRole(currentUserRole === "admin" ? "author" : "author");
    setFormSiteId(currentUserRole === "super_admin" ? "" : (availableSites[0]?.id || ""));
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
      if (editingUser) {
        const payload: Record<string, any> = {
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
                    siteName:
                      availableSites.find((s) => s.id === formSiteId)?.name || null,
                    avatarUrl: formAvatarUrl.trim() || null,
                  }
                : u
            )
          );
          setModalOpen(false);
          router.refresh();
        } else {
          if (res.errors) {
            setFormErrors(res.errors);
          } else {
            toast.error(res.error || tc("save"));
          }
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
            siteName:
              availableSites.find((s) => s.id === formSiteId)?.name || null,
            avatarUrl: formAvatarUrl.trim() || null,
            postCount: 0,
            createdAt: new Date(),
          };
          setUsers((prev) => [newUserObj, ...prev]);
          setModalOpen(false);
          router.refresh();
        } else {
          if (res.errors) {
            setFormErrors(res.errors);
          } else {
            toast.error(res.error || tc("save"));
          }
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

  function getRoleBadge(role: UserRecord["role"]) {
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

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || "U").toUpperCase();
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2.5">
            <Users className="w-6 h-6 text-accent" />
            <span>{t("title")}</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">{t("description")}</p>
        </div>

        <Button
          variant="primary"
          onClick={openCreateModal}
          icon={<UserPlus className="w-4 h-4" />}
          className="text-xs shadow-sm"
        >
          {t("newUser")}
        </Button>
      </div>

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
              onChange={(val) => setRoleFilter(val)}
              options={[
                { value: "all", label: t("allRoles") },
                { value: "super_admin", label: t("roleSuperAdmin") },
                { value: "admin", label: t("roleAdmin") },
                { value: "editor", label: t("roleEditor") },
                { value: "author", label: t("roleAuthor") },
              ]}
            />
          </div>

          {currentUserRole === "super_admin" && availableSites.length > 1 && (
            <div className="w-40">
              <Select
                value={siteFilter}
                onChange={(val) => setSiteFilter(val)}
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

      {/* Users Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-hover/40 border-b border-border text-text-muted uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">{t("displayName")}</th>
                <th className="py-3 px-4">{t("role")}</th>
                <th className="py-3 px-4">{t("assignedSite")}</th>
                <th className="py-3 px-4 text-center">{t("postsCount")}</th>
                <th className="py-3 px-4">{t("created")}</th>
                <th className="py-3 px-4 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-sm">{t("noUsersFound")}</p>
                    <p className="text-xs mt-0.5">{t("noUsersFoundDesc")}</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const canManage =
                    currentUserRole === "super_admin" ||
                    (currentUserRole === "admin" && user.role !== "super_admin");

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-surface-hover/30 transition-colors group"
                    >
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
                              <span className="font-semibold text-text truncate">
                                {user.displayName}
                              </span>
                              {isSelf && (
                                <Badge variant="secondary" size="sm" className="text-[9px]">
                                  Tú
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-text-muted block truncate font-mono">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {user.siteName ? (
                          <span className="inline-flex items-center gap-1.5 text-text text-xs font-medium">
                            <Globe className="w-3.5 h-3.5 text-text-muted" />
                            <span>{user.siteName}</span>
                          </span>
                        ) : (
                          <span className="text-text-muted text-[11px] italic">
                            {t("globalSite")}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-muted">
                          <FileText className="w-3 h-3" />
                          <span>{user.postCount}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-text-muted text-[11px] font-mono">
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
                            className="h-7 w-7 p-0 text-text-muted hover:text-text"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUserToDelete(user)}
                            disabled={!canManage || isSelf}
                            title={tc("delete")}
                            className="h-7 w-7 p-0 text-text-muted hover:text-rose-500 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? t("editUser") : t("newUser")}
      >
        <div className="space-y-4 pt-1">
          <Input
            label={t("displayName")}
            value={formDisplayName}
            onChange={(e) => setFormDisplayName(e.target.value)}
            placeholder={t("displayNamePlaceholder")}
            error={formErrors.displayName?.[0]}
            required
          />

          <Input
            label={t("email")}
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            error={formErrors.email?.[0]}
            required
          />

          <div className="space-y-1.5">
            <Input
              label={t("password")}
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder={
                editingUser ? t("passwordEditPlaceholder") : t("passwordPlaceholder")
              }
              error={formErrors.password?.[0]}
              required={!editingUser}
            />
            {editingUser && (
              <p className="text-[11px] text-text-muted">{t("passwordEditPlaceholder")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">{t("role")}</label>
            <Select
              value={formRole}
              onChange={(val) => setFormRole(val as any)}
              options={
                currentUserRole === "super_admin"
                  ? [
                      { value: "super_admin", label: `${t("roleSuperAdmin")} - ${t("roleSuperAdminDesc")}` },
                      { value: "admin", label: `${t("roleAdmin")} - ${t("roleAdminDesc")}` },
                      { value: "editor", label: `${t("roleEditor")} - ${t("roleEditorDesc")}` },
                      { value: "author", label: `${t("roleAuthor")} - ${t("roleAuthorDesc")}` },
                    ]
                  : [
                      { value: "editor", label: `${t("roleEditor")} - ${t("roleEditorDesc")}` },
                      { value: "author", label: `${t("roleAuthor")} - ${t("roleAuthorDesc")}` },
                    ]
              }
            />
          </div>

          {currentUserRole === "super_admin" ? (
            <SiteSelect
              label={t("assignedSite")}
              value={formSiteId}
              onChange={(val) => setFormSiteId(val)}
              availableSites={availableSites}
              globalLabel={t("globalSite")}
              globalDesc={t("globalAccessDesc")}
              helperText={t("assignedSiteDesc")}
            />
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text">{t("assignedSite")}</label>
              <div className="p-3 bg-surface-hover/40 border border-border rounded-xl flex items-center justify-between text-xs">
                <span className="text-text-muted">
                  {availableSites.find((s) => s.id === formSiteId)?.name || t("assignedSite")}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                  {availableSites.find((s) => s.id === formSiteId)?.domain}
                </span>
              </div>
            </div>
          )}

          <Input
            label={t("avatarUrl")}
            value={formAvatarUrl}
            onChange={(e) => setFormAvatarUrl(e.target.value)}
            placeholder={t("avatarUrlPlaceholder")}
            error={formErrors.avatarUrl?.[0]}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isPending}
              onClick={handleSaveUser}
            >
              {tc("save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
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
