type VisibilityDocument = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;

/** What a read tells the loop: go on, or stop (the API asked to wait). */
export type TickResult = 'continue' | 'stop';

/** Why the loop stopped by itself: the time cap ran out, or a read asked it to stop. */
export type PollStop = 'idle' | 'stopped';

export interface PollOptions {
  /** Reads stop after the document was visible this long since the loop started: a forgotten view stops reading. */
  stopAfterMs: number;
  /** Called once when the loop stops by itself; not when the caller stops it. */
  onStop?: (reason: PollStop) => void;
  doc?: VisibilityDocument;
  now?: () => number;
}

/**
 * Calls `tick` every `intervalMs`, but only while the document is visible: a hidden tab does not
 * read the inbox. The next read starts after the previous one settled, so a slow answer never
 * piles up reads, and showing the tab again reads at once. The reads spend the seller's API key
 * budget (per account, shared by every key), so the loop ends after `stopAfterMs` of visible time
 * (hidden time reads nothing, so it does not count) or when a read returns 'stop', and says why.
 * Returns what stops it.
 */
export function startVisiblePolling(
  tick: () => Promise<TickResult | void> | TickResult | void,
  intervalMs: number,
  { stopAfterMs, onStop, doc = document, now = Date.now }: PollOptions,
): () => void {
  let visibleMs = 0;
  let visibleSince: number | null = doc.visibilityState === 'visible' ? now() : null;
  const visibleTime = (): number => visibleMs + (visibleSince === null ? 0 : now() - visibleSince);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let running = false;

  const clear = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const stop = (): void => {
    stopped = true;
    clear();
    doc.removeEventListener('visibilitychange', onVisibility);
  };
  const halt = (reason: PollStop): void => {
    if (stopped) return;
    stop();
    onStop?.(reason);
  };
  const schedule = (): void => {
    clear();
    if (stopped || doc.visibilityState !== 'visible') return;
    timer = setTimeout(() => void run(), intervalMs);
  };
  async function run(): Promise<void> {
    timer = undefined;
    if (stopped || running || doc.visibilityState !== 'visible') return;
    if (visibleTime() >= stopAfterMs) {
      halt('idle');
      return;
    }
    running = true;
    let result: TickResult | void = 'continue';
    try {
      result = await tick();
    } catch {
      // A failed read is tried again on the next beat.
    } finally {
      running = false;
    }
    if (result === 'stop') halt('stopped');
    else schedule();
  }
  function onVisibility(): void {
    if (doc.visibilityState === 'visible') {
      visibleSince ??= now();
      void run();
      return;
    }
    if (visibleSince !== null) visibleMs += now() - visibleSince;
    visibleSince = null;
    clear();
  }

  doc.addEventListener('visibilitychange', onVisibility);
  schedule();
  return stop;
}

const RETRY_AFTER = /Retry after (\d+) seconds/;

/**
 * The wait a tool error asks for, in seconds: the API answered 429 (the account's API key budget) or
 * 503, and the server's message carries the `Retry-After`. null for any other error.
 */
export function retryAfterSeconds(error: unknown): number | null {
  const match = error instanceof Error ? RETRY_AFTER.exec(error.message) : null;
  return match ? Number(match[1]) : null;
}
