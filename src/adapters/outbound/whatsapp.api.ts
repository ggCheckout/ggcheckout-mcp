import type { WhatsAppPort } from '../../core/ports/whatsapp.port.js';
import type {
  WhatsAppSession, WhatsAppMessageTemplate, WhatsAppDelivery,
  WhatsAppDeliverySummary, CreateTemplateInput, SendMessageInput,
} from '../../core/types/whatsapp.js';
import { sanitizeWhatsappSession, sanitizeWhatsappDelivery } from '../../shared/sanitizer.js';
import { ApiError, AuthenticationError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

export class WhatsAppApiAdapter implements WhatsAppPort {
  constructor(private readonly http: HttpClient) {}

  async listSessions(): Promise<WhatsAppSession[]> {
    const sessions = await this.http.get<WhatsAppSession[]>('/api/whatsapp/sessions');
    return sessions.map(sanitizeWhatsappSession);
  }

  async getSession(sessionId: string): Promise<WhatsAppSession> {
    const session = await this.http.get<WhatsAppSession>(`/api/whatsapp/sessions/${sessionId}`);
    return sanitizeWhatsappSession(session);
  }

  /**
   * This route blocks API keys deliberately — it is classed as sensitive, and the refusal is
   * logged as a security event — so it answers 403 and no key will ever work. Listing, deleting
   * and the pairing code all accept the key; only creating does not.
   */
  async createSession(sessionName: string): Promise<WhatsAppSession> {
    try {
      const session = await this.http.post<WhatsAppSession>('/api/whatsapp/sessions', { sessionName });
      return sanitizeWhatsappSession(session);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 403) {
        throw new ApiError(
          403,
          'Creating a WhatsApp session is blocked for API keys on purpose: the route only accepts a '
          + 'browser session or a Firebase ID token, and the refusal is logged. Retrying will not help '
          + 'and no argument changes it. Create the session in the dashboard, then list_whatsapp_sessions, '
          + 'get_pairing_code and the template tools all work with this API key.',
          error,
        );
      }
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.http.delete(`/api/whatsapp/sessions/${sessionId}`);
  }

  async getPairingCode(sessionId: string, phoneNumber: string) {
    return this.http.post<{ success: boolean; code: string }>(
      `/api/whatsapp/sessions/${sessionId}/pairing-code`, { phoneNumber },
    );
  }

  async listTemplates(sessionId?: string): Promise<WhatsAppMessageTemplate[]> {
    const url = sessionId ? `/api/whatsapp/templates?sessionId=${sessionId}` : '/api/whatsapp/templates';
    return this.http.get<WhatsAppMessageTemplate[]>(url);
  }

  async createTemplate(input: CreateTemplateInput): Promise<WhatsAppMessageTemplate> {
    return this.http.post<WhatsAppMessageTemplate>('/api/whatsapp/templates', input);
  }

  async updateTemplate(templateId: string, input: Partial<CreateTemplateInput>): Promise<WhatsAppMessageTemplate> {
    return this.http.patch<WhatsAppMessageTemplate>(`/api/whatsapp/templates/${templateId}`, input);
  }

  async toggleTemplate(templateId: string): Promise<WhatsAppMessageTemplate> {
    return this.http.post<WhatsAppMessageTemplate>(`/api/whatsapp/templates/${templateId}/toggle`);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.http.delete(`/api/whatsapp/templates/${templateId}`);
  }

  async getDeliveryStatus(paymentId: string) {
    const data = await this.http.get<{ deliveries: WhatsAppDelivery[]; summary: WhatsAppDeliverySummary }>(
      `/api/whatsapp/deliveries/${paymentId}`,
    );
    return { ...data, deliveries: data.deliveries.map(sanitizeWhatsappDelivery) };
  }

  /**
   * Reading a delivery accepts the API key; resending it does not — the resend route reads the
   * dashboard session cookie instead of the key-aware reader, so the key can only get 401. That
   * asymmetry on the same resource looks accidental, so the call stays and the refusal is
   * translated rather than pre-empted.
   */
  async resendDelivery(paymentId: string) {
    try {
      return await this.http.post<{ success: boolean; message: string }>(
        `/api/whatsapp/deliveries/${encodeURIComponent(paymentId)}/resend`,
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new AuthenticationError(
          'Resending a delivery is the one WhatsApp route that only accepts a dashboard session '
          + 'cookie, so an API key cannot call it (reading the same delivery with get_delivery_status '
          + 'does work). Retrying will not help. Resend it from the dashboard.',
          error,
        );
      }
      throw error;
    }
  }

  async sendMessage(input: SendMessageInput) {
    return this.http.post<{ message: string; data: any }>('/api/whatsapp/send', input);
  }
}
