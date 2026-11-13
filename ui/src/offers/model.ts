// Turns list_upsells / list_downsells into the post-purchase map the offers view draws: checkout,
// the product's upsells in order, the downsell sequence a declined "stop" upsell opens, then the
// success page. The decline rules come from the product editor (saas components/catalog/sections
// UpsellSection, DownsellSection, ChainBehaviorField). Prices are cents. Pure.

import { type Payload, finite, isPayload, text } from '../lib/payload';

export interface Offer {
  id: string;
  kind: 'upsell' | 'downsell';
  title: string;
  headline: string | null;
  priceCents: number | null;
  /** Shown struck through when it is higher than the price. */
  originalPriceCents: number | null;
  active: boolean;
  /** On decline: go on to the next offer of the same kind, or stop it (an upsell then opens the downsells). */
  continues: boolean;
  timerMinutes: number | null;
  productCount: number;
}

function toOffer(o: Payload, kind: Offer['kind']): Offer {
  const ids = kind === 'upsell' ? o.upsellProductIds : o.downsellProductIds;
  const single = kind === 'upsell' ? o.upsellProductId : o.downsellProductId;
  return {
    id: String(o.uid ?? o.id ?? ''),
    kind,
    title: text(o.title) ?? (kind === 'upsell' ? 'Upsell' : 'Downsell'),
    headline: text(o.headline),
    priceCents: finite(o.price),
    originalPriceCents: finite(o.originalPrice),
    active: o.status !== 'inactive',
    continues: o.chainBehavior === 'continue',
    timerMinutes: o.timerEnabled === true && typeof o.timerMinutes === 'number' ? o.timerMinutes : null,
    productCount: Array.isArray(ids) && ids.length ? ids.length : single ? 1 : 0,
  };
}

const byOrder = (a: Payload, b: Payload) => (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0);

/** list_upsells `{ upsells }`; null for anything else. */
export function summarizeUpsells(data: unknown): Offer[] | null {
  if (!isPayload(data) || !Array.isArray(data.upsells)) return null;
  return data.upsells.filter(isPayload).sort(byOrder).map((o) => toOffer(o, 'upsell'));
}

/** list_downsells `{ downsells, count }`; null for anything else. */
export function summarizeDownsells(data: unknown): Offer[] | null {
  if (!isPayload(data) || !Array.isArray(data.downsells)) return null;
  return data.downsells.filter(isPayload).sort(byOrder).map((o) => toOffer(o, 'downsell'));
}

/** What a decline does, worded as the editor's "Comportamento ao recusar". */
export function declineLine(offer: Offer, isLast: boolean, hasDownsells: boolean | null): string {
  if (offer.kind === 'upsell') {
    if (offer.continues && !isLast) return 'Se recusar, mostra o próximo upsell da sequência';
    // Downsells unknown (not read): say only what the upsell's own setting does.
    if (hasDownsells === null) return 'Se recusar, abre os downsells do produto, se houver';
    return hasDownsells ? 'Se recusar, vai para o downsell' : 'Se recusar, vai para o sucesso';
  }
  return offer.continues && !isLast ? 'Se recusar, mostra o próximo downsell' : 'Se recusar, vai para o sucesso';
}

export interface MapNotes {
  /** "Nenhum upsell ainda.": only for an upsell list that was read and is empty. */
  emptyUpsells: boolean;
  /** Downsells that cannot show up because the product has no active upsell to decline. */
  noUpsellWarning: boolean;
  /** The list whose read failed (the other one is the payload itself). */
  unreadable: 'upsells' | 'downsells' | null;
}

/** What the map may claim: a list that is `null` is unknown (not loaded, unavailable or failed), never empty. */
export function mapNotes(upsells: Offer[] | null, downsells: Offer[] | null, readFailed: boolean): MapNotes {
  return {
    emptyUpsells: upsells !== null && upsells.length === 0,
    noUpsellWarning: upsells !== null && !upsells.some((u) => u.active) && downsells !== null && downsells.length > 0,
    unreadable: readFailed ? (upsells === null ? 'upsells' : 'downsells') : null,
  };
}
