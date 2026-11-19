import type { SessionGroupUpdate, WhatsAppPort } from '../ports/whatsapp.port.js';
import type { CreateTemplateInput, UpdateTemplateInput } from '../types/whatsapp.js';

export class WhatsAppService {
  constructor(private readonly port: WhatsAppPort) {}

  async listNumbers() { return this.port.listNumbers(); }
  async getNumber(numberId: string) { return this.port.getNumber(numberId); }
  async setNumberActive(numberId: string, isActive: boolean) { return this.port.setNumberActive(numberId, isActive); }
  async getPairingCode(numberId: string, phoneNumber: string) { return this.port.getPairingCode(numberId, phoneNumber); }
  async restartNumber(numberId: string) { return this.port.restartNumber(numberId); }
  async checkNumbersHealth() { return this.port.checkNumbersHealth(); }

  async listSessions() { return this.port.listSessions(); }
  async getSession(sessionId: string) { return this.port.getSession(sessionId); }
  async updateSession(sessionId: string, update: SessionGroupUpdate) { return this.port.updateSession(sessionId, update); }
  async addSessionNumber(sessionId: string, numberId: string) { return this.port.addSessionNumber(sessionId, numberId); }
  async removeSessionNumber(sessionId: string, numberId: string) { return this.port.removeSessionNumber(sessionId, numberId); }
  async setSessionProducts(sessionId: string, productIds: string[]) { return this.port.setSessionProducts(sessionId, productIds); }

  async listTemplates(sessionId?: string) { return this.port.listTemplates(sessionId); }
  async createTemplate(input: CreateTemplateInput) { return this.port.createTemplate(input); }
  async updateTemplate(templateId: string, input: UpdateTemplateInput) { return this.port.updateTemplate(templateId, input); }
  async toggleTemplate(templateId: string) { return this.port.toggleTemplate(templateId); }
  async deleteTemplate(templateId: string) { return this.port.deleteTemplate(templateId); }

  async getDeliveryStatus(paymentId: string) { return this.port.getDeliveryStatus(paymentId); }
  async resendDelivery(paymentId: string) { return this.port.resendDelivery(paymentId); }
}
