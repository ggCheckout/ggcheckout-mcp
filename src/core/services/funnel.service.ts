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
    const stored = await this.funnelPort.getRawForMerge(funnelId);
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

  /**
   * The drop-off report names each step only by id, which neither the model nor the seller can
   * read; the funnel is read alongside so every step carries its title, as the dashboard's
   * conversion chart shows it ("Etapa N" for a step without one). The titles are an enrichment:
   * when reading the funnel fails the report still answers, with "Etapa N" and no funnel title.
   */
  async getLeadAnalytics(funnelId: string): Promise<FunnelAnalytics> {
    const [analyticsRead, funnelRead] = await Promise.allSettled([
      this.funnelPort.getLeadAnalytics(funnelId),
      this.funnelPort.getById(funnelId),
    ]);
    if (analyticsRead.status === 'rejected') throw analyticsRead.reason;
    const analytics = analyticsRead.value;
    const funnel = funnelRead.status === 'fulfilled' ? funnelRead.value : undefined;
    const titles = new Map((funnel?.steps ?? []).map((step) => [step.id, step.title]));
    return {
      ...analytics,
      ...(funnel ? { funnelTitle: funnel.title } : {}),
      steps: (analytics.steps ?? []).map((step, index) => ({
        ...step,
        title: titles.get(step.stepId) || `Etapa ${index + 1}`,
      })),
    };
  }

  async getLeadStats(funnelId: string): Promise<FunnelLeadStats> {
    return this.funnelPort.getLeadStats(funnelId);
  }
}
