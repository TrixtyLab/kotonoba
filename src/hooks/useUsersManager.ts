"use client";

import { useState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createUser, updateUser, deleteUser, type UserRecord } from "@/actions/users";
import type { UpdateUserInput } from "@/lib/contracts";
import type { AuthRole } from "@/lib/auth/site-access";
import { canManageSites } from "@/lib/auth/roles";
import { ROLES } from "@/lib/config/constants";
import { useToast } from "@/components/ui/Toast";

export interface SiteOption {
  id: string;
  name: string;
  domain: string;
}

interface UseUsersManagerOptions {
  initialUsers: UserRecord[];
  availableSites: SiteOption[];
  currentUserRole: AuthRole;
}

/**
 * Manages user roster state, role/site filtering, summary counters, and CRUD form modals.
 */
export function useUsersManager({
  initialUsers,
  availableSites,
  currentUserRole,
}: UseUsersManagerOptions) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
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
  const [formRole, setFormRole] = useState<AuthRole>(ROLES.AUTHOR);
  const [formSiteId, setFormSiteId] = useState<string>("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const stats = useMemo(
    () => ({
      total: users.length,
      superAdmins: users.filter((u) => u.role === ROLES.SUPER_ADMIN).length,
      admins: users.filter((u) => u.role === ROLES.ADMIN).length,
      editors: users.filter((u) => u.role === ROLES.EDITOR).length,
      authors: users.filter((u) => u.role === ROLES.AUTHOR).length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
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
    setFormRole(ROLES.AUTHOR);
    setFormSiteId(isSuper ? "" : availableSites[0]?.id || "");
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

    const applyUserError = (res: { errors?: Record<string, string[]>; error?: string }) => {
      if (res.errors) setFormErrors(res.errors);
      else toast.error(res.error || tc("save"));
    };

    const submitExistingUser = async (resolvedSiteName: string | null) => {
      if (!editingUser) return;
      const payload: Partial<UpdateUserInput> = {
        displayName: formDisplayName.trim(),
        email: formEmail.trim(),
        role: formRole,
        siteId: formSiteId || null,
        avatarUrl: formAvatarUrl.trim() || null,
      };
      if (formPassword.trim()) payload.password = formPassword.trim();

      const res = await updateUser(editingUser.id, payload);
      if (!res.success) return applyUserError(res);

      toast.success(t("userUpdated"));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                displayName: payload.displayName || u.displayName,
                email: formEmail.trim().toLowerCase(),
                role: formRole,
                siteId: payload.siteId ?? null,
                siteName: resolvedSiteName,
                avatarUrl: payload.avatarUrl ?? null,
              }
            : u
        )
      );
      setModalOpen(false);
      router.refresh();
    };

    const submitNewUser = async (resolvedSiteName: string | null) => {
      const cleanName = formDisplayName.trim();
      const cleanAvatar = formAvatarUrl.trim() || null;
      const cleanSiteId = formSiteId || null;
      const res = await createUser({
        displayName: cleanName,
        email: formEmail.trim(),
        password: formPassword,
        role: formRole,
        siteId: cleanSiteId,
        avatarUrl: cleanAvatar,
      });
      if (!res.success) return applyUserError(res);

      toast.success(t("userCreated"));
      const newUserObj: UserRecord = {
        id: res.id || "",
        displayName: cleanName,
        email: formEmail.trim().toLowerCase(),
        role: formRole,
        siteId: cleanSiteId,
        siteName: resolvedSiteName,
        avatarUrl: cleanAvatar,
        postCount: 0,
        createdAt: new Date(),
      };
      setUsers((prev) => [newUserObj, ...prev]);
      setModalOpen(false);
      router.refresh();
    };

    startTransition(async () => {
      const resolvedSiteName = availableSites.find((s) => s.id === formSiteId)?.name || null;
      if (editingUser) await submitExistingUser(resolvedSiteName);
      else await submitNewUser(resolvedSiteName);
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

  return {
    isSuper,
    isPending,
    stats,
    filteredUsers,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    siteFilter,
    setSiteFilter,
    modalOpen,
    setModalOpen,
    editingUser,
    userToDelete,
    setUserToDelete,
    formDisplayName,
    setFormDisplayName,
    formEmail,
    setFormEmail,
    formPassword,
    setFormPassword,
    formRole,
    setFormRole,
    formSiteId,
    setFormSiteId,
    formAvatarUrl,
    setFormAvatarUrl,
    formErrors,
    openCreateModal,
    openEditModal,
    handleSaveUser,
    handleDeleteUser,
  };
}
