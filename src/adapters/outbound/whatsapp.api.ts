import type { WhatsAppPort } from '../../core/ports/whatsapp.port.js';
import type {
  WhatsAppSession, WhatsAppMessageTemplate, WhatsAppDelivery,
  WhatsAppDeliverySummary, CreateTemplateInput, SendMessageInput,
} from '../../core/types/whatsapp.js';
import type { HttpClient } from './http-client.js';

export class WhatsAppApiAdapter implements WhatsAppPort {
  constructor(private readonly http: HttpClient) {}

  async listSessions(): Promise<WhatsAppSession[]> {
    return this.http.get<WhatsAppSession[]>('/api/whatsapp/sessions');
  }

  async getSession(sessionId: string): Promise<WhatsAppSession> {
    return this.http.get<WhatsAppSession>(`/api/whatsapp/sessions/${sessionId}`);
  }

  async createSession(sessionName: string): Promise<WhatsAppSession> {
    return this.http.post<WhatsAppSession>('/api/whatsapp/sessions', { sessionName });
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
    return this.http.get<{ deliveries: WhatsAppDelivery[]; summary: WhatsAppDeliverySummary }>(
      `/api/whatsapp/deliveries/${paymentId}`,
    );
  }

  async resendDelivery(paymentId: string) {
    return this.http.post<{ success: boolean; message: string }>(
      `/api/whatsapp/deliveries/${paymentId}/resend`,
    );
  }

  async sendMessage(input: SendMessageInput) {
    return this.http.post<{ message: string; data: any }>('/api/whatsapp/send', input);
  }
}
