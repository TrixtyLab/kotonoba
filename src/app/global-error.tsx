"use client";

import React from "react";

interface GlobalErrorProps {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}

/**
 * Root Next.js App Router global error boundary catching failures in the root layout shell
 * without exposing raw server error details in production.
 */
export default function GlobalError({ error, retry, reset }: GlobalErrorProps): React.JSX.Element {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";

  const handleRetry = () => {
    if (typeof retry === "function") retry();
    else if (typeof reset === "function") reset();
    else window.location.reload();
  };

  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-[#f4f4f6] flex items-center justify-center p-6 font-sans antialiased">
        <main className="max-w-md w-full rounded-2xl border border-white/10 bg-[#12121a] p-6 space-y-4 text-center shadow-lg">
          <h1 className="text-lg font-bold tracking-tight">Something went wrong</h1>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            An unexpected error interrupted rendering. Please try reloading this view.
          </p>
          {digest && (
            <p className="text-[11px] font-mono text-[#71717a] break-all">
              Ref: {digest}
            </p>
          )}
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 rounded-lg bg-[#6366f1] text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
