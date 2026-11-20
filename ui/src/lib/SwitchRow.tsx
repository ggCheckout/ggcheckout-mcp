import { useId } from 'react';
import '../styles/controls.css';

/**
 * The dashboard's SwitchRow: the name on the left, the reason or hint under it and the switch on the
 * right. A locked option says why in its hint instead of fading out.
 */
export function SwitchRow({ label, hint, checked, disabled = false, onChange }: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="switch-row">
      <div className="switch-text">
        <label htmlFor={id} className="switch-label">{label}</label>
        {hint && <p className="switch-hint" id={`${id}-hint`}>{hint}</p>}
      </div>
      <button id={id} type="button" role="switch" className="switch" aria-checked={checked} aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled} onClick={() => onChange(!checked)}>
        <span className="switch-thumb" aria-hidden />
      </button>
    </div>
  );
}
