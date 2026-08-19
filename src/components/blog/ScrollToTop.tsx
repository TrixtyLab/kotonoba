"use client";

import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating action button appearing upon downward scrolling to smoothly return the viewport to the top.
 *
 * @returns React JSX floating button element or null when scroll offset is minimal.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll(): void {
      setVisible(window.scrollY > 300);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Volver arriba"
      className="fixed bottom-8 right-8 z-40 w-11 h-11 bg-surface border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-all shadow-xs cursor-pointer"
    >
      <ArrowUp className="w-5 h-5 stroke-[1.5]" />
    </button>
  );
}
