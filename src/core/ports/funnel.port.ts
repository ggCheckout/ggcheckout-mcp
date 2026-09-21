import type {
  Funnel,
  CreateFunnelInput,
  UpdateFunnelInput,
  FunnelLead,
  FunnelLeadStats,
  FunnelAnalytics,
  FunnelCheckoutOptions,
} from '../types/funnel.js';

export interface FunnelPort {
  list(): Promise<Funnel[]>;
  getById(funnelId: string): Promise<Funnel>;
  /** The stored document, unsanitized. Only for merging an update; never hand it to the agent. */
  getRawForMerge(funnelId: string): Promise<Funnel>;
  listCheckouts(method?: 'pix' | 'credit_card'): Promise<FunnelCheckoutOptions>;
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
