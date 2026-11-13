import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

/** Last resort when the host denies the Clipboard API: a hidden textarea and execCommand('copy'). */
function copyWithSelection(value: string): boolean {
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand?.('copy') === true;
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** Copies a value and reports 'copied' or 'failed' for 1.5 s, then goes back to 'idle'. */
export function useCopy(): [CopyState, (value: string) => Promise<void>] {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (value: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = copyWithSelection(value);
    }
    clearTimeout(timer.current);
    setState(ok ? 'copied' : 'failed');
    timer.current = setTimeout(() => setState('idle'), 1500);
  }, []);
  return [state, copy];
}

/** Short pt-BR note for the failed state, shown next to the copy button. */
export const COPY_FAILED_TEXT = 'Não deu para copiar';
