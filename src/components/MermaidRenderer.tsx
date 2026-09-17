"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTranslations } from "next-intl";
import { useTheme } from "./ThemeProvider";
import { generateId } from "@/lib/utils/slug";

/**
 * Dynamic client-side renderer for Mermaid flowchart and sequence diagrams with theme synchronization.
 *
 * @param {Object} props - Component properties.
 * @param {string} props.chart - Raw Mermaid graph definition string.
 * @returns {React.JSX.Element} React JSX SVG diagram container or localized syntax error fallback.
 */
export function MermaidRenderer({ chart }: { chart: string }) {
  const tc = useTranslations("common");
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    let isMounted = true;

    async function renderChart(): Promise<void> {
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
        <p className="font-semibold mb-1">{tc("diagramSyntaxError")}</p>
        <pre className="overflow-x-auto">{chart}</pre>
      </div>
    );
  }

  if (!svgHtml) {
    return (
      <div className="p-4 my-3 text-center text-text-muted text-xs bg-surface-hover/30 rounded-md animate-pulse">
        {tc("renderingDiagram")}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto p-4 bg-surface rounded-xl border border-border"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
