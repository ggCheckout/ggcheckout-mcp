// Turns a build_tracking_link answer into what the utm view draws. The tool builds the link; this
// only reads it back, defensively, because the structuredContent is not checked by the compiler. Pure.

import { isPayload, text, type Payload } from '../lib/payload';

export type UtmPlatform = 'meta' | 'tiktok' | 'google' | 'kwai' | 'manual';
export type ParamSource = 'template' | 'manual' | 'url';

export interface UtmParam {
  key: string;
  value: string;
  source: ParamSource;
}

export interface UtmLink {
  platform: UtmPlatform;
  platformLabel: string;
  destination: { kind: string; kindLabel: string; url: string; title: string | null; customDomain: boolean };
  finalUrl: string;
  /** The text to copy first: what the platform asks for, or the whole link for a manual one. */
  paste: { label: string; text: string };
  where: string[];
  notes: string[];
  params: UtmParam[];
}

const PLATFORMS: Record<UtmPlatform, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  google: 'Google Ads',
  kwai: 'Kwai Ads',
  manual: 'Link manual',
};

const KINDS: Record<string, string> = {
  checkout: 'Checkout',
  funnel: 'Funil (quiz)',
  store: 'Loja',
  product: 'Produto da loja',
  url: 'Link próprio',
};

const PASTE_LABELS: Record<UtmPlatform, string> = {
  meta: 'Parâmetros de URL',
  tiktok: 'Texto depois do "?" da URL de destino',
  google: 'Modelo de acompanhamento',
  kwai: 'Texto depois do "?" da URL',
  manual: 'Link completo',
};

export const SOURCE_LABELS: Record<ParamSource, string> = {
  template: 'Modelo da plataforma',
  manual: 'Informado por você',
  url: 'Já estava no link',
};

const isPlatform = (value: unknown): value is UtmPlatform => typeof value === 'string' && value in PLATFORMS;
const isSource = (value: unknown): value is ParamSource => value === 'template' || value === 'manual' || value === 'url';

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(text).filter((s): s is string => s !== null) : [];

/** A build_tracking_link answer; null for anything else. */
export function summarizeLink(data: unknown): UtmLink | null {
  if (!isPayload(data) || !isPayload(data.destination) || !isPlatform(data.platform)) return null;
  const finalUrl = text(data.finalUrl);
  const destinationUrl = text(data.destination.url);
  if (!finalUrl || !destinationUrl) return null;

  const platform = data.platform;
  const own = platform === 'google' ? text(data.trackingTemplate) : text(data.adParameters);
  const kind = text(data.destination.kind) ?? 'url';
  return {
    platform,
    platformLabel: PLATFORMS[platform],
    destination: {
      kind,
      kindLabel: KINDS[kind] ?? KINDS.url,
      url: destinationUrl,
      title: text(data.destination.title),
      customDomain: data.destination.customDomain === true,
    },
    finalUrl,
    paste: platform === 'manual' || !own ? { label: PASTE_LABELS.manual, text: finalUrl } : { label: PASTE_LABELS[platform], text: own },
    where: strings(data.where),
    notes: strings(data.notes),
    params: (Array.isArray(data.params) ? data.params : []).filter(isPayload).flatMap((p: Payload) => {
      const key = text(p.key);
      return key && typeof p.value === 'string' ? [{ key, value: p.value, source: isSource(p.source) ? p.source : 'manual' }] : [];
    }),
  };
}
