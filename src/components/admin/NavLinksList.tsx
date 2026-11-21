"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  ExternalLink,
  Files,
  Home,
  Languages,
  Link2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NavIcon } from "@/components/blog/NavIcon";
import type { NavItemConfig } from "@/components/admin/NavigationManager";

/** Props for {@link NavLinksList}. */
export interface NavLinksListProps {
  items: NavItemConfig[];
  onMoveItem: (index: number, direction: "up" | "down") => void;
  onEditItem: (item: NavItemConfig) => void;
  onDeleteItem: (id: string) => void;
}

function NavItemIcon({ item }: { item: NavItemConfig }) {
  if (item.isSocial) return <NavIcon name={item.icon || "link"} className="w-3.5 h-3.5" />;
  if (item.isFixed) return <Home className="w-3.5 h-3.5 text-accent" />;
  if (item.url.startsWith("/p/")) return <Files className="w-3.5 h-3.5 text-emerald-400" />;
  return <Link2 className="w-3.5 h-3.5 text-blue-400" />;
}

function NavItemTypeBadge({
  item,
  t,
}: {
  item: NavItemConfig;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  if (item.isSocial) {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
        {t("navSocialBadge")}
      </span>
    );
  }
  if (item.isFixed) return null;
  if (item.url.startsWith("/p/")) {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
        {t("navPageBadge")}
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
      {t("navLinkBadge")}
    </span>
  );
}

function NavLinkRow({
  item,
  idx,
  total,
  onMoveItem,
  onEditItem,
  onDeleteItem,
  t,
  tc,
}: {
  item: NavItemConfig;
  idx: number;
  total: number;
  onMoveItem: (index: number, direction: "up" | "down") => void;
  onEditItem: (item: NavItemConfig) => void;
  onDeleteItem: (id: string) => void;
  t: ReturnType<typeof useTranslations<"settings">>;
  tc: ReturnType<typeof useTranslations<"common">>;
}) {
  const showLocaleBadge = !item.isFixed && !item.isSocial && Boolean(item.labels);
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:border-border-hover transition-colors gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onMoveItem(idx, "up")}
            disabled={idx <= 1 || item.isFixed}
            className="p-0.5 rounded hover:bg-surface-hover text-text-muted disabled:opacity-20"
            title={tc("previous")}
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onMoveItem(idx, "down")}
            disabled={idx === total - 1 || item.isFixed}
            className="p-0.5 rounded hover:bg-surface-hover text-text-muted disabled:opacity-20"
            title={tc("next")}
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>

        <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-accent shrink-0">
          <NavItemIcon item={item} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-text truncate">
              {item.isFixed ? tc("home").toUpperCase() : item.label}
            </span>
            {item.isFixed && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent uppercase">
                {tc("home")} ({t("general")})
              </span>
            )}
            {showLocaleBadge && item.labels && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-hover text-text-muted flex items-center gap-1">
                <Languages className="w-2.5 h-2.5" />
                <span>
                  ES: {item.labels.es || item.label} / EN: {item.labels.en || item.label}
                </span>
              </span>
            )}
            <NavItemTypeBadge item={item} t={t} />
            {item.target === "_blank" && (
              <span className="text-[10px] text-text-muted flex items-center gap-0.5" title={t("navNewTab")}>
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
          <span className="text-[10px] text-text-muted font-mono truncate block">{item.url}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditItem(item)}
          className="text-xs p-1.5 h-8 w-8 text-text-muted hover:text-text"
          title={tc("edit")}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        {!item.isFixed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteItem(item.id)}
            className="text-xs p-1.5 h-8 w-8 text-text-muted hover:text-danger"
            title={tc("delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Reorderable list of navbar items showing fixed-home guards, bilingual labels, badges, and row actions.
 */
export function NavLinksList({ items, onMoveItem, onEditItem, onDeleteItem }: NavLinksListProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <NavLinkRow
          key={item.id}
          item={item}
          idx={idx}
          total={items.length}
          onMoveItem={onMoveItem}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
          t={t}
          tc={tc}
        />
      ))}
    </div>
  );
}
