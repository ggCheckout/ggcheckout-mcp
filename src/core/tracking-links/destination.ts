import { ValidationError } from '../../shared/errors.js';
import type { CustomDomain } from '../types/custom-domain.js';

export type DestinationKind = 'checkout' | 'funnel' | 'store' | 'product' | 'url';

export interface Destination {
  kind: DestinationKind;
  url: string;
  /** The title of the checkout, funnel or store when the API gave one. */
  title: string | null;
  /** True when the link sits on the seller's own domain, false on the GG origin. */
  customDomain: boolean;
  notes: string[];
}

/** The domain a document points at: by id (`customDomainId`) or by hostname (`customDomain`). */
export interface DomainRef {
  id?: string | null;
  name?: string | null;
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A bare hostname from what the API stored ("https://Pay.Example.com/" tolerated); null when it is not one. */
export function cleanHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return HOSTNAME.test(host) ? host : null;
}

/** The origin (scheme and host) of the GG API base URL, which serves the app too. */
export function appOriginOf(apiUrl: string): string {
  try {
    return new URL(apiUrl).origin;
  } catch {
    throw new ValidationError(`The API URL "${apiUrl}" is not a valid URL.`);
  }
}

/**
 * The hostname a link may use, from the seller's custom domains. Only a verified domain serves the
 * page; any other state falls back to the app origin and says why. `domains` is null when the list
 * was not read, which only happens when no document pointed at a domain.
 */
export function pickDomain(ref: DomainRef, domains: CustomDomain[] | null): { host: string | null; note?: string } {
  const name = cleanHost(ref.name);
  if (!ref.id && !name) return { host: null };
  const found = ref.id
    ? domains?.find((d) => d.id === ref.id)
    : domains?.find((d) => d.domain.toLowerCase() === name);
  if (!found) {
    // A hostname the checkout or funnel itself reports is trusted when the account list lacks it;
    // an id that matches nothing is not.
    if (!ref.id && name) return { host: name };
    return { host: null, note: 'O domínio próprio configurado não foi encontrado na conta; o link usa o endereço padrão da GG.' };
  }
  if (found.status === 'verified') return { host: cleanHost(found.domain) };
  return {
    host: null,
    note: `O domínio ${found.domain} ainda não está verificado (${found.status}); o link usa o endereço padrão da GG. Verifique o DNS e gere o link de novo.`,
  };
}

const enc = encodeURIComponent;

export const BUILT_BY_MCP_NOTE = 'Link montado pelo MCP; confira no painel.';

/** The absolute link the saas computed for a document; only a plain https URL counts, else null. */
export function publicUrlOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

type Domain = { host: string | null; note?: string };

/** Notes and domain flag for a destination: from the saas link when there is one, else built here. */
function provenance(origin: string, publicUrl: string | null | undefined, domain: Domain) {
  if (publicUrl) return { customDomain: new URL(publicUrl).origin !== origin, notes: [] as string[] };
  return { customDomain: Boolean(domain.host), notes: [...(domain.note ? [domain.note] : []), BUILT_BY_MCP_NOTE] };
}

export function checkoutDestination(input: {
  origin: string; id: string; title?: unknown; published?: unknown; domain: Domain; publicUrl?: string | null;
}): Destination {
  const path = `/checkout/${enc(input.id)}`;
  const { customDomain, notes } = provenance(input.origin, input.publicUrl, input.domain);
  if (input.published === false) notes.push('O checkout está despublicado: o link só funciona depois de publicar.');
  return {
    kind: 'checkout',
    url: input.publicUrl ?? (input.domain.host ? `https://${input.domain.host}${path}` : `${input.origin}${path}`),
    title: typeof input.title === 'string' && input.title ? input.title : null,
    customDomain,
    notes,
  };
}

export function funnelDestination(input: {
  origin: string; slug: string; title?: unknown; published?: unknown; domain: Domain; publicUrl?: string | null;
}): Destination {
  const { customDomain, notes } = provenance(input.origin, input.publicUrl, input.domain);
  if (input.published === false) notes.push('O funil está despublicado: o link só abre depois de publicar.');
  notes.push('O funil repassa os parâmetros da URL para o checkout que ele abre.');
  return {
    kind: 'funnel',
    url: input.publicUrl ?? (input.domain.host ? `https://${input.domain.host}/` : `${input.origin}/quiz/${enc(input.slug)}`),
    title: typeof input.title === 'string' && input.title ? input.title : null,
    customDomain,
    notes,
  };
}

export function storeDestination(input: {
  origin: string; storeId: string; productId?: string; title?: unknown; published?: unknown;
  domain: Domain; publicUrl?: string | null;
}): Destination {
  const root = input.publicUrl
    ? input.publicUrl.replace(/\/+$/, '')
    : input.domain.host ? `https://${input.domain.host}` : `${input.origin}/s/${enc(input.storeId)}`;
  const { customDomain, notes } = provenance(input.origin, input.publicUrl, input.domain);
  if (input.published === false) notes.push('A loja está despublicada: o link só abre depois de publicar.');
  notes.push('A loja guarda os UTMs do visitante por 7 dias e os repassa ao checkout.');
  return {
    kind: input.productId ? 'product' : 'store',
    url: input.productId ? `${root}/product/${enc(input.productId)}`
      : input.publicUrl ? input.publicUrl : input.domain.host ? `${root}/` : root,
    title: typeof input.title === 'string' && input.title ? input.title : null,
    customDomain,
    notes,
  };
}

/** Any https URL; credentials in it and other schemes are refused. */
export function urlDestination(raw: string): Destination {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ValidationError('url must be a full https URL, for example https://example.com/page.');
  }
  if (url.protocol !== 'https:') throw new ValidationError('url must use https.');
  if (url.username || url.password) throw new ValidationError('url must not carry a user name or password.');
  return { kind: 'url', url: url.href, title: null, customDomain: false, notes: [] };
}
