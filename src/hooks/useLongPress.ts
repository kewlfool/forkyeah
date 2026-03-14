import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  delay?: number;
  disabled?: boolean;
  shouldStart?: (event: ReactPointerEvent<HTMLElement>) => boolean;
  moveThreshold?: number;
}

interface LongPressBind {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
}

export const useLongPress = ({
  onLongPress,
  delay = 420,
  disabled = false,
  shouldStart,
  moveThreshold = 8
}: UseLongPressOptions): LongPressBind => {
  const timerRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPointRef.current = null;
  }, []);

  const startTimer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }

      if (shouldStart && !shouldStart(event)) {
        return;
      }

      clearTimer();
      startPointRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId
      };

      timerRef.current = window.setTimeout(() => {
        onLongPress();
        timerRef.current = null;
        startPointRef.current = null;
      }, delay);
    },
    [clearTimer, delay, disabled, onLongPress, shouldStart]
  );

  const handleMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (timerRef.current === null || !startPointRef.current) {
        return;
      }

      if (event.pointerId !== startPointRef.current.pointerId) {
        return;
      }

      const dx = event.clientX - startPointRef.current.x;
      const dy = event.clientY - startPointRef.current.y;
      if (Math.hypot(dx, dy) > moveThreshold) {
        clearTimer();
      }
    },
    [clearTimer, moveThreshold]
  );

  useEffect(() => clearTimer, [clearTimer]);

  return {
    onPointerDown: startTimer,
    onPointerMove: handleMove,
    onPointerUp: clearTimer,
    onPointerCancel: clearTimer,
    onPointerLeave: clearTimer
  };
};
