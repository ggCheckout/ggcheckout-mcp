import type { RewardsPort } from '../ports/rewards.port.js';
export class RewardsService {
  constructor(private readonly port: RewardsPort) {}
  async getProgress() { return this.port.getProgress(); }
  async calculate() { return this.port.calculate(); }
  async redeem(rewardId: string) { return this.port.redeem(rewardId); }
}
