import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CheckoutService } from '../../../core/services/checkout.service.js';
import { createToolHandler } from '../tool-handler.js';

const paymentMethodConfigSchema = z.object({
  token: z.string(),
  type: z.string(),
}).nullable().optional();

const pixGatewayEntrySchema = z.object({
  tokenId: z.string().describe('Gateway token ID'),
  type: z.string().describe('Gateway type (e.g., amplopay, efibank, mercadopago)'),
});

const pixFallbackSchema = z.union([
  z.object({
    token: z.string(),
    type: z.string(),
  }),
  z.object({
    gateways: z.array(pixGatewayEntrySchema).min(1).max(5)
      .describe('Ordered list of PIX gateways for fallback chain (max 5). First gateway has highest priority.'),
  }),
]).nullable().optional()
  .describe('PIX config: legacy single gateway {token, type} or fallback chain {gateways: [{tokenId, type}]}');

const paymentMethodsSchema = z.object({
  credit_card: paymentMethodConfigSchema,
  pix: pixFallbackSchema,
  bank_slip: paymentMethodConfigSchema,
  installments: z.number().min(1).max(24).optional(),
  showInstallmentsOnPrice: z.boolean().optional(),
  primaryPaymentMethod: z.enum(['pix', 'credit_card']).optional(),
});

const socialCardSchema = z.array(z.object({
  text: z.string().min(1).max(1000),
  socialName: z.string().min(1).max(200),
  rating: z.number().min(1).max(5).optional(),
  photoUrl: z.string().optional(),
  isVerified: z.boolean().optional(),
  images: z.array(z.object({
    id: z.string(),
    url: z.string(),
  })).max(5).optional(),
})).max(50);

const fieldsSchema = z.object({
  havePhone: z.boolean().optional(),
  haveName: z.boolean().optional(),
  haveCpf: z.boolean().optional(),
});

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
        title: z.string().max(200).describe('Checkout page title'),
        id: z.string().max(100).describe('Unique checkout ID (slug)'),
        price: z.number().min(0).describe('Price in Brazilian Reais (e.g., 99.90)'),
        paymentMethods: paymentMethodsSchema.describe('Payment methods configuration (credit_card, pix, bank_slip)'),
        checkout: z.record(z.string(), z.unknown()).describe('Checkout page styling/configuration'),
        url: z.string().url().optional().describe('Checkout URL (optional)'),
        bannerUrl: z.string().url().optional().describe('Banner image URL (optional)'),
        image: z.string().url().optional().describe('Product image URL (optional)'),
        sellerName: z.string().max(200).optional().describe('Seller name (optional)'),
        orderBumps: z.array(z.string()).max(20).optional().describe('Order bump product IDs (optional)'),
        fields: fieldsSchema.optional().describe('Custom form fields config (havePhone, haveName, haveCpf)'),
        socialCard: socialCardSchema.optional().describe('Social proof cards (optional)'),
        published: z.boolean().optional().describe('Published status (default: true)'),
        metricToken: z.string().max(500).optional().describe('Metrics token (optional)'),
        emailProviderToken: z.string().max(500).optional().describe('Email provider token (optional)'),
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
        title: z.string().max(200).optional().describe('Checkout page title'),
        price: z.number().min(0).optional().describe('Price in Brazilian Reais'),
        paymentMethods: paymentMethodsSchema.optional().describe('Payment methods configuration'),
        checkout: z.record(z.string(), z.unknown()).optional().describe('Checkout page styling/configuration'),
        url: z.string().url().optional().describe('Checkout URL'),
        bannerUrl: z.string().url().optional().describe('Banner image URL'),
        image: z.string().url().optional().describe('Product image URL'),
        sellerName: z.string().max(200).optional().describe('Seller name'),
        orderBumps: z.array(z.string()).max(20).optional().describe('Order bump product IDs'),
        fields: fieldsSchema.optional().describe('Custom form fields config'),
        socialCard: socialCardSchema.optional().describe('Social proof cards'),
        published: z.boolean().optional().describe('Published status'),
        metricToken: z.string().max(500).optional().describe('Metrics token'),
        emailProviderToken: z.string().max(500).optional().describe('Email provider token'),
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

  server.registerTool(
    'manage_checkout_tags',
    {
      description: 'Set tags for a checkout (replaces existing tags, max 5). Each tag has a name and hex color.',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
        tags: z
          .array(
            z.object({
              name: z.string().max(50).describe('Tag name'),
              color: z.string().max(20).describe('Tag color in hex format (e.g., "#8b5cf6")'),
            }),
          )
          .max(5)
          .describe('List of tags to set on the checkout (max 5)'),
      },
    },
    createToolHandler('manage_checkout_tags', async ({ checkoutId, tags }) => {
      const result = await service.manageTags(checkoutId, tags);
      return { success: true, tags: result.tags };
    }),
  );
}
