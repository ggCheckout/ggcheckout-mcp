export interface RewardsProgress {
  /** In REAIS, and already divided — not cents. */
  currentRevenue: number;
  currentRevenueCents: number;
  completedGoals: number;
  totalGoals: number;
  /** The milestones, in reais. This is the only place the catalogue is exposed. */
  milestones: number[];
  /** Only present when the answer came from the cache. */
  cachedAt?: string;
  fromCache?: boolean;
}

export interface RedeemResult {
  success: boolean;
  redeemType: string;
  redirectUrl: string;
  redeemCount: number;
  maxRedeems: number;
}
