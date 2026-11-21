"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { POST_STATUS, type PostStatus } from "@/lib/config/constants";

const STATUS_VARIANTS: Record<PostStatus, NonNullable<BadgeProps["variant"]>> = {
  [POST_STATUS.PUBLISHED]: "success",
  [POST_STATUS.SCHEDULED]: "primary",
  [POST_STATUS.ARCHIVED]: "secondary",
  [POST_STATUS.DRAFT]: "warning",
};

const STATUS_LABEL_KEYS: Record<PostStatus, string> = {
  [POST_STATUS.PUBLISHED]: "statusPublished",
  [POST_STATUS.SCHEDULED]: "statusScheduled",
  [POST_STATUS.ARCHIVED]: "statusArchived",
  [POST_STATUS.DRAFT]: "statusDraft",
};

export interface StatusBadgeProps {
  status: PostStatus | string;
  className?: string;
}

/**
 * Shared publication lifecycle badge mapping {@link PostStatus} consistently across admin views.
 */
export function StatusBadge({ status, className }: StatusBadgeProps): React.JSX.Element {
  const t = useTranslations("admin");
  const normalized = (status in STATUS_VARIANTS ? status : POST_STATUS.DRAFT) as PostStatus;

  return (
    <Badge variant={STATUS_VARIANTS[normalized]} className={className}>
      {t(STATUS_LABEL_KEYS[normalized])}
    </Badge>
  );
}
