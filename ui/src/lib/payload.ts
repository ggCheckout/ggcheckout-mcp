/** A tool's structuredContent as it arrives: JSON from the API, not checked by the compiler. */
export type Payload = Record<string, any>;

export const isPayload = (value: unknown): value is Payload =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** A non-blank string, trimmed; null for anything else. */
export const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** A finite number; null for anything else (NaN, Infinity, strings). */
export const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
