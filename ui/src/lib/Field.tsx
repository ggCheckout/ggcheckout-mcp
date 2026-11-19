import type { ReactNode } from 'react';

/** A label/value row of a detail card; goes inside a <dl>. Each card scopes its own look to `.field`. */
export function Field({ label, children, valueClassName }: { label: string; children: ReactNode; valueClassName?: string }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={valueClassName}>{children}</dd>
    </div>
  );
}
