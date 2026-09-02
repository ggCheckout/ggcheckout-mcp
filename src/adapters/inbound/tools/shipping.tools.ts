import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShippingService } from '../../../core/services/shipping.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerShippingTools(server: McpServer, service: ShippingService) {
  server.registerTool('calculate_shipping', {
    description: 'Calculate shipping options for a destination postal code using MelhorEnvio',
    inputSchema: {
      toPostalCode: z.string().describe('Destination postal code (CEP)'),
      checkoutId: z.string().optional().describe('Checkout ID (uid) — the id of the checkout itself, not the productId it sells; uses checkout product dimensions'),
      tokenId: z.string().optional().describe('MelhorEnvio token ID'),
      businessId: z.string().optional().describe('Business ID'),
      products: z.array(z.object({
        weight: z.number().min(0), width: z.number().min(0), height: z.number().min(0), length: z.number().min(0), quantity: z.number().min(0).max(100000).optional(),
      })).max(100).optional().describe('Product dimensions array'),
    },
  }, createToolHandler('calculate_shipping', async (args) => service.calculate(args)));

  server.registerTool('verify_shipping', {
    description: 'Verify shipping status and tracking for a payment',
    inputSchema: {
      paymentId: z.string().describe('Payment ID'),
      businessId: z.string().describe('Business ID'),
    },
  }, createToolHandler('verify_shipping', async ({ paymentId, businessId }) => service.verifyShipping(paymentId, businessId)));

  server.registerTool('create_shipping_cart', {
    description: 'Add a shipping label to the MelhorEnvio cart',
    inputSchema: {
      paymentId: z.string().describe('Payment ID'),
      businessId: z.string().describe('Business ID'),
      serviceId: z.number().describe('MelhorEnvio service ID'),
      productName: z.string().max(200).describe('Product name'),
      productValue: z.number().min(0).describe('Product value in cents'),
      packageDimensions: z.object({
        weight: z.number().min(0), width: z.number().min(0), height: z.number().min(0), length: z.number().min(0),
      }).describe('Package dimensions'),
    },
  }, createToolHandler('create_shipping_cart', async (args) => service.createCart(args)));

  server.registerTool('cancel_shipping_cart', {
    description: 'Cancel a shipping cart/label',
    inputSchema: {
      paymentId: z.string().describe('Payment ID'),
      businessId: z.string().describe('Business ID'),
      cartId: z.string().describe('Cart/label ID'),
    },
  }, createToolHandler('cancel_shipping_cart', async ({ paymentId, businessId, cartId }) => {
    await service.cancelCart(paymentId, businessId, cartId);
    return { success: true, message: 'Shipping cart cancelled' };
  }));

  server.registerTool('checkout_shipping', {
    description: 'Pay for a shipping label in the MelhorEnvio cart',
    inputSchema: {
      paymentId: z.string().describe('Payment ID'),
      businessId: z.string().describe('Business ID'),
      cartId: z.string().describe('Cart/label ID'),
    },
  }, createToolHandler('checkout_shipping', async ({ paymentId, businessId, cartId }) => service.checkout(paymentId, businessId, cartId)));

  server.registerTool('generate_shipping_label', {
    description: 'Generate a shipping label after payment',
    inputSchema: {
      paymentId: z.string().describe('Payment ID'),
      businessId: z.string().describe('Business ID'),
      orderId: z.string().describe('MelhorEnvio order ID'),
    },
  }, createToolHandler('generate_shipping_label', async ({ paymentId, businessId, orderId }) => service.generateLabel(paymentId, businessId, orderId)));

  server.registerTool('print_shipping_label', {
    description: 'Get print URL for a shipping label',
    inputSchema: {
      businessId: z.string().describe('Business ID'),
      orderId: z.string().describe('MelhorEnvio order ID'),
    },
  }, createToolHandler('print_shipping_label', async ({ businessId, orderId }) => service.printLabel(businessId, orderId)));
}
