import { useEffect, useRef, useState } from 'react';
import '../styles/confirm.css';

/**
 * Back to the opener when it can take the focus, else to the card (made focusable for this). Only when
 * the focus was lost with the panel: a focus something else took meanwhile stays where it is.
 */
function restoreFocus(opener: HTMLElement | null, card: HTMLElement | null): void {
  const lost = document.activeElement === null || document.activeElement === document.body;
  if (!lost) return;
  if (opener && opener !== document.body && opener.isConnected && !opener.matches(':disabled')) {
    opener.focus();
    return;
  }
  if (!card?.isConnected) return;
  if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1');
  card.focus();
}

/**
 * The confirmation every write from a card goes through: it says what the action does, and nothing
 * is sent until the confirm button is pressed. The confirm button takes the focus when it opens; Esc
 * cancels; and when it closes the focus goes back to where it was (the button that opened it), or to
 * the card when that button is gone, never to the page body.
 */
export function ConfirmPanel({ label, tone, title, message, confirmLabel, busyLabel, busy, onConfirm, onCancel }: {
  /** The accessible name of the dialog. */
  label: string;
  /** `warning` for an action that stops the chip from sending. */
  tone?: 'warning';
  /** A visible heading above the message, when the message alone is not enough. */
  title?: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Read while rendering, before this commit disables the opener (a disabled element loses the focus).
  const [opener] = useState<HTMLElement | null>(() => (
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  ));
  useEffect(() => {
    // The card around the panel: where the focus lands when the opener is gone or disabled.
    const card = panelRef.current?.parentElement?.closest<HTMLElement>('section, [role="region"]') ?? null;
    confirmRef.current?.focus();
    return () => {
      // After React removed the panel, so the opener is enabled again (it is disabled while open).
      queueMicrotask(() => restoreFocus(opener, card));
    };
  }, [opener]);
  return (
    <div className="confirm-panel" role="alertdialog" aria-label={label} data-tone={tone} ref={panelRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onCancel();
      }}>
      {title && <p className="confirm-title">{title}</p>}
      <p>{message}</p>
      <div className="confirm-actions">
        <button type="button" className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className="cta" ref={confirmRef} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </div>
  );
}
