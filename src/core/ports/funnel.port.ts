import type {
  Funnel,
  CreateFunnelInput,
  UpdateFunnelInput,
  FunnelLead,
  FunnelLeadStats,
  FunnelAnalytics,
} from '../types/funnel.js';

export interface FunnelPort {
  list(): Promise<Funnel[]>;
  getById(funnelId: string): Promise<Funnel>;
  create(input: CreateFunnelInput): Promise<Funnel>;
  update(funnelId: string, input: UpdateFunnelInput): Promise<Funnel>;
  delete(funnelId: string): Promise<void>;
  duplicate(funnelId: string): Promise<Funnel>;
  listLeads(funnelId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<{
    leads: FunnelLead[];
    count: number;
    total: number;
    limit: number;
    offset: number;
  }>;
  getLeadAnalytics(funnelId: string): Promise<FunnelAnalytics>;
  getLeadStats(funnelId: string): Promise<FunnelLeadStats>;
}
