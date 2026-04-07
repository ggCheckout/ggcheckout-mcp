import type { WhatsAppPort } from '../ports/whatsapp.port.js';
import type { CreateTemplateInput, SendMessageInput } from '../types/whatsapp.js';

export class WhatsAppService {
  constructor(private readonly port: WhatsAppPort) {}

  async listSessions() { return this.port.listSessions(); }
  async getSession(sessionId: string) { return this.port.getSession(sessionId); }
  async createSession(sessionName: string) { return this.port.createSession(sessionName); }
  async deleteSession(sessionId: string) { return this.port.deleteSession(sessionId); }
  async getPairingCode(sessionId: string, phoneNumber: string) { return this.port.getPairingCode(sessionId, phoneNumber); }

  async listTemplates(sessionId?: string) { return this.port.listTemplates(sessionId); }
  async createTemplate(input: CreateTemplateInput) { return this.port.createTemplate(input); }
  async updateTemplate(templateId: string, input: Partial<CreateTemplateInput>) { return this.port.updateTemplate(templateId, input); }
  async toggleTemplate(templateId: string) { return this.port.toggleTemplate(templateId); }
  async deleteTemplate(templateId: string) { return this.port.deleteTemplate(templateId); }

  async getDeliveryStatus(paymentId: string) { return this.port.getDeliveryStatus(paymentId); }
  async resendDelivery(paymentId: string) { return this.port.resendDelivery(paymentId); }
  async sendMessage(input: SendMessageInput) { return this.port.sendMessage(input); }
}
