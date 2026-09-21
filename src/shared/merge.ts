function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merges a partial edit into a stored document, for APIs that replace a field whole.
 * Objects merge key by key; arrays, primitives and `null` replace; `undefined` leaves the key.
 */
export function mergeDeep<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) result[key] = mergeDeep(result[key], value);
  }
  return result as T;
}
