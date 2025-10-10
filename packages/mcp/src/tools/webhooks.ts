import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../api/client.js';
import * as logger from '../utils/logger.js';

export function registerWebhookTools(server: McpServer, apiClient: ApiClient) {
  // List all webhooks
  server.tool(
    'list_webhooks',
    'List all webhooks for the authenticated user',
    async () => {
      const start = Date.now();
      try {
        logger.info('TOOL', 'list_webhooks: Starting');
        const webhooks = await apiClient.listWebhooks();
        const duration = Date.now() - start;
        logger.info('TOOL', `list_webhooks: Success (${duration}ms)`, { count: webhooks.length });
        
        const output = { webhooks };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `list_webhooks: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Get specific webhook
  server.registerTool(
    'get_webhook',
    {
      description: 'Get details of a specific webhook by ID',
      inputSchema: {
        webhookId: z.string().describe('Webhook ID')
      }
    },
    async (args: any) => {
      const { webhookId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `get_webhook: Starting for ${webhookId}`);
        const webhook = await apiClient.getWebhook(webhookId);
        const duration = Date.now() - start;
        logger.info('TOOL', `get_webhook: Success (${duration}ms)`);
        
        const output = { webhook };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `get_webhook: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Create webhook
  server.registerTool(
    'create_webhook',
    {
      description: 'Create a new webhook for payment notifications',
      inputSchema: {
        name: z.string().describe('Webhook name/description'),
        url: z.string().url().describe('Webhook URL endpoint to receive notifications'),
        events: z.array(z.string()).describe('Events to trigger this webhook (e.g., ["payment.created", "payment.paid", "payment.refunded"])'),
        secret: z.string().optional().describe('Secret key for webhook signature verification (optional)'),
        productsId: z.array(z.string()).optional().describe('Product IDs to filter notifications (optional - leave empty for all products)')
      }
    },
    async (args: any) => {
      const input = args;
      const start = Date.now();
      try {
        logger.info('TOOL', 'create_webhook: Starting', { name: input.name });
        const webhook = await apiClient.createWebhook(input);
        const duration = Date.now() - start;
        logger.info('TOOL', `create_webhook: Success (${duration}ms)`, { id: webhook.id });
        
        const output = { success: true, webhook };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `create_webhook: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Update webhook
  server.registerTool(
    'update_webhook',
    {
      description: 'Update an existing webhook. Only provide fields you want to update.',
      inputSchema: {
        webhookId: z.string().describe('Webhook ID'),
        name: z.string().optional().describe('New webhook name/description'),
        url: z.string().url().optional().describe('New webhook URL'),
        events: z.array(z.string()).optional().describe('New events list'),
        secret: z.string().optional().describe('New secret key'),
        productsId: z.array(z.string()).optional().describe('New product IDs filter')
      }
    },
    async (args: any) => {
      const { webhookId, ...input } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `update_webhook: Starting for ${webhookId}`);
        const webhook = await apiClient.updateWebhook(webhookId, input);
        const duration = Date.now() - start;
        logger.info('TOOL', `update_webhook: Success (${duration}ms)`);
        
        const output = { success: true, webhook };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `update_webhook: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Delete webhook
  server.registerTool(
    'delete_webhook',
    {
      description: 'Delete a webhook by ID',
      inputSchema: {
        webhookId: z.string().describe('Webhook ID')
      }
    },
    async (args: any) => {
      const { webhookId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `delete_webhook: Starting for ${webhookId}`);
        await apiClient.deleteWebhook(webhookId);
        const duration = Date.now() - start;
        logger.info('TOOL', `delete_webhook: Success (${duration}ms)`);
        
        const output = { success: true, message: `Webhook ${webhookId} deleted successfully` };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `delete_webhook: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
