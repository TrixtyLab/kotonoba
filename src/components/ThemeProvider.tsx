"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { Sun, Moon } from "lucide-react";

/** Supported color theme schemes. */
type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

/**
 * Hook providing access to the current theme state and toggle handler.
 *
 * @returns Object containing active theme mode and toggle function.
 */
export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Root theme context provider syncing active light/dark mode with localStorage and HTML root attributes.
 *
 * @param props - Children element tree.
 * @returns React JSX provider element.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const initial = stored || "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Interactive button component for toggling between dark and light color modes.
 *
 * @returns React JSX button toggle element.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-md hover:bg-surface-hover transition-colors duration-150 btn-press"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-text-muted" />
      ) : (
        <Moon className="w-5 h-5 text-text-muted" />
      )}
    </button>
  );
}
