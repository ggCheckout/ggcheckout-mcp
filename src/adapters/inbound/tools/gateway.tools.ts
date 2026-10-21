import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GatewayService } from '../../../core/services/gateway.service.js';
import { createToolHandler } from '../tool-handler.js';

/**
 * The only types the creation route takes. It checks `target` against the same list, because
 * `target` is what becomes the stored type, so both fields share it.
 */
const TOKEN_TYPES = ['pushinpay', 'utmify', 'emailprovider', 'mercadopago'] as const;

export function registerGatewayTools(server: McpServer, service: GatewayService) {
  server.registerTool('list_tokens', {
    description: 'List payment gateway tokens',
    inputSchema: { type: z.string().optional().describe('Filter by token type (e.g., pushinpay, mercadopago, stripe)') },
  }, createToolHandler('list_tokens', async (args) => service.listTokens(args)));

  server.registerTool('insert_token', {
    description:
      'Add or update a payment gateway token. Only four types can be created through the API — the '
      + 'route refuses anything else with 400 "Tipo de token inválido.", even for gateways the platform '
      + 'supports elsewhere (stripe and efibank among them, which this tool used to advertise).',
    inputSchema: {
      token: z.string().describe('Gateway token/credential'),
      type: z.enum(TOKEN_TYPES).describe('Gateway type — the only four the creation route accepts'),
      title: z.string().max(200).describe('Token display name'),
      target: z.enum(TOKEN_TYPES)
        .describe('Target type, from the same four: it is what gets stored as the token type'),
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
    'list_checkout_wallets',
    'List the seller\'s wallets (payment routes). A wallet holds the gateways that charge PIX (in '
    + 'fallback order) and card. Checkouts and stores charge PIX and card only through a wallet: '
    + 'pass its `id` as `routeId` in create_checkout / update_checkout `paymentMethods`. Wallets are '
    + 'created and edited in the dashboard (Settings → Gateways → Wallets).',
    createToolHandler('list_checkout_wallets', async () => ({ wallets: await service.listWallets() })),
  );

  server.tool(
    'get_gateway_fallback_stats',
    'Get PIX gateway fallback reliability statistics. Shows success/error counts and reliability percentage per gateway, based on the last 24 hours of transactions.',
    createToolHandler('get_gateway_fallback_stats', async () => service.getFallbackStats()),
  );
}
