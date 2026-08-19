"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Info, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "./Button";

/**
 * Configuration properties for the ConfirmModal component.
 */
export interface ConfirmModalProps {
  /** Visibility toggle. */
  isOpen: boolean;
  /** Callback fired when user cancels or dismisses the dialog. */
  onClose: () => void;
  /** Callback fired when user confirms the pending action. */
  onConfirm: () => void | Promise<void>;
  /** Header title of the confirmation prompt. */
  title: string;
  /** Explanatory prompt message. */
  message: string;
  /** Label for the positive confirmation button. */
  confirmText?: string;
  /** Label for the cancel button. */
  cancelText?: string;
  /** Severity variant determining icon and button style. */
  variant?: "danger" | "warning" | "primary";
  /** Shows a loading state on the confirm button when true. */
  isLoading?: boolean;
}

/**
 * Accessible modal confirmation dialog component replacing native browser confirm() dialogs.
 *
 * @param props - ConfirmModalProps configuring prompt message, action handler, and severity styling.
 * @returns React JSX confirmation dialog element or null when inactive.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-md glass-strong p-6 rounded-2xl border border-border shadow-2xl z-10 animate-slide-up space-y-5"
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              variant === "danger"
                ? "bg-danger/15 text-danger border border-danger/30"
                : variant === "warning"
                ? "bg-warning/15 text-warning border border-warning/30"
                : "bg-primary/15 text-primary border border-primary/30"
            }`}
          >
            {variant === "danger" && <Trash2 className="w-5 h-5" />}
            {variant === "warning" && <AlertTriangle className="w-5 h-5" />}
            {variant === "primary" && <Info className="w-5 h-5" />}
          </div>

          <div className="space-y-1.5 flex-1 pr-4">
            <h3 id="confirm-modal-title" className="text-base font-bold text-text tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs"
          >
            {cancelText}
          </Button>

          <Button
            variant={variant === "danger" ? "danger" : "accent"}
            size="sm"
            onClick={() => onConfirm()}
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Procesando...</span>
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
