"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Properties configuring the dialog Modal component.
 */
export interface ModalProps {
  /** Visibility toggle. */
  isOpen: boolean;
  /** Callback fired when user requests modal dismissal. */
  onClose: () => void;
  /** Modal header title string. */
  title: string;
  /** Contained body content node. */
  children: ReactNode;
  /** Maximum width container class constraint. */
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

/**
 * Accessible dialog modal overlay with keyboard Escape handling, body scroll locking, and backdrop blur.
 * Features responsive max-height constraints and internal scrolling for mobile ergonomics.
 *
 * @param {ModalProps} props - Configuration properties specifying visibility, title, child components, and max width.
 * @returns {React.JSX.Element | null} React JSX dialog portal or null when closed.
 */
export function Modal({ isOpen, onClose, title, children, maxWidth = "md" }: ModalProps): React.JSX.Element | null {
  const t = useTranslations("common");
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxW = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div
        className={`relative w-full ${maxW[maxWidth]} glass-strong rounded-2xl shadow-2xl border border-border p-4 sm:p-6 z-10 animate-slide-up max-h-[90dvh] flex flex-col`}
      >
        <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-border/50 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-text truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t("closeModal")}
            className="p-2 -mr-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 pr-0.5">{children}</div>
      </div>
    </div>
  );
}
