import { useEffect, useRef } from 'react';
import '../styles/confirm.css';

/**
 * The confirmation every write from a card goes through: it says what the action does, and nothing
 * is sent until the confirm button is pressed. The confirm button takes the focus when it opens.
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
  useEffect(() => confirmRef.current?.focus(), []);
  return (
    <div className="confirm-panel" role="alertdialog" aria-label={label} data-tone={tone}>
      {title && <p className="confirm-title">{title}</p>}
      <p>{message}</p>
      <div className="confirm-actions">
        <button type="button" className="confirm-cancel" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className="cta" ref={confirmRef} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </div>
  );
}
