"use client";

import React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface SettingsFormProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  isPending?: boolean;
  children: React.ReactNode;
  maxWidthClass?: string;
}

/**
 * Unified administrative settings shell providing consistent section header typography,
 * constrained content layout, and an optional persistent Save submission bar.
 */
export function SettingsForm({
  title,
  description,
  icon,
  onSave,
  saveLabel,
  isPending = false,
  children,
  maxWidthClass = "max-w-2xl",
}: SettingsFormProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>

      <div className={`space-y-6 ${maxWidthClass}`}>{children}</div>

      {onSave && saveLabel && (
        <div className="pt-4 border-t border-border flex justify-end">
          <Button
            type="button"
            variant="primary"
            onClick={onSave}
            loading={isPending}
            icon={<Save className="w-4 h-4" />}
            className="text-xs"
          >
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
