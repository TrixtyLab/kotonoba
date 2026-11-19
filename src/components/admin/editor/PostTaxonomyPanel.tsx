"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Folder, Tag } from "lucide-react";

/** Props for {@link PostTaxonomyPanel}. */
export interface PostTaxonomyPanelProps {
  availableCategories: Array<{ id: string; name: string }>;
  selectedCategories: string[];
  onChangeCategories: (next: string[]) => void;
  localTags: Array<{ id: string; name: string }>;
  selectedTags: string[];
  onChangeTags: (next: string[]) => void;
  newTagInput: string;
  onNewTagInputChange: (val: string) => void;
  onAddTag: () => void;
}

/** Category checklist and inline tag creation/suggestion inspector panel. */
export function PostTaxonomyPanel({
  availableCategories,
  selectedCategories,
  onChangeCategories,
  localTags,
  selectedTags,
  onChangeTags,
  newTagInput,
  onNewTagInputChange,
  onAddTag,
}: PostTaxonomyPanelProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");

  return (
    <>
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-accent" />
            <span>{t("categories")}</span>
          </span>
        </div>

        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {availableCategories.map((c) => (
            <Checkbox
              key={c.id}
              checked={selectedCategories.includes(c.id)}
              onChange={(checked) => {
                if (checked) onChangeCategories([...selectedCategories, c.id]);
                else onChangeCategories(selectedCategories.filter((id) => id !== c.id));
              }}
              label={c.name}
              className="w-full"
            />
          ))}
          {availableCategories.length === 0 && <p className="text-xs text-text-muted">{t("noCategoriesYet")}</p>}
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-accent" />
            <span>{t("tags")}</span>
          </span>
        </div>

        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {selectedTags.map((tId) => {
              const tagObj = localTags.find((tag) => tag.id === tId);
              return (
                <span
                  key={tId}
                  className="inline-flex items-center gap-1 text-[11px] bg-accent/10 text-accent font-medium px-2 py-0.5 rounded-full border border-accent/20"
                >
                  #{tagObj?.name || tId}
                  <button
                    type="button"
                    onClick={() => onChangeTags(selectedTags.filter((id) => id !== tId))}
                    className="hover:text-rose-500 ml-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder={t("newTagPlaceholder")}
            value={newTagInput}
            onChange={(e) => onNewTagInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddTag();
              }
            }}
          />
          <Button size="sm" variant="secondary" onClick={onAddTag} className="text-xs shrink-0">
            {tc("add")}
          </Button>
        </div>

        {localTags.filter((tag) => !selectedTags.includes(tag.id)).length > 0 && (
          <div className="pt-1.5 border-t border-border/50">
            <p className="text-[11px] text-text-muted mb-1.5">{t("existingSuggestions")}</p>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {localTags
                .filter((tag) => !selectedTags.includes(tag.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onChangeTags([...selectedTags, tag.id])}
                    className="text-[11px] bg-surface-hover hover:bg-accent/10 hover:text-accent px-2 py-0.5 rounded border border-border transition-colors text-text-muted cursor-pointer"
                  >
                    + {tag.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
