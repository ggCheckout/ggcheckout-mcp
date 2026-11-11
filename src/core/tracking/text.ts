/** Provider error text is shown to a person and a model: cut it, and drop anything that looks like an email. */
export function clip(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '***@***').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** First and last four characters; short values are hidden. Pixel ids are not secrets, but nothing here echoes an id whole. */
export function maskId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length <= 8 ? '****' : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Why a token was disabled, in words: the API sends a code (`invalid_credential`, `repeated_failures`). */
export function disabledReasonText(reason: unknown): string | null {
  if (reason === 'invalid_credential') return 'credencial inválida desde o início';
  if (reason === 'repeated_failures') return 'falhas seguidas no envio';
  return clip(reason);
}

/** "A, B e C" or "A, B, C e mais 2". */
export function listNames(names: string[], max = 5): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} e mais ${rest}`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
}
