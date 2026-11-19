/** The message of a caught value; empty when it is not an Error, so callers pick their own fallback. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '';
}
