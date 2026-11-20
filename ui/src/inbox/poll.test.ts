import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryAfterSeconds, startVisiblePolling } from './poll';

/** A cap far beyond what a test waits, for the tests about something else. */
const LONG = 24 * 3_600_000;

function fakeDocument(initial: 'visible' | 'hidden' = 'visible') {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: initial as DocumentVisibilityState,
    addEventListener: vi.fn((_: string, fn: () => void) => { listeners.add(fn); }),
    removeEventListener: vi.fn((_: string, fn: () => void) => { listeners.delete(fn); }),
  };
  const show = (state: 'visible' | 'hidden') => {
    doc.visibilityState = state;
    for (const fn of [...listeners]) fn();
  };
  return { doc, show, listeners };
}

describe('startVisiblePolling', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('reads every interval while the document is visible, and not before the first one', async () => {
    const { doc } = fakeDocument();
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startVisiblePolling(tick, 10_000, { stopAfterMs: LONG, doc: doc as any });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(tick).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('does not read while the document is hidden', async () => {
    const { doc } = fakeDocument('hidden');
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startVisiblePolling(tick, 10_000, { stopAfterMs: LONG, doc: doc as any });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
    stop();
  });

  it('stops when the tab is hidden and reads at once when it is shown again', async () => {
    const { doc, show } = fakeDocument();
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startVisiblePolling(tick, 10_000, { stopAfterMs: LONG, doc: doc as any });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(1);

    show('hidden');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(1);

    show('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('starts the next read after the previous one settled, so a slow answer does not pile up', async () => {
    const { doc } = fakeDocument();
    let release: () => void = () => {};
    const tick = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const stop = startVisiblePolling(tick, 10_000, { stopAfterMs: LONG, doc: doc as any });
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(50_000);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keeps going after a failed read', async () => {
    const { doc } = fakeDocument();
    const tick = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const stop = startVisiblePolling(tick, 10_000, { stopAfterMs: LONG, doc: doc as any });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stop() clears the timer and the listener for good', async () => {
    const { doc, show, listeners } = fakeDocument();
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startVisiblePolling(tick, 10_000, { stopAfterMs: LONG, doc: doc as any });
    stop();
    expect(listeners.size).toBe(0);
    show('visible');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
  });

  it('stops by itself after the time cap, says it went idle, and reads no more', async () => {
    const { doc, listeners } = fakeDocument();
    const tick = vi.fn().mockResolvedValue(undefined);
    const onStop = vi.fn();
    startVisiblePolling(tick, 10_000, { stopAfterMs: 30_000, onStop, doc: doc as any });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(onStop).toHaveBeenCalledWith('idle');
    expect(listeners.size).toBe(0);
  });

  it('stops when a read asks it to (the API said to wait)', async () => {
    const { doc } = fakeDocument();
    const tick = vi.fn().mockResolvedValueOnce('continue').mockResolvedValueOnce('stop').mockResolvedValue('continue');
    const onStop = vi.fn();
    startVisiblePolling(tick, 10_000, { stopAfterMs: LONG, onStop, doc: doc as any });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(onStop).toHaveBeenCalledWith('stopped');
  });

  it('does not call onStop when the caller stops it', async () => {
    const { doc } = fakeDocument();
    const onStop = vi.fn();
    const stop = startVisiblePolling(vi.fn(), 10_000, { stopAfterMs: LONG, onStop, doc: doc as any });
    stop();
    expect(onStop).not.toHaveBeenCalled();
  });
});

describe('retryAfterSeconds', () => {
  it('reads the wait the server put in a 429 or 503 message', () => {
    expect(retryAfterSeconds(new Error('Error: API key rate limit exceeded. Retry after 42 seconds.'))).toBe(42);
    expect(retryAfterSeconds(new Error('Error: API Error (404): Funil não encontrado.'))).toBeNull();
    expect(retryAfterSeconds('Retry after 5 seconds')).toBeNull();
  });
});
