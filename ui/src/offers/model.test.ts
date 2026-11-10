import { describe, expect, it } from 'vitest';
import { declineLine, mapNotes, summarizeDownsells, summarizeUpsells } from './model';

// QA on 2026-11-10 (trimmed).
const qaUpsell = {
  chainBehavior: 'stop_on_decline', headline: 'Tenho uma oferta especial para você...', price: 100, originalPrice: null, status: 'active',
  timerEnabled: true, timerMinutes: 10, title: 'teste produto fisico', upsellProductId: 'eea3', uid: 'u2', order: 1, upsellProductIds: ['eea3'],
};

describe('offers', () => {
  it('reads upsells in funnel order', () => {
    const upsells = summarizeUpsells({ upsells: [qaUpsell, { ...qaUpsell, uid: 'u1', order: 0, title: 'Primeiro', chainBehavior: 'continue' }] })!;
    expect(upsells.map((u) => u.title)).toEqual(['Primeiro', 'teste produto fisico']);
    expect(upsells[1]).toMatchObject({ priceCents: 100, timerMinutes: 10, continues: false, productCount: 1, active: true });
  });

  it('reads downsells and their chain', () => {
    const [d] = summarizeDownsells({ downsells: [{ uid: 'd1', order: 1, status: 'active', chainBehavior: 'continue', price: 4990, originalPrice: 9700, downsellProductIds: ['a', 'b'] }], count: 1 })!;
    expect(d).toMatchObject({ title: 'Downsell', priceCents: 4990, originalPriceCents: 9700, continues: true, productCount: 2 });
  });

  it('words what each decline does', () => {
    const [u1, u2] = summarizeUpsells({ upsells: [{ ...qaUpsell, uid: 'a', order: 0, chainBehavior: 'continue' }, { ...qaUpsell, uid: 'b', order: 1 }] })!;
    expect(declineLine(u1, false, true)).toBe('Se recusar, mostra o próximo upsell da sequência');
    expect(declineLine(u2, true, true)).toBe('Se recusar, vai para o downsell');
    expect(declineLine(u2, true, false)).toBe('Se recusar, vai para o sucesso');
    expect(declineLine(u2, true, null)).toBe('Se recusar, abre os downsells do produto, se houver');
    expect(declineLine(u1, false, null)).toBe('Se recusar, mostra o próximo upsell da sequência');
  });

  it('ignores other payloads', () => {
    expect(summarizeUpsells({ downsells: [] })).toBeNull();
    expect(summarizeDownsells({ upsells: [] })).toBeNull();
  });
});

describe('mapNotes', () => {
  const [up] = summarizeUpsells({ upsells: [qaUpsell] })!;
  const [down] = summarizeDownsells({ downsells: [{ uid: 'd1', status: 'active' }] })!;
  const off = { ...up, active: false };

  it('claims no upsell only for an upsell list that was read', () => {
    expect(mapNotes([], [down], false)).toMatchObject({ emptyUpsells: true, noUpsellWarning: true });
    expect(mapNotes([off], [down], false)).toMatchObject({ emptyUpsells: false, noUpsellWarning: true });
    expect(mapNotes([up], [down], false)).toMatchObject({ emptyUpsells: false, noUpsellWarning: false });
  });

  it('claims nothing about an unknown list', () => {
    expect(mapNotes(null, [down], false)).toEqual({ emptyUpsells: false, noUpsellWarning: false, unreadable: null });
    expect(mapNotes([up], null, false)).toEqual({ emptyUpsells: false, noUpsellWarning: false, unreadable: null });
  });

  it('names the list whose read failed', () => {
    expect(mapNotes(null, [down], true).unreadable).toBe('upsells');
    expect(mapNotes([up], null, true).unreadable).toBe('downsells');
  });
});
