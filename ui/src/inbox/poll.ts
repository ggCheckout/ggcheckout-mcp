type VisibilityDocument = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;

/**
 * Calls `tick` every `intervalMs`, but only while the document is visible: a hidden tab does not
 * read the inbox. The next read starts after the previous one settled, so a slow answer never
 * piles up reads, and showing the tab again reads at once. Returns what stops it.
 */
export function startVisiblePolling(
  tick: () => Promise<unknown> | unknown,
  intervalMs: number,
  doc: VisibilityDocument = document,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let running = false;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    clear();
    if (stopped || doc.visibilityState !== 'visible') return;
    timer = setTimeout(run, intervalMs);
  };
  async function run() {
    timer = undefined;
    if (stopped || running || doc.visibilityState !== 'visible') return;
    running = true;
    try {
      await tick();
    } catch {
      // A failed read is tried again on the next beat.
    } finally {
      running = false;
      schedule();
    }
  }
  const onVisibility = () => {
    if (doc.visibilityState === 'visible') void run();
    else clear();
  };

  doc.addEventListener('visibilitychange', onVisibility);
  schedule();
  return () => {
    stopped = true;
    clear();
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
