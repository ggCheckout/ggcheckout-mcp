import type { AuthPort } from '../ports/auth.port.js';
import type { WebhookPort } from '../ports/webhook.port.js';
import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from '../types/webhook.js';

export class WebhookService {
  constructor(
    private readonly webhookPort: WebhookPort,
    private readonly authPort: AuthPort,
  ) {}

  async list(): Promise<Webhook[]> {
    return this.webhookPort.list();
  }

  async getById(id: string): Promise<Webhook> {
    return this.webhookPort.getById(id);
  }

  async create(input: CreateWebhookInput): Promise<Webhook> {
    if (!input.businessId) {
      input.businessId = await this.authPort.getMyBusinessId();
    }
    return this.webhookPort.create(input);
  }

  async update(id: string, input: UpdateWebhookInput): Promise<Webhook> {
    return this.webhookPort.update(id, input);
  }

  async delete(id: string): Promise<void> {
    return this.webhookPort.delete(id);
  }
}
