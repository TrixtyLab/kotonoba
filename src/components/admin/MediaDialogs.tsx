"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { MediaFileItem } from "@/components/admin/MediaManagerClient";

/** Props for {@link MediaDialogs}. */
export interface MediaDialogsProps {
  siteDomain: string;
  currentFolder: string;
  newFolderModalOpen: boolean;
  onCloseNewFolderModal: () => void;
  newFolderName: string;
  onChangeNewFolderName: (value: string) => void;
  onCreateFolder: () => void;
  moveTargetFile: MediaFileItem | null;
  onCloseMoveModal: () => void;
  targetDestinationFolder: string;
  onChangeTargetDestinationFolder: (value: string) => void;
  isMoving: boolean;
  onMoveFile: () => void;
  previewFile: MediaFileItem | null;
  previewDisplayUrl?: string;
  onClosePreviewModal: () => void;
  onCopyUrl: (url: string) => void;
  deleteTarget: { path: string; name: string; isFolder: boolean } | null;
  onCloseDeleteModal: () => void;
  isDeleting: boolean;
  onConfirmDelete: () => void;
}

/**
 * Dialog suite supporting media folder creation, asset relocation, image preview, and delete confirmation.
 */
export function MediaDialogs({
  siteDomain,
  currentFolder,
  newFolderModalOpen,
  onCloseNewFolderModal,
  newFolderName,
  onChangeNewFolderName,
  onCreateFolder,
  moveTargetFile,
  onCloseMoveModal,
  targetDestinationFolder,
  onChangeTargetDestinationFolder,
  isMoving,
  onMoveFile,
  previewFile,
  previewDisplayUrl,
  onClosePreviewModal,
  onCopyUrl,
  deleteTarget,
  onCloseDeleteModal,
  isDeleting,
  onConfirmDelete,
}: MediaDialogsProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");

  return (
    <>
      <Modal
        isOpen={newFolderModalOpen}
        onClose={onCloseNewFolderModal}
        title={t("newFolder")}
      >
        <div className="space-y-3 text-xs">
          <Input
            label={t("folderName")}
            placeholder={t("folderNamePlaceholder")}
            value={newFolderName}
            onChange={(e) => onChangeNewFolderName(e.target.value)}
            helperText={`/${currentFolder || t("root")}`}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={onCloseNewFolderModal}>
              {tc("cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={onCreateFolder}>
              {t("createFolder")}
            </Button>
          </div>
        </div>
      </Modal>

      {moveTargetFile && (
        <Modal
          isOpen={Boolean(moveTargetFile)}
          onClose={onCloseMoveModal}
          title={`${t("moveFile")}: "${moveTargetFile.filename}"`}
        >
          <div className="space-y-3 text-xs">
            <Input
              label={t("destinationFolder")}
              placeholder={t("destinationFolderPlaceholder")}
              value={targetDestinationFolder}
              onChange={(e) => onChangeTargetDestinationFolder(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={onCloseMoveModal}>
                {tc("cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onMoveFile}
                loading={isMoving}
              >
                {t("moveFile")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {previewFile &&
        (() => {
          const modalUrl = previewDisplayUrl || previewFile.url;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80  animate-fade-in">
              <div className="w-full max-w-xl bg-surface border border-border rounded-xl p-5 shadow-xl space-y-3 animate-slide-up">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h4 className="text-xs font-bold text-text truncate max-w-[80%]">
                    {previewFile.filename}
                  </h4>
                  <button
                    type="button"
                    onClick={onClosePreviewModal}
                    className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
                  >
                    ✕
                  </button>
                </div>

                <div className="max-h-[50vh] overflow-hidden rounded-lg bg-black/40 flex items-center justify-center p-2">
                  <img
                    src={`//${siteDomain}${previewFile.url}`}
                    alt={previewFile.filename}
                    className="max-h-[45vh] object-contain rounded"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
                  <span
                    className="font-mono text-text-muted truncate min-w-0 flex-1 text-[11px]"
                    title={modalUrl}
                  >
                    {modalUrl}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCopyUrl(modalUrl)}
                      icon={<Copy className="w-3.5 h-3.5" />}
                    >
                      {t("copyUrl")}
                    </Button>
                    <a
                      href={modalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface-hover text-xs font-semibold transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {tc("view")}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.isFolder ? t("deleteFolder") : t("deleteFile")}
        message={
          deleteTarget?.isFolder
            ? t("confirmDeleteFolder")
            : t("confirmDeleteFile")
        }
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={onConfirmDelete}
        onClose={onCloseDeleteModal}
      />
    </>
  );
}
