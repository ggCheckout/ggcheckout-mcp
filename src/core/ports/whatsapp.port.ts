import type {
  WhatsAppSession, WhatsAppMessageTemplate, WhatsAppDelivery,
  WhatsAppDeliverySummary, CreateTemplateInput, SendMessageInput,
} from '../types/whatsapp.js';

export interface WhatsAppPort {
  listSessions(): Promise<WhatsAppSession[]>;
  getSession(sessionId: string): Promise<WhatsAppSession>;
  createSession(sessionName: string): Promise<WhatsAppSession>;
  deleteSession(sessionId: string): Promise<void>;
  getPairingCode(sessionId: string, phoneNumber: string): Promise<{ success: boolean; code: string }>;

  listTemplates(sessionId?: string): Promise<WhatsAppMessageTemplate[]>;
  createTemplate(input: CreateTemplateInput): Promise<WhatsAppMessageTemplate>;
  updateTemplate(templateId: string, input: Partial<CreateTemplateInput>): Promise<WhatsAppMessageTemplate>;
  toggleTemplate(templateId: string): Promise<WhatsAppMessageTemplate>;
  deleteTemplate(templateId: string): Promise<void>;

  getDeliveryStatus(paymentId: string): Promise<{ deliveries: WhatsAppDelivery[]; summary: WhatsAppDeliverySummary }>;
  resendDelivery(paymentId: string): Promise<{ success: boolean; message: string }>;
  sendMessage(input: SendMessageInput): Promise<{ message: string; data: any }>;
}
