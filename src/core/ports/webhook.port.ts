import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from '../types/webhook.js';

export interface WebhookPort {
  list(): Promise<Webhook[]>;
  getById(id: string): Promise<Webhook>;
  create(payload: CreateWebhookInput): Promise<Webhook>;
  update(id: string, payload: UpdateWebhookInput): Promise<Webhook>;
  delete(id: string): Promise<void>;
}
