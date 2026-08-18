import { Link } from "@/i18n/routing";
import { Bot, Rss, Shield } from "lucide-react";

export interface FooterProps {
  siteName: string;
  subtitle?: string | null;
  categories: Array<{ id: string; name: string; slug: string }>;
}

/**
 * Public blog footer with AI search engine discovery links (llms.txt), category index, and copyright.
 */
export function Footer({ siteName, subtitle, categories }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-surface/30 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs">
                K
              </div>
              <span className="font-bold text-base text-text">{siteName}</span>
            </div>
            {subtitle && <p className="text-xs text-text-muted max-w-sm">{subtitle}</p>}
            <p className="text-[11px] text-text-muted">
              Powered by <span className="text-text font-semibold">Kotonoba</span> — Next.js 16 Multi-Tenant CMS.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text">Categories</h4>
            <ul className="space-y-1.5 text-xs text-text-muted">
              {categories.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="hover:text-primary transition-colors">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text">Feeds & AI Discovery</h4>
            <ul className="space-y-2 text-xs text-text-muted">
              <li>
                <a
                  href="/llms.txt"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-accent hover:underline font-mono text-[11px]"
                >
                  <Bot className="w-3.5 h-3.5" />
                  /llms.txt (AI Index)
                </a>
              </li>
              <li>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-text"
                >
                  <Rss className="w-3.5 h-3.5" />
                  Sitemap XML
                </a>
              </li>
              <li>
                <Link href="/admin" className="flex items-center gap-1.5 hover:text-text">
                  <Shield className="w-3.5 h-3.5" />
                  Admin Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-4">
          <p>© {currentYear} {siteName}. All rights reserved.</p>
          <p className="text-[11px]">Crafted with Next.js 16, Tailwind CSS v4 & SQLite.</p>
        </div>
      </div>
    </footer>
  );
}
