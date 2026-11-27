"use client";

import { useEffect, useState } from "react";

/**
 * Tracks unsaved editor form dirtiness against the last saved JSON snapshot,
 * guards browser tab unload via `beforeunload`, and coordinates in-app leave confirmations.
 */
export function useUnsavedChangesGuard(snapshotValue: string, onConfirmedLeave: () => void) {
  const [savedSnapshot, setSavedSnapshot] = useState(snapshotValue);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const isDirty = snapshotValue !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleNavigateBack() {
    if (isDirty) {
      setLeaveConfirmOpen(true);
      return;
    }
    onConfirmedLeave();
  }

  function handleConfirmLeave() {
    setLeaveConfirmOpen(false);
    onConfirmedLeave();
  }

  return {
    isDirty,
    markSavedSnapshot: setSavedSnapshot,
    leaveConfirmOpen,
    setLeaveConfirmOpen,
    handleNavigateBack,
    handleConfirmLeave,
  };
}
