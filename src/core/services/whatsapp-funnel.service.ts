import type { WhatsAppFunnelPort } from '../ports/whatsapp-funnel.port.js';
import type {
  FunnelImportContact, FunnelInput, FunnelLayout, FunnelListQuery, WhatsAppFunnel,
} from '../types/whatsapp-funnel.js';
import { mergeDeep } from '../../shared/merge.js';

/** What a stored funnel sends back to the replace route: its fields, none of the ids and dates. */
function toInput(funnel: WhatsAppFunnel): FunnelInput {
  return {
    name: funnel.name,
    trigger: funnel.trigger,
    ...(typeof funnel.sessionGroupId === 'string' ? { sessionGroupId: funnel.sessionGroupId } : {}),
    stopOnReply: funnel.stopOnReply,
    sendWindow: funnel.sendWindow,
    signature: funnel.signature,
    coupon: funnel.coupon,
    useEmoji: funnel.useEmoji,
    steps: funnel.steps,
    ...(funnel.layout !== undefined ? { layout: funnel.layout } : {}),
  };
}

const LAYOUT_STEP_KEY = /^(?:wait|message)-(\d+)$/;

/**
 * The positions a funnel of `steps` messages can still use: `wait-N`/`message-N` past the last
 * step belong to a message that is gone, and would be drawn back if the funnel grew again.
 */
function layoutForSteps(layout: FunnelLayout | null | undefined, steps: number): FunnelLayout | null | undefined {
  if (!layout) return layout;
  const kept = Object.entries(layout).filter(([key]) => {
    const match = LAYOUT_STEP_KEY.exec(key);
    return !match || Number(match[1]) <= steps;
  });
  return kept.length ? Object.fromEntries(kept) : null;
}

export class WhatsAppFunnelService {
  constructor(private readonly port: WhatsAppFunnelPort) {}

  async list(query: FunnelListQuery) { return this.port.list(query); }
  async get(funnelId: string) { return this.port.get(funnelId); }
  async create(input: FunnelInput) { return this.port.create(input); }

  /**
   * The route replaces the whole funnel, so the stored one is read and the edit merged into it.
   * `steps` replaces as a list and `layout` as a whole drawing (its keys are positions in the
   * sequence, so merging two drawings would mix them); the other fields change one by one. Steps
   * sent without a layout keep the stored drawing, minus the positions past the new last step. The
   * keys are places in the sequence, not messages: when a message leaves from the middle, the one
   * that moves into its place takes its position.
   */
  async update(funnelId: string, patch: Partial<FunnelInput>) {
    const current = await this.port.get(funnelId);
    const { layout, ...fields } = patch;
    const merged = mergeDeep(toInput(current), fields);
    const drawing = layout !== undefined ? layout : layoutForSteps(merged.layout, merged.steps.length);
    return this.port.replace(funnelId, { ...merged, ...(drawing !== undefined ? { layout: drawing } : {}) });
  }

  async delete(funnelId: string) { return this.port.delete(funnelId); }
  async toggle(funnelId: string, enabled: boolean) { return this.port.toggle(funnelId, enabled); }
  async importContacts(funnelId: string, contacts: FunnelImportContact[]) {
    return this.port.importContacts(funnelId, contacts);
  }
}
