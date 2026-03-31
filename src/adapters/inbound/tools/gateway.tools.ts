import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GatewayService } from '../../../core/services/gateway.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerGatewayTools(server: McpServer, service: GatewayService) {
  server.registerTool('list_tokens', {
    description: 'List payment gateway tokens',
    inputSchema: { type: z.string().optional().describe('Filter by token type (e.g., pushinpay, mercadopago, stripe)') },
  }, createToolHandler('list_tokens', async (args) => service.listTokens(args)));

  server.registerTool('insert_token', {
    description: 'Add or update a payment gateway token',
    inputSchema: {
      token: z.string().describe('Gateway token/credential'),
      type: z.string().describe('Gateway type (e.g., pushinpay, mercadopago, stripe, efibank)'),
      title: z.string().max(200).describe('Token display name'),
      target: z.string().describe('Target identifier'),
      status: z.string().describe('Token status'),
      tokenId: z.string().optional().describe('Token ID (for updates)'),
    },
  }, createToolHandler('insert_token', async (args) => {
    await service.insertToken(args);
    return { success: true, message: 'Token saved' };
  }));

  server.registerTool('delete_token', {
    description: 'Remove a payment gateway token',
    inputSchema: {
      tokenId: z.string().describe('Token ID'),
      target: z.string().describe('Target identifier'),
      token: z.string().describe('Token value'),
      type: z.string().describe('Gateway type'),
    },
  }, createToolHandler('delete_token', async ({ tokenId, target, token, type }) => {
    await service.deleteToken(tokenId, target, token, type);
    return { success: true, message: 'Token deleted' };
  }));

  server.tool(
    'get_gateway_fallback_stats',
    'Get PIX gateway fallback reliability statistics. Shows success/error counts and reliability percentage per gateway, based on the last 24 hours of transactions.',
    createToolHandler('get_gateway_fallback_stats', async () => service.getFallbackStats()),
  );
}
