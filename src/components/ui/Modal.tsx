"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

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
 *
 * @param props - ModalProps configuring visibility, header title, width, and dismissal callback.
 * @returns React JSX dialog portal or null when closed.
 */
export function Modal({ isOpen, onClose, title, children, maxWidth = "md" }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div
        className={`relative w-full ${maxW[maxWidth]} glass-strong rounded-xl shadow-2xl border border-border p-6 z-10 animate-slide-up`}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/50">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
