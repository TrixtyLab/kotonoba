"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";

/** Notification severity tier. */
export type ToastType = "success" | "error" | "info";

/** Active toast item data structure. */
export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Context provider and floating notification container managing auto-dismissing toast alerts.
 *
 * @param props - Children components tree.
 * @returns React JSX provider wrapping children with floating toast container.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const tc = useTranslations("common");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useMemo(
    () => ({
      success: (msg: string) => addToast("success", msg),
      error: (msg: string) => addToast("error", msg),
      info: (msg: string) => addToast("info", msg),
    }),
    [addToast]
  );

  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-md bg-surface text-text ${
              t.type === "success"
                ? "border-success/40"
                : t.type === "error"
                ? "border-danger/40"
                : "border-border"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-success" />}
              {t.type === "error" && <AlertCircle className="w-4 h-4 text-danger" />}
              {t.type === "info" && <Info className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-sm font-medium leading-relaxed flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-text-muted hover:text-text min-w-[32px] min-h-[32px] rounded-md transition-colors inline-flex items-center justify-center"
              aria-label={tc("closeNotification")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Custom React hook granting components access to the global notification toast dispatcher.
 *
 * @returns Toast dispatcher object with success, error, and info triggers.
 * @throws {Error} When invoked outside of an active ToastProvider.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}
