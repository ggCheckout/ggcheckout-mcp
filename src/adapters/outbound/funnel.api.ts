import type { FunnelPort } from '../../core/ports/funnel.port.js';
import type {
  Funnel,
  CreateFunnelInput,
  UpdateFunnelInput,
  FunnelLead,
  FunnelLeadStats,
  FunnelAnalytics,
} from '../../core/types/funnel.js';
import { sanitizeFunnel, sanitizeLead } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

export class FunnelApiAdapter implements FunnelPort {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Funnel[]> {
    const data = await this.http.get<{ funnels: Funnel[] }>('/api/funnels');
    return data.funnels.map(sanitizeFunnel);
  }

  async getById(funnelId: string): Promise<Funnel> {
    const data = await this.http.get<{ funnel: Funnel }>(`/api/funnels/${funnelId}`);
    return sanitizeFunnel(data.funnel);
  }

  async create(input: CreateFunnelInput): Promise<Funnel> {
    const data = await this.http.post<{ funnel: Funnel }>('/api/funnels', input);
    return sanitizeFunnel(data.funnel);
  }

  async update(funnelId: string, input: UpdateFunnelInput): Promise<Funnel> {
    const data = await this.http.put<{ funnel: Funnel }>(`/api/funnels/${funnelId}`, input);
    return sanitizeFunnel(data.funnel);
  }

  async delete(funnelId: string): Promise<void> {
    await this.http.delete(`/api/funnels/${funnelId}`);
  }

  async duplicate(funnelId: string): Promise<Funnel> {
    const data = await this.http.post<{ funnel: Funnel }>(`/api/funnels/${funnelId}/duplicate`);
    return sanitizeFunnel(data.funnel);
  }

  async listLeads(funnelId: string, options?: { status?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const queryString = params.toString();
    const url = `/api/funnels/${funnelId}/leads${queryString ? `?${queryString}` : ''}`;

    const data = await this.http.get<{
      leads: FunnelLead[];
      count: number;
      total: number;
      limit: number;
      offset: number;
    }>(url);
    return { ...data, leads: data.leads.map(sanitizeLead) };
  }

  async getLeadAnalytics(funnelId: string): Promise<FunnelAnalytics> {
    return this.http.get<FunnelAnalytics>(`/api/funnels/${funnelId}/leads/analytics`);
  }

  async getLeadStats(funnelId: string): Promise<FunnelLeadStats> {
    const data = await this.http.get<{ stats: FunnelLeadStats }>(`/api/funnels/${funnelId}/leads/stats`);
    return data.stats;
  }
}
