/** A tool's structuredContent as it arrives: JSON from the API, not checked by the compiler. */
export type Payload = Record<string, any>;

export const isPayload = (value: unknown): value is Payload =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
