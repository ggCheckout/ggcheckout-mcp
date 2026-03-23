import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CheckoutService } from '../../../core/services/checkout.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerCheckoutTools(server: McpServer, service: CheckoutService) {
  server.tool(
    'list_checkouts',
    'List all checkouts for the authenticated user',
    createToolHandler('list_checkouts', async () => {
      const checkouts = await service.list();
      return { checkouts };
    }),
  );

  server.registerTool(
    'get_checkout',
    {
      description: 'Get details of a specific checkout by ID',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
      },
    },
    createToolHandler('get_checkout', async ({ checkoutId }) => {
      const checkout = await service.getById(checkoutId);
      return { checkout };
    }),
  );

  server.registerTool(
    'create_checkout',
    {
      description: 'Create a new checkout page',
      inputSchema: {
        title: z.string().describe('Checkout page title'),
        id: z.string().describe('Unique checkout ID (slug)'),
        price: z.number().describe('Price in Brazilian Reais (e.g., 99.90)'),
        paymentMethods: z.object({}).passthrough().describe('Payment methods configuration'),
        checkout: z.object({}).passthrough().describe('Checkout page configuration'),
        url: z.string().optional().describe('Checkout URL (optional)'),
        bannerUrl: z.string().optional().describe('Banner image URL (optional)'),
        image: z.string().optional().describe('Product image URL (optional)'),
        sellerName: z.string().optional().describe('Seller name (optional)'),
        orderBumps: z.array(z.any()).optional().describe('Order bumps (upsells) - optional'),
        fields: z.array(z.any()).optional().describe('Custom form fields (optional)'),
        socialCard: z.any().optional().describe('Social card configuration (optional)'),
        published: z.boolean().optional().describe('Published status (default: true)'),
        metricToken: z.string().optional().describe('Metrics token (optional)'),
        emailProviderToken: z.string().optional().describe('Email provider token (optional)'),
      },
    },
    createToolHandler('create_checkout', async (args) => {
      const checkout = await service.create(args);
      return { success: true, checkout };
    }),
  );

  server.registerTool(
    'update_checkout',
    {
      description: 'Update an existing checkout page. Only provide fields you want to update.',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
        title: z.string().optional().describe('Checkout page title'),
        price: z.number().optional().describe('Price in Brazilian Reais'),
        paymentMethods: z
          .object({})
          .passthrough()
          .optional()
          .describe('Payment methods configuration'),
        checkout: z
          .object({})
          .passthrough()
          .optional()
          .describe('Checkout page configuration'),
        url: z.string().optional().describe('Checkout URL'),
        bannerUrl: z.string().optional().describe('Banner image URL'),
        image: z.string().optional().describe('Product image URL'),
        sellerName: z.string().optional().describe('Seller name'),
        orderBumps: z.array(z.any()).optional().describe('Order bumps (upsells)'),
        fields: z.array(z.any()).optional().describe('Custom form fields'),
        socialCard: z.any().optional().describe('Social card configuration'),
        published: z.boolean().optional().describe('Published status'),
        metricToken: z.string().optional().describe('Metrics token'),
        emailProviderToken: z.string().optional().describe('Email provider token'),
      },
    },
    createToolHandler('update_checkout', async ({ checkoutId, ...input }) => {
      const checkout = await service.update(checkoutId, input);
      return { success: true, checkout };
    }),
  );

  server.registerTool(
    'delete_checkout',
    {
      description: 'Delete a checkout page by ID',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
      },
    },
    createToolHandler('delete_checkout', async ({ checkoutId }) => {
      await service.delete(checkoutId);
      return { success: true, message: `Checkout ${checkoutId} deleted successfully` };
    }),
  );
}
