"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { SiteSelect } from "@/components/admin/SiteSelect";
import type { SiteOption } from "@/components/admin/UsersManagerClient";
import type { AuthRole } from "@/lib/auth/site-access";
import { canManageSites } from "@/lib/auth/roles";

/** Props for {@link UserFormModal}. */
export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  isPending: boolean;
  currentUserRole: AuthRole;
  availableSites: SiteOption[];
  displayName: string;
  onChangeDisplayName: (value: string) => void;
  email: string;
  onChangeEmail: (value: string) => void;
  password: string;
  onChangePassword: (value: string) => void;
  role: AuthRole;
  onChangeRole: (value: AuthRole) => void;
  siteId: string;
  onChangeSiteId: (value: string) => void;
  avatarUrl: string;
  onChangeAvatarUrl: (value: string) => void;
  formErrors: Record<string, string[]>;
  onSave: () => void;
}

/**
 * Reusable modal form for creating or editing team user accounts with role and tenant scoping.
 */
export function UserFormModal({
  isOpen,
  onClose,
  isEditing,
  isPending,
  currentUserRole,
  availableSites,
  displayName,
  onChangeDisplayName,
  email,
  onChangeEmail,
  password,
  onChangePassword,
  role,
  onChangeRole,
  siteId,
  onChangeSiteId,
  avatarUrl,
  onChangeAvatarUrl,
  formErrors,
  onSave,
}: UserFormModalProps) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const isSuper = canManageSites(currentUserRole);
  const selectedSite = availableSites.find((s) => s.id === siteId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? t("editUser") : t("newUser")}>
      <div className="space-y-4 pt-1">
        <Input
          label={t("displayName")}
          value={displayName}
          onChange={(e) => onChangeDisplayName(e.target.value)}
          placeholder={t("displayNamePlaceholder")}
          error={formErrors.displayName?.[0]}
          required
        />

        <Input
          label={t("email")}
          type="email"
          value={email}
          onChange={(e) => onChangeEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          error={formErrors.email?.[0]}
          required
        />

        <div className="space-y-1.5">
          <Input
            label={t("password")}
            type="password"
            value={password}
            onChange={(e) => onChangePassword(e.target.value)}
            placeholder={isEditing ? t("passwordEditPlaceholder") : t("passwordPlaceholder")}
            error={formErrors.password?.[0]}
            required={!isEditing}
          />
          {isEditing && (
            <p className="text-[11px] text-text-muted">{t("passwordEditPlaceholder")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text">{t("role")}</label>
          <Select
            value={role}
            onChange={(val) => onChangeRole(val as AuthRole)}
            options={
              isSuper
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

        {isSuper ? (
          <SiteSelect
            label={t("assignedSite")}
            value={siteId}
            onChange={onChangeSiteId}
            availableSites={availableSites}
            globalLabel={t("globalSite")}
            globalDesc={t("globalAccessDesc")}
            helperText={t("assignedSiteDesc")}
          />
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">{t("assignedSite")}</label>
            <div className="p-3 bg-surface-hover/40 border border-border rounded-xl flex items-center justify-between text-xs">
              <span className="text-text-muted">{selectedSite?.name || t("assignedSite")}</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                {selectedSite?.domain}
              </span>
            </div>
          </div>
        )}

        <Input
          label={t("avatarUrl")}
          value={avatarUrl}
          onChange={(e) => onChangeAvatarUrl(e.target.value)}
          placeholder={t("avatarUrlPlaceholder")}
          error={formErrors.avatarUrl?.[0]}
        />

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="button" variant="primary" size="sm" loading={isPending} onClick={onSave}>
            {tc("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
