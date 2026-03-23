import type { RewardsProgress, RedeemResult } from '../types/rewards.js';
export interface RewardsPort {
  getProgress(): Promise<RewardsProgress>;
  calculate(): Promise<RewardsProgress>;
  redeem(rewardId: string): Promise<RedeemResult>;
}
