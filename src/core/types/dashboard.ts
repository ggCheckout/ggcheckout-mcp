export interface DashboardStats {
  totalSales: number;
  totalRevenue: number;
  pendingCount: number;
  failedCount: number;
  expiredCount: number;
  cancelledCount: number;
  refundedCount: number;
  previousTotalSales: number;
  previousTotalRevenue: number;
  previousPendingCount: number;
  averageTicket: number;
  previousAverageTicket: number;
  period: string;
  fromCache: boolean;
}

export type DashboardRange = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all';
