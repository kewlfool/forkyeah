export type StackGestureAxis = 'x' | 'y' | null;
export type StackSwipeDirection = -1 | 0 | 1;

export const STACK_AXIS_LOCK_DISTANCE_PX = 8;
export const STACK_HORIZONTAL_DOMINANCE_RATIO = 1;
export const STACK_VERTICAL_DOMINANCE_RATIO = 1.45;
export const STACK_SWIPE_COMMIT_RATIO = 0.12;
export const STACK_SWIPE_VELOCITY_PX_PER_MS = 0.3;
export const STACK_CARD_TRANSITION_MS = 220;

export const resolveStackGestureAxis = (deltaX: number, deltaY: number): StackGestureAxis => {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < STACK_AXIS_LOCK_DISTANCE_PX) {
    return null;
  }

  if (absX > absY * STACK_HORIZONTAL_DOMINANCE_RATIO) {
    return 'x';
  }

  if (absY > absX * STACK_VERTICAL_DOMINANCE_RATIO) {
    return 'y';
  }

  return null;
};

export const resolveStackSwipeDirection = (
  deltaX: number,
  elapsedMs: number,
  width: number
): StackSwipeDirection => {
  const safeWidth = Math.max(width, 1);
  const progress = Math.abs(deltaX) / safeWidth;
  const velocity = elapsedMs > 0 ? Math.abs(deltaX) / elapsedMs : 0;

  if (progress < STACK_SWIPE_COMMIT_RATIO && velocity < STACK_SWIPE_VELOCITY_PX_PER_MS) {
    return 0;
  }

  return deltaX < 0 ? -1 : 1;
};
