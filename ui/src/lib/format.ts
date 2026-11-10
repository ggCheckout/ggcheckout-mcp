// Every amount these views receive is integer cents of BRL (the dashboard counters, the billing
// routes and the payments API alike), so formatting starts from cents.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const int = new Intl.NumberFormat('pt-BR');
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export function formatCents(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100);
}

export function formatInt(n: number | null | undefined): string {
  return int.format(n ?? 0);
}

/** A ratio in 0..1; a dash when there is nothing to divide. */
export function formatPercent(ratio: number | null | undefined): string {
  return ratio == null ? '–' : pct.format(ratio);
}

/** The API sends microseconds; Date only reads milliseconds everywhere. */
export function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(date.getTime()) ? null : date;
}
