import { describe, expect, it } from 'vitest';
import {
  resolveStackGestureAxis,
  resolveStackSwipeDirection,
  STACK_AXIS_LOCK_DISTANCE_PX
} from './recipeStackGesture';

describe('recipeStackGesture', () => {
  it('does not lock an axis until movement clears the threshold', () => {
    expect(resolveStackGestureAxis(STACK_AXIS_LOCK_DISTANCE_PX - 1, 0)).toBeNull();
  });

  it('locks to horizontal when x movement clearly dominates', () => {
    expect(resolveStackGestureAxis(32, 10)).toBe('x');
  });

  it('locks to vertical when y movement dominates', () => {
    expect(resolveStackGestureAxis(8, 30)).toBe('y');
  });

  it('commits a swipe when distance passes the commit ratio', () => {
    expect(resolveStackSwipeDirection(-90, 300, 320)).toBe(-1);
    expect(resolveStackSwipeDirection(90, 300, 320)).toBe(1);
  });

  it('commits a swipe when velocity is high even if distance is shorter', () => {
    expect(resolveStackSwipeDirection(-40, 40, 320)).toBe(-1);
  });

  it('snaps back when neither distance nor velocity are sufficient', () => {
    expect(resolveStackSwipeDirection(32, 240, 320)).toBe(0);
  });
});
