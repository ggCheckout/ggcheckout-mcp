import type { WhatsAppFunnelPort } from '../../core/ports/whatsapp-funnel.port.js';
import type {
  FunnelImportContact, FunnelImportResult, FunnelInput, FunnelListQuery, WhatsAppFunnel, WhatsAppFunnelList,
} from '../../core/types/whatsapp-funnel.js';
import type { HttpClient } from './http-client.js';
import { guarded } from './whatsapp-guard.js';

const seg = encodeURIComponent;
const BASE = '/api/whatsapp/funnels';

/**
 * The seller's WhatsApp funnels (`/api/whatsapp/funnels`). CRUD and toggle accept an API key; the
 * contact import needs the store's "Permitir acesso pelo MCP" too (403 INBOX_API_ACCESS_DISABLED).
 */
export class WhatsAppFunnelApiAdapter implements WhatsAppFunnelPort {
  constructor(private readonly http: HttpClient) {}

  list({ limit, after }: FunnelListQuery): Promise<WhatsAppFunnelList> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    if (after) params.after = after;
    return guarded(() => this.http.get<WhatsAppFunnelList>(BASE, params));
  }

  get(funnelId: string): Promise<WhatsAppFunnel> {
    return guarded(() => this.http.get<WhatsAppFunnel>(`${BASE}/${seg(funnelId)}`));
  }

  create(input: FunnelInput): Promise<WhatsAppFunnel> {
    return guarded(() => this.http.post<WhatsAppFunnel>(BASE, input));
  }

  replace(funnelId: string, input: FunnelInput): Promise<WhatsAppFunnel> {
    return guarded(() => this.http.put<WhatsAppFunnel>(`${BASE}/${seg(funnelId)}`, input));
  }

  async delete(funnelId: string): Promise<void> {
    await guarded(() => this.http.delete(`${BASE}/${seg(funnelId)}`));
  }

  toggle(funnelId: string, enabled: boolean): Promise<WhatsAppFunnel> {
    return guarded(() => this.http.post<WhatsAppFunnel>(`${BASE}/${seg(funnelId)}/toggle`, { enabled }));
  }

  importContacts(funnelId: string, contacts: FunnelImportContact[]): Promise<FunnelImportResult> {
    return guarded(() => this.http.post<FunnelImportResult>(`${BASE}/${seg(funnelId)}/runs/import`, { contacts }));
  }
}
