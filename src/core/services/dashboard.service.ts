import type { DashboardPort } from '../ports/dashboard.port.js';
import type { DashboardRange } from '../types/dashboard.js';
export class DashboardService {
  constructor(private readonly port: DashboardPort) {}
  async getStats(range?: DashboardRange) { return this.port.getStats(range); }
  async getCharts(range?: DashboardRange, tz?: string) { return this.port.getCharts(range, tz); }
  async invalidateCache() { return this.port.invalidateCache(); }
}
