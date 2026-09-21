import type { FunnelPort } from '../ports/funnel.port.js';
import type {
  Funnel,
  CreateFunnelInput,
  UpdateFunnelInput,
  FunnelLead,
  FunnelLeadStats,
  FunnelAnalytics,
  FunnelCheckoutOptions,
} from '../types/funnel.js';
import { mergeDeep } from '../../shared/merge.js';

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

  /**
   * The API replaces each top-level field whole, so `design: { colors }` would drop general,
   * header, typography, animation and loadingScreen. `design` and `settings` are merged into the
   * stored document first, the way the dashboard editor does before its PUT. `steps`, `flow` and
   * `scoring` stay whole replacements: they are lists the caller sends complete.
   */
  async update(funnelId: string, input: UpdateFunnelInput): Promise<Funnel> {
    if (input.design === undefined && input.settings === undefined) {
      return this.funnelPort.update(funnelId, input);
    }
    // Unsanitized on purpose: merging from the sanitized read would write the hidden fields back
    // as absent and erase them.
    const stored = await this.funnelPort.getStored(funnelId);
    return this.funnelPort.update(funnelId, {
      ...input,
      ...(input.design !== undefined ? { design: mergeDeep(stored.design, input.design) } : {}),
      ...(input.settings !== undefined ? { settings: mergeDeep(stored.settings, input.settings) } : {}),
    });
  }

  async listCheckouts(method?: 'pix' | 'credit_card'): Promise<FunnelCheckoutOptions> {
    return this.funnelPort.listCheckouts(method);
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
