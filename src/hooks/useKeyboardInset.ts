import { useEffect, useState } from 'react';

const KEYBOARD_INSET_THRESHOLD = 80;

const measureKeyboardInset = (): number => {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return 0;
  }

  const viewport = window.visualViewport;
  const rawInset = Math.round(window.innerHeight - viewport.height - viewport.offsetTop);

  if (rawInset <= KEYBOARD_INSET_THRESHOLD) {
    return 0;
  }

  return rawInset;
};

export const useKeyboardInset = (enabled = true): number => {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.visualViewport) {
      setKeyboardInset(0);
      return undefined;
    }

    const viewport = window.visualViewport;
    const syncInset = () => {
      setKeyboardInset(measureKeyboardInset());
    };

    syncInset();
    viewport.addEventListener('resize', syncInset);
    viewport.addEventListener('scroll', syncInset);
    window.addEventListener('resize', syncInset);
    window.addEventListener('orientationchange', syncInset);

    return () => {
      viewport.removeEventListener('resize', syncInset);
      viewport.removeEventListener('scroll', syncInset);
      window.removeEventListener('resize', syncInset);
      window.removeEventListener('orientationchange', syncInset);
    };
  }, [enabled]);

  return keyboardInset;
};
