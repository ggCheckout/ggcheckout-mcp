import { describe, expect, it } from 'vitest';
import { formatReset, levelText, summarizeIntents, summarizeLimits, summarizePayApi, summarizeWallets } from './model';

// Invented data in the shape the spec gives for GET /v1/limits.
const limits = {
  object: 'limits', livemode: true, window_seconds: 60, max_amount_cents: 500000,
  buckets: [
    { id: 'create_per_key', scope: 'key', action: 'create', limit: 60, used: 3, window_seconds: 60, resets_in_seconds: 41 },
    { id: 'read_per_key', scope: 'key', action: 'read', limit: 300, used: 255, window_seconds: 60, resets_in_seconds: 12 },
    { id: 'cancel_per_key', scope: 'key', action: 'cancel', limit: 60, used: 60, window_seconds: 60, resets_in_seconds: 5 },
    { id: 'create_per_seller_per_day', scope: 'seller', action: 'create', limit: 500, used: 0, window_seconds: 86400, resets_in_seconds: 0 },
    { id: 'future_bucket', scope: 'seller', action: 'cancel', limit: 10, used: 1 },
  ],
};

describe('summarizeLimits', () => {
  it('labels each bucket in pt-BR and grades its level', () => {
    const r = summarizeLimits(limits);
    if (!r || !r.available) throw new Error('expected limits');
    expect(r.limits.livemode).toBe(true);
    expect(r.limits.maxAmountCents).toBe(500000);
    expect(r.limits.buckets.map((b) => [b.label, b.level])).toEqual([
      ['Criar cobranças (chave)', 'ok'],
      ['Consultas (chave)', 'high'],
      ['Cancelamentos (chave)', 'full'],
      ['Criar cobranças por dia (teste)', 'ok'],
      ['Cancelamentos (conta)', 'ok'],
    ]);
  });

  it('reads a test key and keeps the bar ratio within 0..1', () => {
    const r = summarizeLimits({ ...limits, livemode: false, buckets: [{ id: 'x', limit: 10, used: 30 }] });
    if (!r || !r.available) throw new Error('expected limits');
    expect(r.limits.livemode).toBe(false);
    expect(r.limits.buckets[0]).toMatchObject({ ratio: 1, level: 'full' });
  });

  it('turns the not-available answer into available:false, and ignores other shapes', () => {
    expect(summarizeLimits({ object: 'limits_unavailable', available: false, message: 'x' })).toEqual({ available: false });
    expect(summarizeLimits({ object: 'list', data: [] })).toBeNull();
    expect(summarizeLimits(null)).toBeNull();
  });

  it('drops buckets without an id or a numeric limit', () => {
    const r = summarizeLimits({ object: 'limits', buckets: [{ id: 'a' }, { limit: 5 }, null, { id: 'b', limit: 5, used: 1 }] });
    if (!r || !r.available) throw new Error('expected limits');
    expect(r.limits.buckets.map((b) => b.id)).toEqual(['b']);
  });
});

describe('summarizeWallets', () => {
  const wallets = { object: 'list', data: [{ id: 'wal_a1b2c3d4e5f6g7h8i9j0k1', name: 'Loja Exemplo', active_pix_count: 0 }, { id: 'wal_b1b2c3d4e5f6g7h8i9j0k1', name: 'Outra', active_pix_count: 2 }] };

  it('reads name, id and active PIX count', () => {
    expect(summarizeWallets(wallets)?.map((w) => [w.name, w.activePix])).toEqual([['Loja Exemplo', 0], ['Outra', 2]]);
  });

  it('needs the tool name to call an empty list wallets', () => {
    expect(summarizeWallets({ object: 'list', data: [] })).toBeNull();
    expect(summarizeWallets({ object: 'list', data: [] }, 'list_wallets')).toEqual([]);
  });

  it('refuses a list of other things', () => {
    expect(summarizeWallets({ data: [{ id: 'pi_x' }] })).toBeNull();
  });
});

describe('summarizeIntents', () => {
  const page = {
    object: 'list', has_more: true, next_cursor: 'pi_cur',
    data: [
      { id: 'pi_aaaaaaaaaaaaaaaaaaaaaaaa', object: 'payment_intent', status: 'succeeded', amount: 4990, external_reference: 'order-1', created_at: '2026-11-09T15:30:00.123456Z', buyer: { name: 'Ma*** S***', email: 'm***@e.com' }, livemode: false },
      { id: 'pi_bbbbbbbbbbbbbbbbbbbbbbbb', object: 'payment_intent', status: 'requires_action', amount: 100, created: 1762700000 },
    ],
  };

  it('reads rows with a pt-BR status, the reference, the masked buyer and the cursor', () => {
    const p = summarizeIntents(page)!;
    expect(p.nextCursor).toBe('pi_cur');
    expect(p.hasMore).toBe(true);
    expect(p.rows[0]).toMatchObject({ amountCents: 4990, statusLabel: 'Pago', reference: 'order-1', buyer: 'Ma*** S***', livemode: false });
    expect(p.rows[1]).toMatchObject({ statusLabel: 'Aguardando pagamento', reference: null, buyer: null });
    expect(p.rows[1].createdAt).toBe('2025-11-09T14:53:20.000Z');
  });

  it('keeps no cursor on the last page', () => {
    expect(summarizeIntents({ ...page, has_more: false })!.nextCursor).toBeNull();
  });

  it('keeps an unknown status as it came', () => {
    expect(summarizeIntents({ data: [{ id: 'pi_c', status: 'weird' }] })!.rows[0].statusLabel).toBe('weird');
  });
});

describe('summarizePayApi', () => {
  it('picks the kind by shape', () => {
    expect(summarizePayApi(limits)?.kind).toBe('limits');
    expect(summarizePayApi({ data: [{ id: 'wal_x' }] })?.kind).toBe('wallets');
    expect(summarizePayApi({ data: [{ id: 'pi_x' }] })?.kind).toBe('intents');
    expect(summarizePayApi({ data: [] }, 'list_payment_intents')?.kind).toBe('intents');
    expect(summarizePayApi({ id: 'pi_x', object: 'payment_intent' })).toBeNull();
  });
});

describe('formatReset / levelText', () => {
  it('speaks seconds, minutes and hours; nothing when there is no wait', () => {
    expect(formatReset(41)).toBe('reinicia em 41 s');
    expect(formatReset(300)).toBe('reinicia em 5 min');
    expect(formatReset(7200)).toBe('reinicia em 2 h');
    expect(formatReset(0)).toBeNull();
    expect(formatReset(null)).toBeNull();
  });

  it('words the level', () => {
    expect(levelText('ok')).toBeNull();
    expect(levelText('high')).toBe('Quase no limite');
    expect(levelText('full')).toBe('No limite');
  });
});
