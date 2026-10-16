import type { RewardsProgress, RedeemResult } from '../types/rewards.js';
export interface RewardsPort {
  calculate(): Promise<RewardsProgress>;
  redeem(rewardId: string): Promise<RedeemResult>;
}
