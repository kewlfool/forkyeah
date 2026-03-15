import { useEffect } from 'react';

interface OverlayPresenceEntry {
  id: number;
  backgroundColor: string;
}

const overlayPresenceStack: OverlayPresenceEntry[] = [];
let nextOverlayPresenceId = 1;

const syncDocumentOverlayBackground = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const activeEntry = overlayPresenceStack[overlayPresenceStack.length - 1] ?? null;

  if (!activeEntry) {
    delete root.dataset.overlayActive;
    delete root.dataset.overlayCount;
    root.style.removeProperty('--document-overlay-bg');
    return;
  }

  root.dataset.overlayActive = 'true';
  root.dataset.overlayCount = String(overlayPresenceStack.length);
  root.style.setProperty('--document-overlay-bg', activeEntry.backgroundColor);
};

export const useDocumentOverlayPresence = (active: boolean, backgroundColor: string): void => {
  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      return;
    }

    const entry: OverlayPresenceEntry = {
      id: nextOverlayPresenceId,
      backgroundColor
    };
    nextOverlayPresenceId += 1;

    overlayPresenceStack.push(entry);
    syncDocumentOverlayBackground();

    return () => {
      const entryIndex = overlayPresenceStack.findIndex((candidate) => candidate.id === entry.id);
      if (entryIndex >= 0) {
        overlayPresenceStack.splice(entryIndex, 1);
      }
      syncDocumentOverlayBackground();
    };
  }, [active, backgroundColor]);
};
