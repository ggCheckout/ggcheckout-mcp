import type { SessionGroupUpdate, WhatsAppPort } from '../../core/ports/whatsapp.port.js';
import type {
  WhatsAppNumber, WhatsAppSessionGroup, WhatsAppMessageTemplate, WhatsAppDelivery,
  WhatsAppDeliverySummary, CreateTemplateInput, UpdateTemplateInput,
} from '../../core/types/whatsapp.js';
import { sanitizeWhatsappNumber, sanitizeWhatsappDelivery } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

const seg = encodeURIComponent;

/**
 * The dashboard's WhatsApp model: chips (`/api/whatsapp/numbers`) are the connected numbers, and a
 * session (`/api/whatsapp/groups`) is a primary chip with up to two fallbacks, sending for a set of
 * products. Creating or deleting a chip or a session, and connecting a Meta chip, refuse API keys
 * (403 by design); those happen in the dashboard.
 */
export class WhatsAppApiAdapter implements WhatsAppPort {
  constructor(private readonly http: HttpClient) {}

  async listNumbers(): Promise<WhatsAppNumber[]> {
    const chips = await this.http.get<WhatsAppNumber[]>('/api/whatsapp/numbers');
    return chips.map(sanitizeWhatsappNumber);
  }

  async getNumber(numberId: string): Promise<WhatsAppNumber> {
    return sanitizeWhatsappNumber(await this.http.get<WhatsAppNumber>(`/api/whatsapp/numbers/${seg(numberId)}`));
  }

  async setNumberActive(numberId: string, isActive: boolean): Promise<WhatsAppNumber> {
    return sanitizeWhatsappNumber(await this.http.patch<WhatsAppNumber>(`/api/whatsapp/numbers/${seg(numberId)}`, { isActive }));
  }

  async getPairingCode(numberId: string, phoneNumber: string) {
    return this.http.post<{ success: boolean; code: string; message?: string }>(
      `/api/whatsapp/numbers/${seg(numberId)}/pairing-code`, { phoneNumber },
    );
  }

  async restartNumber(numberId: string) {
    return this.http.post<{ message: string; numberId: string }>(`/api/whatsapp/numbers/${seg(numberId)}/restart`);
  }

  async listSessions(): Promise<WhatsAppSessionGroup[]> {
    return this.http.get<WhatsAppSessionGroup[]>('/api/whatsapp/groups');
  }

  async getSession(sessionId: string): Promise<WhatsAppSessionGroup> {
    return this.http.get<WhatsAppSessionGroup>(`/api/whatsapp/groups/${seg(sessionId)}`);
  }

  async updateSession(sessionId: string, update: SessionGroupUpdate): Promise<WhatsAppSessionGroup> {
    return this.http.patch<WhatsAppSessionGroup>(`/api/whatsapp/groups/${seg(sessionId)}`, update);
  }

  async addSessionNumber(sessionId: string, numberId: string): Promise<WhatsAppSessionGroup> {
    return this.http.post<WhatsAppSessionGroup>(`/api/whatsapp/groups/${seg(sessionId)}/numbers`, { numberId });
  }

  async removeSessionNumber(sessionId: string, numberId: string): Promise<WhatsAppSessionGroup> {
    return this.http.delete<WhatsAppSessionGroup>(`/api/whatsapp/groups/${seg(sessionId)}/numbers/${seg(numberId)}`);
  }

  async setSessionProducts(sessionId: string, productIds: string[]): Promise<WhatsAppSessionGroup> {
    return this.http.patch<WhatsAppSessionGroup>(`/api/whatsapp/groups/${seg(sessionId)}/products`, { assignedProducts: productIds });
  }

  async listTemplates(sessionId?: string): Promise<WhatsAppMessageTemplate[]> {
    const url = sessionId ? `/api/whatsapp/templates?sessionId=${seg(sessionId)}` : '/api/whatsapp/templates';
    return this.http.get<WhatsAppMessageTemplate[]>(url);
  }

  async createTemplate(input: CreateTemplateInput): Promise<WhatsAppMessageTemplate> {
    return this.http.post<WhatsAppMessageTemplate>('/api/whatsapp/templates', input);
  }

  async updateTemplate(templateId: string, input: UpdateTemplateInput): Promise<WhatsAppMessageTemplate> {
    return this.http.patch<WhatsAppMessageTemplate>(`/api/whatsapp/templates/${seg(templateId)}`, input);
  }

  async toggleTemplate(templateId: string): Promise<WhatsAppMessageTemplate> {
    return this.http.post<WhatsAppMessageTemplate>(`/api/whatsapp/templates/${seg(templateId)}/toggle`);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.http.delete(`/api/whatsapp/templates/${seg(templateId)}`);
  }

  async getDeliveryStatus(paymentId: string) {
    const data = await this.http.get<{ deliveries: WhatsAppDelivery[]; summary: WhatsAppDeliverySummary }>(
      `/api/whatsapp/deliveries/${seg(paymentId)}`,
    );
    return { ...data, deliveries: data.deliveries.map(sanitizeWhatsappDelivery) };
  }

  async resendDelivery(paymentId: string) {
    return this.http.post<{ success: boolean; message: string }>(`/api/whatsapp/deliveries/${seg(paymentId)}/resend`);
  }
}
