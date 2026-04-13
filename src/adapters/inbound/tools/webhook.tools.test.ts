import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WebhookService } from '../../../core/services/webhook.service.js';
import { registerWebhookTools } from './webhook.tools.js';

vi.mock('axios');
vi.mock('../../../shared/logger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

function createMockService(): WebhookService {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any;
}

describe('test_webhook tool', () => {
  let server: McpServer;
  let service: ReturnType<typeof createMockService>;
  let testWebhookHandler: (args: any) => Promise<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.0.1' });
    service = createMockService();
    registerWebhookTools(server, service);

    const registeredTools = (server as any)._registeredTools ?? (server as any).tools ?? {};
    const tool = registeredTools['test_webhook'];
    testWebhookHandler = tool?.callback ?? tool?.handler ?? tool;
    if (typeof testWebhookHandler !== 'function') {
      throw new Error('Could not locate test_webhook handler on McpServer internals');
    }
  });

  it('POSTs correct payload to webhook URL for payment.paid event', async () => {
    vi.mocked(service.getById).mockResolvedValue({
      id: 'wh1',
      businessId: 'biz1',
      name: 'My Webhook',
      url: 'https://myapp.com/webhook',
      events: ['payment.paid'],
    });
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: 'ok' });

    const result = await testWebhookHandler({ webhookId: 'wh1', event: 'payment.paid' });
    const parsed = JSON.parse(result.content[0].text);

    expect(axios.post).toHaveBeenCalledWith(
      'https://myapp.com/webhook',
      expect.stringContaining('"event":"payment.paid"'),
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    );
    expect(parsed.status).toBe(200);
    expect(parsed.sentPayload.event).toBe('payment.paid');
  });

  it('includes X-Webhook-Signature header when webhook has a secret', async () => {
    vi.mocked(service.getById).mockResolvedValue({
      id: 'wh2',
      businessId: 'biz1',
      name: 'Signed Webhook',
      url: 'https://myapp.com/webhook',
      secret: 'my-secret',
      events: ['payment.paid'],
    });
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: 'ok' });

    await testWebhookHandler({ webhookId: 'wh2', event: 'payment.paid' });

    const callArgs = vi.mocked(axios.post).mock.calls[0];
    const headers = callArgs?.[2]?.headers as Record<string, string> | undefined;
    expect(headers?.['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('applies overrides to the generated payload', async () => {
    vi.mocked(service.getById).mockResolvedValue({
      id: 'wh3',
      businessId: 'biz1',
      name: 'Override Webhook',
      url: 'https://myapp.com/webhook',
      events: ['payment.paid'],
    });
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: 'ok' });

    await testWebhookHandler({
      webhookId: 'wh3',
      event: 'payment.paid',
      overrides: { payment: { id: 'pay_custom_001' } },
    });

    const callArgs = vi.mocked(axios.post).mock.calls[0];
    const sentBody = JSON.parse(callArgs[1] as string);
    expect(sentBody.payment.id).toBe('pay_custom_001');
    expect(sentBody.payment.status).toBe('paid'); // other fields preserved
  });

  it('returns endpoint response body even when endpoint returns 500', async () => {
    vi.mocked(service.getById).mockResolvedValue({
      id: 'wh4',
      businessId: 'biz1',
      name: 'Error Webhook',
      url: 'https://myapp.com/webhook',
      events: ['payment.paid'],
    });
    const httpError = Object.assign(new Error('Request failed with status code 500'), {
      response: { status: 500, data: 'Internal Server Error' },
    });
    vi.mocked(axios.post).mockRejectedValue(httpError);

    const result = await testWebhookHandler({ webhookId: 'wh4', event: 'payment.paid' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.status).toBe(500);
    expect(result.isError).toBeUndefined();
  });

  it('returns error when webhook URL is unreachable', async () => {
    vi.mocked(service.getById).mockResolvedValue({
      id: 'wh5',
      businessId: 'biz1',
      name: 'Down Webhook',
      url: 'https://myapp.com/webhook',
      events: ['payment.paid'],
    });
    const connError = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    vi.mocked(axios.post).mockRejectedValue(connError);

    const result = await testWebhookHandler({ webhookId: 'wh5', event: 'payment.paid' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Could not reach webhook URL');
    expect(result.content[0].text).toContain('https://myapp.com/webhook');
  });
});
