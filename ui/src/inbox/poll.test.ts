import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVisiblePolling } from './poll';

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
    const stop = startVisiblePolling(tick, 10_000, doc as any);
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
    const stop = startVisiblePolling(tick, 10_000, doc as any);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
    stop();
  });

  it('stops when the tab is hidden and reads at once when it is shown again', async () => {
    const { doc, show } = fakeDocument();
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startVisiblePolling(tick, 10_000, doc as any);
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
    const stop = startVisiblePolling(tick, 10_000, doc as any);
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
    const stop = startVisiblePolling(tick, 10_000, doc as any);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stop() clears the timer and the listener for good', async () => {
    const { doc, show, listeners } = fakeDocument();
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startVisiblePolling(tick, 10_000, doc as any);
    stop();
    expect(listeners.size).toBe(0);
    show('visible');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
  });
});
