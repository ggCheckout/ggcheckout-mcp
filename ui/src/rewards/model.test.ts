import { describe, expect, it } from 'vitest';
import { formatAmount, summarizeRedeem, summarizeRewards } from './model';

// QA on 2026-11-10.
const qa = { completedGoals: 4, currentRevenue: 190587.39, currentRevenueCents: 19058739, fromCache: false, milestones: [5000, 10000, 50000, 100000, 500000, 1000000], totalGoals: 6 };

describe('summarizeRewards', () => {
  it('unlocks every stop under the revenue and points at the next one', () => {
    const r = summarizeRewards(qa)!;
    expect(r.stops.map((s) => s.state)).toEqual(['unlocked', 'unlocked', 'unlocked', 'unlocked', 'unlocked', 'current', 'locked']);
    expect(r.next).toMatchObject({ title: 'Placa R$ 500K', percent: 38 });
    expect(r.next!.missingReais).toBeCloseTo(309412.61, 2);
    expect(r).toMatchObject({ completed: 4, total: 6 });
  });

  it('keeps the community stop and only the milestones the answer lists', () => {
    const r = summarizeRewards({ currentRevenue: 0, milestones: [5000] })!;
    expect(r.stops.map((s) => s.title)).toEqual(['Comunidade ggCheckout', 'Grupo Network WhatsApp']);
    expect(r.stops[0].state).toBe('unlocked');
    expect(r.next!.percent).toBe(0);
  });

  it('has no next stop past the last plaque', () => {
    expect(summarizeRewards({ ...qa, currentRevenue: 1_200_000 })!.next).toBeNull();
  });

  it('ignores other payloads', () => {
    expect(summarizeRewards({ currentRevenueCents: 1 })).toBeNull();
  });
});

describe('redeem and format', () => {
  it('only keeps an https link to open', () => {
    expect(summarizeRedeem({ success: true, redeemType: 'whatsapp_group', redirectUrl: 'https://chat.whatsapp.com/x' })).toEqual({ redirectUrl: 'https://chat.whatsapp.com/x' });
    expect(summarizeRedeem({ success: true, redeemType: 'whatsapp_group', redirectUrl: 'javascript:alert(1)' })).toEqual({ redirectUrl: null });
  });

  it('writes the header number without cents', () => {
    expect(formatAmount(190587.39)).toBe('190.587');
  });
});
