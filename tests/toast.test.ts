import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION_MS, createToastScheduler } from '../src/toast.js';

describe('toast scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a newer toast visible for its full duration', () => {
    let message = '';
    const scheduler = createToastScheduler((text) => {
      message = text;
    });

    scheduler.show('first');
    vi.advanceTimersByTime(3000);
    scheduler.show('second');

    // The first toast's timer would have fired during this window if it had not been cancelled.
    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(message).toBe('second');

    vi.advanceTimersByTime(1);
    expect(message).toBe('');
  });

  it('does not update state after cancel, which is what the unmount cleanup calls', () => {
    const setMessage = vi.fn();
    const scheduler = createToastScheduler(setMessage);

    scheduler.show('pending');
    expect(setMessage).toHaveBeenCalledTimes(1);

    scheduler.cancel();
    vi.advanceTimersByTime(TOAST_DURATION_MS * 2);

    expect(setMessage).toHaveBeenCalledTimes(1);
    expect(setMessage).toHaveBeenCalledWith('pending');
  });
});
