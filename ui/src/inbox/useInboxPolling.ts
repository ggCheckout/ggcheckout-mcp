import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_FOR_MS, POLL_MS, type PollPause } from './model';
import { retryAfterSeconds, startVisiblePolling, type TickResult } from './poll';

export interface InboxPolling {
  /** Why the automatic reads stopped; null while they run. */
  pause: PollPause | null;
  /** One read now, under the same rule as the beats (a 429/503 pauses). */
  read: () => Promise<TickResult>;
  /** Clears the pause and reads at once; the beats start again. */
  resume: () => void;
}

/**
 * The inbox's reads within the account's API key budget: `load` runs every 10 s while the tab is
 * visible and `held` is false, for 15 minutes; a 429/503 (the message carries the Retry-After) stops
 * them instead of repeating them every beat. Either stop shows as `pause`, and `resume` starts again.
 * `onError` gets every other failure.
 */
export function useInboxPolling(load: () => Promise<void>, { held = false, onError }: { held?: boolean; onError?: (error: unknown) => void } = {}): InboxPolling {
  const [pause, setPause] = useState<PollPause | null>(null);
  // Read through a ref: a new callback each render must not restart the beats.
  const errorSink = useRef(onError);
  errorSink.current = onError;

  const read = useCallback(async (): Promise<TickResult> => {
    try {
      await load();
      return 'continue';
    } catch (error) {
      const wait = retryAfterSeconds(error);
      if (wait !== null) {
        setPause({ kind: 'rate', seconds: wait });
        return 'stop';
      }
      errorSink.current?.(error);
      return 'continue';
    }
  }, [load]);

  useEffect(() => {
    if (held || pause) return undefined;
    return startVisiblePolling(read, POLL_MS, {
      stopAfterMs: POLL_FOR_MS,
      onStop: (why) => {
        if (why === 'idle') setPause({ kind: 'idle' });
      },
    });
  }, [read, held, pause]);

  const resume = useCallback((): void => {
    setPause(null);
    void read();
  }, [read]);

  return { pause, read, resume };
}
