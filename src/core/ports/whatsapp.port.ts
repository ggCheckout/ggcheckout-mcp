import type {
  WhatsAppNumber, WhatsAppSessionGroup, WhatsAppMessageTemplate, WhatsAppDelivery,
  WhatsAppDeliverySummary, CreateTemplateInput, UpdateTemplateInput, WhatsAppNumbersHealth } from '../types/whatsapp.js';

export interface SessionGroupUpdate {
  name?: string;
  isActive?: boolean;
  primaryNumberId?: string;
  fallbackNumberIds?: string[];
}

export interface WhatsAppPort {
  listNumbers(): Promise<WhatsAppNumber[]>;
  getNumber(numberId: string): Promise<WhatsAppNumber>;
  setNumberActive(numberId: string, isActive: boolean): Promise<WhatsAppNumber>;
  getPairingCode(numberId: string, phoneNumber: string): Promise<{ success: boolean; code: string; message?: string }>;
  restartNumber(numberId: string): Promise<{ message: string; numberId: string }>;
  checkNumbersHealth(): Promise<WhatsAppNumbersHealth>;

  listSessions(): Promise<WhatsAppSessionGroup[]>;
  getSession(sessionId: string): Promise<WhatsAppSessionGroup>;
  updateSession(sessionId: string, update: SessionGroupUpdate): Promise<WhatsAppSessionGroup>;
  addSessionNumber(sessionId: string, numberId: string): Promise<WhatsAppSessionGroup>;
  removeSessionNumber(sessionId: string, numberId: string): Promise<WhatsAppSessionGroup>;
  setSessionProducts(sessionId: string, productIds: string[]): Promise<WhatsAppSessionGroup>;

  listTemplates(sessionId?: string): Promise<WhatsAppMessageTemplate[]>;
  createTemplate(input: CreateTemplateInput): Promise<WhatsAppMessageTemplate>;
  updateTemplate(templateId: string, input: UpdateTemplateInput): Promise<WhatsAppMessageTemplate>;
  toggleTemplate(templateId: string): Promise<WhatsAppMessageTemplate>;
  deleteTemplate(templateId: string): Promise<void>;

  getDeliveryStatus(paymentId: string): Promise<{ deliveries: WhatsAppDelivery[]; summary: WhatsAppDeliverySummary }>;
  resendDelivery(paymentId: string): Promise<{ success: boolean; message: string }>;
}
