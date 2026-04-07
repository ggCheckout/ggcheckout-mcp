import type { DashboardPort } from '../../core/ports/dashboard.port.js';
import type { DashboardStats, DashboardRange } from '../../core/types/dashboard.js';
import type { HttpClient } from './http-client.js';

export class DashboardApiAdapter implements DashboardPort {
  constructor(private readonly http: HttpClient) {}
  async getStats(range?: DashboardRange) { return this.http.get<DashboardStats>(`/api/dashboard/stats${range ? `?range=${range}` : ''}`); }
  async getCharts(range?: DashboardRange, tz?: string) {
    const params = new URLSearchParams();
    if (range) params.append('range', range);
    if (tz) params.append('tz', tz);
    const qs = params.toString();
    return this.http.get<any>(`/api/dashboard/charts${qs ? `?${qs}` : ''}`);
  }
  async invalidateCache() { await this.http.post('/api/dashboard/invalidate'); }
}
