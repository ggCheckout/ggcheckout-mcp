import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RewardsApiAdapter } from './rewards.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('RewardsApiAdapter', () => {
  let adapter: RewardsApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new RewardsApiAdapter(http);
  });

  // `/api/rewards` was removed upstream; `/calculate` is the only reward reader left, and it is
  // the one that carries the milestones.
  it('calculate GETs /api/rewards/calculate and carries the milestones', async () => {
    vi.mocked(http.get).mockResolvedValue({ currentRevenue: 5000, milestones: [10000, 50000] });
    const result = await adapter.calculate();
    expect(http.get).toHaveBeenCalledWith('/api/rewards/calculate');
    expect(result.milestones).toHaveLength(2);
  });

  it('never calls the removed /api/rewards', async () => {
    vi.mocked(http.get).mockResolvedValue({ currentRevenueCents: 500000 });
    await adapter.calculate();
    expect(http.get).not.toHaveBeenCalledWith('/api/rewards');
  });

  it('redeem POSTs rewardId', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, redeemType: 'direct_link', redirectUrl: 'https://...' });
    const result = await adapter.redeem('bracelet_10000');
    expect(http.post).toHaveBeenCalledWith('/api/rewards/redeem', { rewardId: 'bracelet_10000' });
    expect(result.success).toBe(true);
  });
});
