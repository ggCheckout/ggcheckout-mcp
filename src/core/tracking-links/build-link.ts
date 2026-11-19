import { ValidationError } from '../../shared/errors.js';
import {
  GOOGLE_LANDING_MACRO, MANUAL_KEYS, TEMPLATE_NOTES, TEMPLATE_QUERY, WHERE_TO_PASTE,
  type ManualParams, type Platform,
} from './templates.js';

/** Where a parameter of the link came from. */
export type ParamSource = 'template' | 'manual' | 'url';

export interface LinkParam {
  key: string;
  /** What the link carries: the macros of a template stay as the ad platform expects them. */
  value: string;
  source: ParamSource;
}

export interface BuiltLink {
  /** The destination plus the parameters; a template shows its macros for preview. */
  finalUrl: string;
  /** The text for the ad's URL parameters field; absent for the Google tracking template. */
  adParameters?: string;
  /** Google only: the account-level tracking template, starting with the `{lpurl}` macro. */
  trackingTemplate?: string;
  /** One step per entry, in pt-BR. */
  where: string[];
  notes: string[];
  params: LinkParam[];
}

interface Pair { key: string; raw: string }

const splitQuery = (query: string): Pair[] =>
  query.split('&').filter(Boolean).map((part) => {
    const at = part.indexOf('=');
    const key = at < 0 ? part : part.slice(0, at);
    return { key: safeDecode(key), raw: part };
  });

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/** The manual values that are set, trimmed, in the order of `MANUAL_KEYS`. */
function manualEntries(manual: ManualParams): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];
  for (const key of MANUAL_KEYS) {
    const value = manual[key]?.trim();
    if (value) entries.push({ key, value });
  }
  return entries;
}

/**
 * Builds the link for a destination and a platform. Pure.
 *
 * Merge: a key is never written twice. The manual values win over a parameter already in the
 * destination's query, and both win over the template's own value for that key (the template drops
 * it, with a note). Manual values are percent-encoded; template macros are not.
 */
export function buildLink(input: { destinationUrl: string; platform: Platform; manual?: ManualParams }): BuiltLink {
  const { destinationUrl, platform } = input;
  let url: URL;
  try {
    url = new URL(destinationUrl);
  } catch {
    throw new ValidationError(`"${destinationUrl}" is not a valid URL.`);
  }
  const manual = manualEntries(input.manual ?? {});
  if (platform === 'manual' && manual.length === 0) {
    throw new ValidationError(
      `Provide at least one of ${MANUAL_KEYS.join(', ')} for a manual link, or pick meta, tiktok, google or kwai.`,
    );
  }

  const manualKeys = new Set(manual.map((m) => m.key));
  const notes: string[] = [];

  // The destination's own query: kept as written, except what a manual value replaces.
  const existing = splitQuery(url.search.slice(1));
  const keptExisting = existing.filter((p) => !manualKeys.has(p.key));
  const keptKeys = new Set(keptExisting.map((p) => p.key));
  const replaced = existing.filter((p) => manualKeys.has(p.key)).map((p) => p.key);
  if (replaced.length) {
    notes.push(`O link já tinha ${[...new Set(replaced)].join(', ')}; os valores que você informou substituíram os antigos.`);
  }

  // The template, minus what the destination or a manual value already says.
  const templatePairs = platform === 'manual' ? [] : splitQuery(TEMPLATE_QUERY[platform]);
  const droppedByUrl: string[] = [];
  const fromTemplate: Pair[] = [];
  for (const pair of templatePairs) {
    if (manualKeys.has(pair.key)) continue;
    if (keptKeys.has(pair.key)) {
      droppedByUrl.push(pair.key);
      continue;
    }
    fromTemplate.push(pair);
  }
  if (droppedByUrl.length) {
    notes.push(`O link já traz ${droppedByUrl.join(', ')}; o modelo da plataforma não repete esses campos.`);
  }

  // Template pairs keep their place; manual values of a templated key take the template's place.
  const effective: Array<LinkParam & { raw: string }> = [];
  for (const pair of templatePairs) {
    const override = manual.find((m) => m.key === pair.key);
    if (override) {
      effective.push({ key: pair.key, value: override.value, source: 'manual', raw: `${pair.key}=${encodeURIComponent(override.value)}` });
    } else if (fromTemplate.includes(pair)) {
      effective.push({ key: pair.key, value: pair.raw.slice(pair.key.length + 1), source: 'template', raw: pair.raw });
    }
  }
  for (const m of manual) {
    if (!effective.some((e) => e.key === m.key)) {
      effective.push({ key: m.key, value: m.value, source: 'manual', raw: `${m.key}=${encodeURIComponent(m.value)}` });
    }
  }

  const adQuery = effective.map((e) => e.raw).join('&');
  const base = `${url.origin}${url.pathname}`;
  const finalQuery = [...keptExisting.map((p) => p.raw), ...effective.map((e) => e.raw)].join('&');
  const finalUrl = `${base}${finalQuery ? `?${finalQuery}` : ''}${url.hash}`;

  const params: LinkParam[] = [
    ...keptExisting.map((p) => ({ key: p.key, value: safeDecode(p.raw.slice(p.key.length + 1)), source: 'url' as const })),
    ...effective.map(({ raw: _raw, ...param }) => param),
  ];

  const clean = `${base}${keptExisting.length ? `?${keptExisting.map((p) => p.raw).join('&')}` : ''}${url.hash}`;
  return {
    finalUrl,
    ...(platform === 'google'
      ? { trackingTemplate: `${GOOGLE_LANDING_MACRO}?${adQuery}` }
      : { adParameters: adQuery }),
    where: WHERE_TO_PASTE[platform].map((step) => step.replace('{destination}', clean)),
    notes: [...TEMPLATE_NOTES[platform], ...notes],
    params,
  };
}
