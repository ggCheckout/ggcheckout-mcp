import { createHmac } from 'crypto';
import axios from 'axios';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WebhookService } from '../../../core/services/webhook.service.js';
import { createToolHandler } from '../tool-handler.js';
import { WEBHOOK_EVENTS, webhookFixtures } from '../../../shared/webhook-fixtures.js';

export function registerWebhookTools(server: McpServer, service: WebhookService) {
  server.tool(
    'list_webhooks',
    'List all webhooks for the authenticated user',
    createToolHandler('list_webhooks', async () => {
      const webhooks = await service.list();
      return { webhooks };
    }),
  );

  server.registerTool(
    'get_webhook',
    {
      description: 'Get details of a specific webhook by ID',
      inputSchema: {
        webhookId: z.string().describe('Webhook ID'),
      },
    },
    createToolHandler('get_webhook', async ({ webhookId }) => {
      const webhook = await service.getById(webhookId);
      return { webhook };
    }),
  );

  server.registerTool(
    'create_webhook',
    {
      description: 'Create a new webhook for payment notifications',
      inputSchema: {
        name: z.string().max(200).describe('Webhook name/description'),
        url: z.string().url().describe('Webhook URL endpoint to receive notifications'),
        events: z
          .array(z.string())
          .max(100)
          .describe(
            'Events to trigger this webhook (e.g., ["payment.created", "payment.paid", "payment.refunded"])',
          ),
        secret: z
          .string()
          .max(200)
          .optional()
          .describe('Secret key for webhook signature verification (optional)'),
        productsId: z
          .array(z.string())
          .max(100)
          .optional()
          .describe('Product IDs to filter notifications (optional - leave empty for all products)'),
      },
    },
    createToolHandler('create_webhook', async (args) => {
      const webhook = await service.create(args);
      return { success: true, webhook };
    }),
  );

  server.registerTool(
    'update_webhook',
    {
      description: 'Update an existing webhook. Only provide fields you want to update.',
      inputSchema: {
        webhookId: z.string().describe('Webhook ID'),
        name: z.string().max(200).optional().describe('New webhook name/description'),
        url: z.string().url().optional().describe('New webhook URL'),
        events: z.array(z.string()).max(100).optional().describe('New events list'),
        secret: z.string().max(200).optional().describe('New secret key'),
        productsId: z.array(z.string()).max(100).optional().describe('New product IDs filter'),
      },
    },
    createToolHandler('update_webhook', async ({ webhookId, ...input }) => {
      const webhook = await service.update(webhookId, input);
      return { success: true, webhook };
    }),
  );

  server.registerTool(
    'delete_webhook',
    {
      description: 'Delete a webhook by ID',
      inputSchema: {
        webhookId: z.string().describe('Webhook ID'),
      },
    },
    createToolHandler('delete_webhook', async ({ webhookId }) => {
      await service.delete(webhookId);
      return { success: true, message: `Webhook ${webhookId} deleted successfully` };
    }),
  );

  server.registerTool(
    'test_webhook',
    {
      description:
        'Send a realistic test event payload directly to a webhook endpoint. Useful for validating that your endpoint handles real event shapes correctly (e.g., payment.paid, payment.refunded). The payload is sent directly from this MCP server to your webhook URL — no GG Checkout backend involvement.',
      inputSchema: {
        webhookId: z.string().describe('ID of the webhook to test (used to look up the URL and secret)'),
        event: z
          .enum(WEBHOOK_EVENTS)
          .describe(
            'Event type to simulate: payment.created | payment.paid | payment.refunded | payment.expired | payment.chargeback',
          ),
        overrides: z
          .record(z.unknown())
          .optional()
          .describe(
            'Optional fields to override in the generated payload (shallow merge at top level, e.g. { "payment": { "id": "pay_custom_001" } })',
          ),
      },
    },
    createToolHandler(
      'test_webhook',
      async ({ webhookId, event, overrides }: { webhookId: string; event: typeof WEBHOOK_EVENTS[number]; overrides?: Record<string, unknown> }) => {
        const webhook = await service.getById(webhookId);

        const basePayload = webhookFixtures[event];
        const payload = overrides
          ? { ...basePayload, ...overrides, payment: { ...basePayload.payment, ...((overrides.payment as any) ?? {}) } }
          : basePayload;

        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-GGCheckout-Event': event,
        };

        if (webhook.secret) {
          const sig = createHmac('sha256', webhook.secret).update(body).digest('hex');
          headers['X-Webhook-Signature'] = `sha256=${sig}`;
        }

        try {
          const response = await axios.post(webhook.url, body, { headers, timeout: 10_000 });
          return { status: response.status, responseBody: response.data, sentPayload: payload };
        } catch (err: any) {
          const isNetworkError = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || !err.response;
          if (isNetworkError) {
            throw new Error(`Could not reach webhook URL: ${webhook.url}. Check that the endpoint is publicly accessible.`);
          }
          // Endpoint returned an HTTP error — surface it as a result, not an exception
          return { status: err.response.status, responseBody: err.response.data, sentPayload: payload };
        }
      },
    ),
  );
}
