import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DiscountService } from '../../../core/services/discount.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerDiscountTools(server: McpServer, service: DiscountService) {
  server.registerTool('list_discounts', {
    description: 'List all discounts/coupons for the authenticated seller',
    inputSchema: {
      isActive: z.boolean().optional().describe('Filter by active status'),
      type: z.enum(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']).optional().describe('Filter by discount type'),
    },
  }, createToolHandler('list_discounts', async (args) => {
    const discounts = await service.list(args);
    return { discounts };
  }));

  server.registerTool('get_discount', {
    description: 'Get details of a specific discount by ID',
    inputSchema: { id: z.string().describe('Discount ID') },
  }, createToolHandler('get_discount', async ({ id }) => {
    const discount = await service.getById(id);
    return { discount };
  }));

  server.registerTool('create_discount', {
    description: 'Create a new discount/coupon. For percentage type, value must be 0-100. Coupon code is auto-uppercased.',
    inputSchema: {
      name: z.string().max(200).describe('Discount name'),
      description: z.string().max(5000).optional().describe('Description'),
      couponCode: z.string().max(50).optional().describe('Coupon code (auto-uppercased). Omit for automatic discounts.'),
      type: z.enum(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']).describe('Discount type'),
      value: z.number().min(0).describe('Discount value (percentage 0-100 or fixed amount in cents)'),
      buyQuantity: z.number().min(0).max(100000).optional().describe('Buy X quantity (for buy_x_get_y)'),
      getQuantity: z.number().min(0).max(100000).optional().describe('Get Y quantity (for buy_x_get_y)'),
      hasExpiration: z.boolean().optional().describe('Whether discount expires'),
      startDate: z.string().optional().describe('Start date (ISO format)'),
      endDate: z.string().optional().describe('End date (ISO format)'),
      usageLimit: z.number().min(0).max(100000).optional().describe('Total usage limit'),
      limitPerCustomer: z.number().min(0).max(100000).optional().describe('Usage limit per customer'),
      minimumAmount: z.number().min(0).optional().describe('Minimum order value in cents'),
      maximumAmount: z.number().min(0).optional().describe('Maximum order value in cents'),
      minimumItems: z.number().min(0).max(100000).optional().describe('Minimum item quantity'),
      applicableProducts: z.array(z.string()).max(100).optional().describe('Eligible product IDs (empty = all)'),
      excludedProducts: z.array(z.string()).max(100).optional().describe('Excluded product IDs'),
      newCustomersOnly: z.boolean().optional().describe('Only for new customers'),
      allowedPaymentMethods: z.array(z.enum(['pix', 'credit_card', 'bank_slip'])).max(100).optional().describe('Allowed payment methods'),
      isAutomatic: z.boolean().optional().describe('Auto-apply without code'),
      priority: z.number().min(0).max(1000).optional().describe('Priority (1 = highest)'),
      isStackable: z.boolean().optional().describe('Can combine with other discounts'),
    },
  }, createToolHandler('create_discount', async (args) => {
    const result = await service.create(args);
    return { success: true, discountId: result.id };
  }));

  server.registerTool('update_discount', {
    description: 'Update an existing discount. Only provide fields you want to change.',
    inputSchema: {
      id: z.string().describe('Discount ID'),
      name: z.string().max(200).optional().describe('Discount name'),
      description: z.string().max(5000).optional().describe('Description'),
      couponCode: z.string().max(50).optional().describe('Coupon code'),
      type: z.enum(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']).optional().describe('Discount type'),
      value: z.number().min(0).optional().describe('Discount value'),
      isActive: z.boolean().optional().describe('Active/inactive'),
      hasExpiration: z.boolean().optional().describe('Whether discount expires'),
      startDate: z.string().optional().describe('Start date'),
      endDate: z.string().optional().describe('End date'),
      usageLimit: z.number().min(0).max(100000).optional().describe('Usage limit'),
      applicableProducts: z.array(z.string()).max(100).optional().describe('Eligible product IDs'),
      excludedProducts: z.array(z.string()).max(100).optional().describe('Excluded product IDs'),
    },
  }, createToolHandler('update_discount', async ({ id, ...input }) => {
    await service.update(id, input);
    return { success: true, message: `Discount ${id} updated` };
  }));

  server.registerTool('delete_discount', {
    description: 'Delete a discount (soft delete)',
    inputSchema: { id: z.string().describe('Discount ID') },
  }, createToolHandler('delete_discount', async ({ id }) => {
    await service.delete(id);
    return { success: true, message: `Discount ${id} deleted` };
  }));

  server.registerTool('validate_discount_code', {
    description: 'Validate a coupon code against an order. Returns discount value and final price.',
    inputSchema: {
      checkoutId: z.string().describe('Checkout ID (uid) — the id of the checkout itself, not the productId it sells'),
      orderValue: z.number().min(0).describe('Order value in cents'),
      items: z.array(z.object({
        productId: z.string().describe('Product ID'),
        quantity: z.number().min(0).max(100000).describe('Quantity'),
        price: z.number().min(0).describe('Unit price in cents'),
      })).max(100).describe('Order items'),
      couponCode: z.string().max(50).optional().describe('Single coupon code'),
      couponCodes: z.array(z.string()).max(100).optional().describe('Multiple coupon codes'),
      customerEmail: z.string().optional().describe('Customer email'),
      paymentMethod: z.enum(['pix', 'credit_card', 'bank_slip']).optional().describe('Payment method'),
    },
  }, createToolHandler('validate_discount_code', async (args) => {
    return service.validate(args);
  }));
}
