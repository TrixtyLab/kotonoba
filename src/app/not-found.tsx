import Link from "next/link";
import React from "react";

/**
 * Root-level 404 fallback page rendered when an unmatched URL outside `[locale]` resolves to `notFound()`.
 */
export default function RootNotFoundPage(): React.JSX.Element {
  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-6 text-center space-y-4 shadow-xs">
        <p className="text-xs font-mono uppercase tracking-widest text-accent">404</p>
        <h1 className="text-xl font-bold text-text">Page not found</h1>
        <p className="text-xs text-text-muted leading-relaxed">
          The requested page does not exist or is no longer available.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
