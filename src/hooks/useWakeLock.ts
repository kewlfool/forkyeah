import { useEffect, useRef } from 'react';

type WakeLockSentinel = {
  release: () => Promise<void>;
  released: boolean;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>;
  };
};

export const useWakeLock = (): void => {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return undefined;
    }

    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock?.request) {
      return undefined;
    }

    let cancelled = false;

    const requestLock = async () => {
      if (cancelled) {
        return;
      }

      try {
        const sentinel = await nav.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }

        sentinelRef.current = sentinel;
        const handleRelease = () => {
          sentinelRef.current = null;
          if (!cancelled && document.visibilityState === 'visible') {
            void requestLock();
          }
        };

        sentinel.addEventListener?.('release', handleRelease);
      } catch {
        // Wake lock is best-effort.
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestLock();
      } else if (sentinelRef.current && !sentinelRef.current.released) {
        void sentinelRef.current.release();
      }
    };

    void requestLock();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinelRef.current && !sentinelRef.current.released) {
        void sentinelRef.current.release();
      }
    };
  }, []);
};
