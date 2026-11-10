import { describe, expect, it } from 'vitest';
import { coverLine, isUnstable, rankingFor, rateColor, summarizeStats, summarizeWallets, usageLine } from './model';

// The shape QA answered on 2026-11-10 (one wallet).
const wallets = {
  wallets: [{
    id: 'w1', publicId: 'wal_1', name: 'carteira teste QA', mode: 'manual', metric: 'reliability',
    pix: [
      { credentialId: 'c1', gateway: 'mercadopago', label: 'Mercado Pago', active: true, locked: false, favorite: false },
      { credentialId: 'c2', gateway: 'efibank', label: null, active: false, locked: false, favorite: true },
    ],
    card: [{ credentialId: 'c3', gateway: 'stripe', label: null, active: true, locked: false, favorite: false }],
    checkoutCount: 2, storeCount: 0,
  }],
};

describe('summarizeWallets', () => {
  it('reads each wallet and the legacy favorite as locked', () => {
    const [w] = summarizeWallets(wallets)!;
    expect(w).toMatchObject({ name: 'carteira teste QA', auto: false, metric: 'reliability', checkoutCount: 2 });
    expect(w.pix[1]).toMatchObject({ gateway: 'efibank', active: false, locked: true });
    expect(usageLine(w)).toBe('em 2 checkouts');
    expect(coverLine(w)).toBe('Só a principal');
  });

  it('words usage and cover as the panel does', () => {
    expect(usageLine({ checkoutCount: 1, storeCount: 2 })).toBe('em 1 checkout e 2 lojas');
    expect(usageLine({ checkoutCount: 0, storeCount: 0 })).toBe('nenhum checkout ou loja');
    const e = { credentialId: 'x', gateway: 'g', label: null, active: true, locked: false };
    expect(coverLine({ pix: [e, e, e], card: [] })).toBe('+ 2 reservas');
    expect(coverLine({ pix: [], card: [e] })).toBe('Só cartão');
  });
});

describe('summarizeStats', () => {
  const stats = {
    stats: { efibank: { success: 98, errors: 2, total: 100, reliability: 98 }, appmax: { success: 40, errors: 30, total: 70, reliability: 57.1 } },
    cachedAt: 1794317057192,
    window: { from: 'a', to: 'b', hours: 24 },
    ranking: {
      reliability: [{ gateway: 'efibank', score: 0.93, sample: 100, rate: 98 }, { gateway: 'appmax', score: 0.45, sample: 70, rate: 57.1 }],
      conversion: [{ gateway: 'efibank', score: 0.6, sample: 80, rate: 71.2 }],
      card: [],
    },
  };

  it('ranks PIX by the wallet metric and flags an unstable gateway', () => {
    const s = summarizeStats(stats)!;
    expect(s.hours).toBe(24);
    expect(rankingFor(s, 'pix', 'reliability').map((r) => r.gateway)).toEqual(['efibank', 'appmax']);
    expect(rankingFor(s, 'pix', 'conversion')[0].rate).toBe(71.2);
    expect(rankingFor(s, 'card', 'reliability')).toEqual([]);
    expect(isUnstable('appmax', 57.1, s)).toBe(true);
    expect(isUnstable('efibank', 98, s)).toBe(false);
  });

  it('reads the empty QA answer and refuses other payloads', () => {
    expect(summarizeStats({ stats: {}, cachedAt: 1, window: { hours: 24 }, ranking: { reliability: [], conversion: [], card: [], pix: [] } })!.ranking!.pix).toEqual([]);
    expect(summarizeStats({ wallets: [] })).toBeNull();
  });
});

describe('rateColor', () => {
  it('follows the Seasons scale and maps conversion onto it', () => {
    expect(rateColor(100)).toBe('rgb(18, 183, 106)');
    expect(rateColor(0)).toBe('rgb(229, 35, 42)');
    expect(rateColor(70, 'conversion')).toBe(rateColor(95));
  });
});
