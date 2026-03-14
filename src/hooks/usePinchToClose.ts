import { useMemo, useRef, type TouchEvent, type TouchList } from 'react';

interface UsePinchToCloseOptions {
  onPinchOut: () => void;
  direction?: 'in' | 'out';
  threshold?: number;
  disabled?: boolean;
}

interface PinchBind {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

const getDistance = (touches: TouchList): number => {
  if (touches.length < 2) {
    return 0;
  }

  const x = touches[0].clientX - touches[1].clientX;
  const y = touches[0].clientY - touches[1].clientY;

  return Math.hypot(x, y);
};

export const usePinchToClose = ({
  onPinchOut,
  direction = 'out',
  threshold = 36,
  disabled = false
}: UsePinchToCloseOptions): PinchBind => {
  const initialDistanceRef = useRef(0);
  const activeRef = useRef(false);

  return useMemo(
    () => ({
      onTouchStart: (event) => {
        if (disabled || event.touches.length < 2) {
          return;
        }

        initialDistanceRef.current = getDistance(event.touches);
        activeRef.current = true;
        event.preventDefault();
      },
      onTouchMove: (event) => {
        if (!activeRef.current || event.touches.length < 2) {
          return;
        }

        event.preventDefault();
        const distance = getDistance(event.touches);
        const delta = distance - initialDistanceRef.current;
        const reachedThreshold = direction === 'out' ? delta >= threshold : -delta >= threshold;

        if (reachedThreshold) {
          activeRef.current = false;
          onPinchOut();
        }
      },
      onTouchEnd: () => {
        if (activeRef.current) {
          activeRef.current = false;
        }
      },
      onTouchCancel: () => {
        activeRef.current = false;
      }
    }),
    [direction, disabled, onPinchOut, threshold]
  );
};
