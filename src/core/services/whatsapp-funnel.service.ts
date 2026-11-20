import type { WhatsAppFunnelPort } from '../ports/whatsapp-funnel.port.js';
import type {
  FunnelImportContact, FunnelInput, FunnelListQuery, WhatsAppFunnel,
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

export class WhatsAppFunnelService {
  constructor(private readonly port: WhatsAppFunnelPort) {}

  async list(query: FunnelListQuery) { return this.port.list(query); }
  async get(funnelId: string) { return this.port.get(funnelId); }
  async create(input: FunnelInput) { return this.port.create(input); }

  /**
   * The route replaces the whole funnel, so the stored one is read and the edit merged into it;
   * `steps` replaces as a list, the other fields change one by one.
   */
  async update(funnelId: string, patch: Partial<FunnelInput>) {
    const current = await this.port.get(funnelId);
    return this.port.replace(funnelId, mergeDeep(toInput(current), patch));
  }

  async delete(funnelId: string) { return this.port.delete(funnelId); }
  async toggle(funnelId: string, enabled: boolean) { return this.port.toggle(funnelId, enabled); }
  async importContacts(funnelId: string, contacts: FunnelImportContact[]) {
    return this.port.importContacts(funnelId, contacts);
  }
}
