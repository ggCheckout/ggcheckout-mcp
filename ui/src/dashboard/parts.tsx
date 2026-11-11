import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/** DashboardSurface: the card, with its variant and its Seasons corner art. */
export function Surface({ className, children }: { className: string; children: ReactNode }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info" title={text} aria-label={text} role="img">
      <Info size={16} aria-hidden />
    </span>
  );
}

/** The dashboard's segmented toggle (`dashboardSurfaceRowClassName` + buttons). */
export function Segmented<T extends string>({
  options, active, onPick, tight = false, className = '',
}: { options: [T, string][]; active: T; onPick: (value: T) => void; tight?: boolean; className?: string }) {
  return (
    <div className={`row segmented${tight ? ' tight' : ''} ${className}`} role="group">
      {options.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={value === active} onClick={() => value !== active && onPick(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** KPI tile of the full panel and the refunds focus: the `metric` surface, neutral tone. */
export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric neutral kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value num">{value}</p>
    </div>
  );
}

/** The view header: the GG eyebrow, an optional title and, on the right, the view's controls. */
export function ViewHeader({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="head">
      <div>
        <p className="eyebrow brand">GGCheckout</p>
        {title && <h1 className="display">{title}</h1>}
      </div>
      {children}
    </div>
  );
}
