import type {
  FunnelImportContact, FunnelImportResult, FunnelInput, FunnelListQuery, WhatsAppFunnel, WhatsAppFunnelList,
} from '../types/whatsapp-funnel.js';

export interface WhatsAppFunnelPort {
  list(query: FunnelListQuery): Promise<WhatsAppFunnelList>;
  get(funnelId: string): Promise<WhatsAppFunnel>;
  create(input: FunnelInput): Promise<WhatsAppFunnel>;
  /** `PUT`: the saas replaces the whole funnel. */
  replace(funnelId: string, input: FunnelInput): Promise<WhatsAppFunnel>;
  delete(funnelId: string): Promise<void>;
  toggle(funnelId: string, enabled: boolean): Promise<WhatsAppFunnel>;
  importContacts(funnelId: string, contacts: FunnelImportContact[]): Promise<FunnelImportResult>;
}
