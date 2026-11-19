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

const SAO_PAULO = 'America/Sao_Paulo';
const dateTimeParts = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function partsOf(iso: string | null): Record<string, string> | null {
  const date = parseDate(iso);
  if (!date) return null;
  return Object.fromEntries(dateTimeParts.formatToParts(date).map((p) => [p.type, p.value]));
}

/** dd/mm/yyyy in São Paulo; a dash when there is no date. */
export function formatDate(iso: string | null): string {
  const p = partsOf(iso);
  return p ? `${p.day}/${p.month}/${p.year}` : '-';
}

/**
 * dd/mm/yyyy HH:mm (HH:mm:ss with `seconds`) in São Paulo; a dash when there is no date.
 * `separator` is what sits between the day and the time.
 */
export function formatDateTime(iso: string | null, { separator = ' ', seconds = false } = {}): string {
  const p = partsOf(iso);
  return p ? `${p.day}/${p.month}/${p.year}${separator}${p.hour}:${p.minute}${seconds ? `:${p.second}` : ''}` : '-';
}

/** "1 aula", "3 aulas". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
