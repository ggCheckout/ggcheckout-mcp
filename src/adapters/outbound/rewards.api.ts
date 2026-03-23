import type { RewardsPort } from '../../core/ports/rewards.port.js';
import type { RewardsProgress, RedeemResult } from '../../core/types/rewards.js';
import type { HttpClient } from './http-client.js';

export class RewardsApiAdapter implements RewardsPort {
  constructor(private readonly http: HttpClient) {}
  async getProgress() { return this.http.get<RewardsProgress>('/api/rewards'); }
  async calculate() { return this.http.get<RewardsProgress>('/api/rewards/calculate'); }
  async redeem(rewardId: string) { return this.http.post<RedeemResult>('/api/rewards/redeem', { rewardId }); }
}
