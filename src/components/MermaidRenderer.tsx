"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "./ThemeProvider";
import { generateId } from "@/lib/utils/slug";

/**
 * Dynamically renders Mermaid diagrams in both light and dark modes with error fallbacks.
 */
export function MermaidRenderer({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (!chart.trim()) return;

      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "loose",
          fontFamily: "Inter, sans-serif",
        });

        const id = `mermaid-${generateId()}`;
        const { svg } = await mermaid.render(id, chart);

        if (isMounted) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Invalid Mermaid syntax";
          setError(message);
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, theme]);

  if (error) {
    return (
      <div className="p-3 my-3 bg-danger/10 border border-danger/30 rounded-md text-xs font-mono text-danger">
        <p className="font-semibold mb-1">Diagram Syntax Error:</p>
        <pre className="overflow-x-auto">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-6 p-4 rounded-lg bg-surface/50 border border-border flex justify-center items-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
