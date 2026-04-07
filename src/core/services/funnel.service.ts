import type { FunnelPort } from '../ports/funnel.port.js';
import type {
  Funnel,
  CreateFunnelInput,
  UpdateFunnelInput,
  FunnelLead,
  FunnelLeadStats,
  FunnelAnalytics,
} from '../types/funnel.js';

export class FunnelService {
  constructor(private readonly funnelPort: FunnelPort) {}

  async list(): Promise<Funnel[]> {
    return this.funnelPort.list();
  }

  async getById(funnelId: string): Promise<Funnel> {
    return this.funnelPort.getById(funnelId);
  }

  async create(input: CreateFunnelInput): Promise<Funnel> {
    return this.funnelPort.create(input);
  }

  async update(funnelId: string, input: UpdateFunnelInput): Promise<Funnel> {
    return this.funnelPort.update(funnelId, input);
  }

  async delete(funnelId: string): Promise<void> {
    return this.funnelPort.delete(funnelId);
  }

  async duplicate(funnelId: string): Promise<Funnel> {
    return this.funnelPort.duplicate(funnelId);
  }

  async listLeads(funnelId: string, options?: { status?: string; limit?: number; offset?: number }) {
    return this.funnelPort.listLeads(funnelId, options);
  }

  async getLeadAnalytics(funnelId: string): Promise<FunnelAnalytics> {
    return this.funnelPort.getLeadAnalytics(funnelId);
  }

  async getLeadStats(funnelId: string): Promise<FunnelLeadStats> {
    return this.funnelPort.getLeadStats(funnelId);
  }
}
