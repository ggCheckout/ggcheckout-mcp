import type { WebhookPort } from '../../core/ports/webhook.port.js';
import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from '../../core/types/webhook.js';
import { NotFoundError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

interface WebhooksListResponse {
  webhooks: Webhook[];
}

export class WebhookApiAdapter implements WebhookPort {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Webhook[]> {
    const data = await this.http.get<WebhooksListResponse>('/api/clients-webhook');
    return data.webhooks;
  }

  async getById(id: string): Promise<Webhook> {
    const webhooks = await this.list();
    const webhook = webhooks.find((w) => w.id === id);
    if (!webhook) {
      throw new NotFoundError('Webhook', id);
    }
    return webhook;
  }

  async create(payload: CreateWebhookInput): Promise<Webhook> {
    return this.http.post<Webhook>('/api/clients-webhook', payload);
  }

  async update(id: string, payload: UpdateWebhookInput): Promise<Webhook> {
    return this.http.put<Webhook>(`/api/clients-webhook?id=${id}`, payload);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/clients-webhook?id=${id}`);
  }
}
