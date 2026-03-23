export interface RewardsProgress {
  currentRevenue: number;
  currentRevenueCents: number;
  completedGoals: number;
  totalGoals: number;
  milestones: number[];
  fromCache?: boolean;
}

export interface RedeemResult {
  success: boolean;
  redeemType: string;
  redirectUrl: string;
  redeemCount: number;
  maxRedeems: number;
}
