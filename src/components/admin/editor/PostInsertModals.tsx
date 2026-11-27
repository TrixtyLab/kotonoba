"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PlaySquare } from "lucide-react";

/** Props for {@link PostInsertModals}. */
export interface PostInsertModalsProps {
  embedModalOpen: boolean;
  setEmbedModalOpen: (open: boolean) => void;
  embedUrl: string;
  setEmbedUrl: (val: string) => void;
  onInsertEmbed: () => void;
  linkModalOpen: boolean;
  setLinkModalOpen: (open: boolean) => void;
  linkUrl: string;
  setLinkUrl: (val: string) => void;
  hasActiveLink: boolean;
  onSaveLink: () => void;
  onRemoveLink: () => void;
}

/** Rich embed and inline link insertion modals for the editor. */
export function PostInsertModals({
  embedModalOpen,
  setEmbedModalOpen,
  embedUrl,
  setEmbedUrl,
  onInsertEmbed,
  linkModalOpen,
  setLinkModalOpen,
  linkUrl,
  setLinkUrl,
  hasActiveLink,
  onSaveLink,
  onRemoveLink,
}: PostInsertModalsProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");

  return (
    <>
      <Modal isOpen={embedModalOpen} onClose={() => setEmbedModalOpen(false)} title={t("embedModalTitle")}>
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">{t("embedModalDesc")}</p>

          <Input
            label={t("embedInputLabel")}
            placeholder={t("embedInputPlaceholder")}
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            helperText={t("embedHelperText")}
          />

          <div className="p-3 bg-surface-hover/30 border border-border rounded-lg space-y-1.5 text-text-muted">
            <p className="font-semibold text-text">{t("supportedFormats")}</p>
            <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
              <li><strong>Steam:</strong> steam:1299800 o store.steampowered.com/app/1299800/</li>
              <li><strong>itch.io:</strong> itch:2548291 o itch.io/embed/2548291</li>
              <li><strong>YouTube:</strong> https://www.youtube.com/watch?v=...</li>
              <li><strong>X / Twitter:</strong> https://x.com/...</li>
              <li><strong>Bluesky:</strong> https://bsky.app/...</li>
              <li><strong>Iframes:</strong> &lt;iframe src=&quot;...&quot;&gt;&lt;/iframe&gt;</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setEmbedModalOpen(false)} className="text-xs">
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={onInsertEmbed}
              disabled={!embedUrl.trim()}
              icon={<PlaySquare className="w-4 h-4" />}
              className="text-xs"
            >
              {t("insertEmbed")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={linkModalOpen} onClose={() => setLinkModalOpen(false)} title={t("linkModalTitle")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveLink();
          }}
          className="space-y-4 text-xs"
        >
          <Input
            label={t("linkUrlLabel")}
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            helperText={t("linkUrlHelper")}
            autoFocus
          />

          <div className="flex justify-between items-center pt-2 border-t border-border">
            {hasActiveLink ? (
              <Button type="button" variant="danger" onClick={onRemoveLink} className="text-xs">
                {t("removeLink")}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setLinkModalOpen(false)} className="text-xs">
                {tc("cancel")}
              </Button>
              <Button type="submit" variant="primary" className="text-xs">
                {t("saveLink")}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
