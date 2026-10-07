import type { RewardsPort } from '../../core/ports/rewards.port.js';
import type { RewardsProgress, RedeemResult } from '../../core/types/rewards.js';
import type { HttpClient } from './http-client.js';

export class RewardsApiAdapter implements RewardsPort {
  constructor(private readonly http: HttpClient) {}
  /**
   * `GET /api/rewards` is gone: it served a stored progress counter that was retired with it.
   * `/calculate` is its declared replacement and answers the same fields, derived from paid
   * payments instead of the counter — so there is one reward reader now, not two.
   */
  async calculate() { return this.http.get<RewardsProgress>('/api/rewards/calculate'); }
  async redeem(rewardId: string) { return this.http.post<RedeemResult>('/api/rewards/redeem', { rewardId }); }
}
