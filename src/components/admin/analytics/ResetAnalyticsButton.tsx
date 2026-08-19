"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { resetAnalyticsAction } from "@/actions/analytics";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";

/**
 * Properties configuring the ResetAnalyticsButton component.
 */
export interface ResetAnalyticsButtonProps {
  /** Target site identifier to clear analytics for. */
  siteId: string;
}

/**
 * Interactive button and confirmation modal for clearing all traffic and analytics data for a site.
 *
 * @param props - ResetAnalyticsButtonProps configuring target siteId.
 * @returns React JSX reset button and confirmation modal.
 */
export function ResetAnalyticsButton({ siteId }: ResetAnalyticsButtonProps) {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirmReset() {
    startTransition(async () => {
      const res = await resetAnalyticsAction(siteId);
      if (res.success) {
        toast.success(t("resetSuccess"));
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || t("resetError"));
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        icon={<RotateCcw className="w-3.5 h-3.5 text-danger/80" />}
        className="text-xs hover:border-danger hover:text-danger hover:bg-danger/5 transition-colors"
      >
        {t("resetAnalytics")}
      </Button>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmReset}
        title={t("resetAnalytics")}
        message={t("resetAnalyticsConfirm")}
        confirmText={t("resetConfirmBtn")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
    </>
  );
}
