import '../styles/controls.css';

/** FilterSegments: one choice among a few, as pills; the active one in the CTA blue. */
export function Pills<T extends string>({ label, options, value, onPick }: {
  label: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T | null;
  onPick: (value: T) => void;
}) {
  return (
    <div className="pills" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={key === value} onClick={() => key !== value && onPick(key)}>{text}</button>
      ))}
    </div>
  );
}
