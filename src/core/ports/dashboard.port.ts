import type { DashboardStats, DashboardRange } from '../types/dashboard.js';
export interface DashboardPort {
  getStats(range?: DashboardRange): Promise<DashboardStats>;
  getCharts(range?: DashboardRange, tz?: string): Promise<any>;
  invalidateCache(): Promise<void>;
}
