"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createTag, deleteTag } from "@/actions/tags";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag as TagIcon, Plus } from "lucide-react";

export interface TagItem {
  id: string;
  name: string;
  slug: string;
}

/**
 * Tag management client component allowing addition, listing, and removal of site tags.
 */
export function TagsManagerClient({
  siteId,
  initialTags,
}: {
  siteId: string;
  initialTags: TagItem[];
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [tags, setTags] = useState(initialTags);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const res = await createTag(siteId, { name });
      if (res.success && res.id) {
        setTags((prev) => [...prev, { id: res.id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }]);
        setName("");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(tCommon("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteTag(id);
      if (res.success) {
        setTags((prev) => prev.filter((t) => t.id !== id));
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-text tracking-tight">{tCommon("tags")}</h1>
        <p className="text-xs text-text-muted">{t("tagsSubtitle")}</p>
      </div>

      <form onSubmit={handleCreate} className="glass p-5 rounded-xl border border-border flex gap-3 items-end">
        <div className="flex-1">
          <Input
            label={t("createTag")}
            placeholder={t("tagPlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" loading={isPending} icon={<Plus className="w-4 h-4" />}>
          {t("newTag")}
        </Button>
      </form>

      <div className="glass p-6 rounded-xl border border-border space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted pb-2 border-b border-border/50">
          {t("allTags")} ({tags.length})
        </h2>

        <div className="flex flex-wrap gap-2.5">
          {tags.map((tItem) => (
            <div
              key={tItem.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover border border-border text-xs font-medium text-text group hover:border-primary/50 transition-colors"
            >
              <TagIcon className="w-3.5 h-3.5 text-secondary" />
              <span>#{tItem.name}</span>
              <button
                onClick={() => handleDelete(tItem.id)}
                className="text-text-muted hover:text-danger ml-1 transition-colors"
                title={t("deleteTag")}
              >
                ✕
              </button>
            </div>
          ))}

          {tags.length === 0 && (
            <p className="text-xs text-text-muted py-4">{t("noTags")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
