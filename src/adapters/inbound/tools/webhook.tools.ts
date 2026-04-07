import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WebhookService } from '../../../core/services/webhook.service.js';
import { createToolHandler } from '../tool-handler.js';

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
}
