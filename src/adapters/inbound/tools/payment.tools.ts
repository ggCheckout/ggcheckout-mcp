import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PaymentService } from '../../../core/services/payment.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerPaymentTools(server: McpServer, service: PaymentService) {
  server.tool(
    'get_my_business_id',
    'Get the business ID of the authenticated user (from API key)',
    createToolHandler('get_my_business_id', async () => {
      const businessId = await service.getMyBusinessId();
      return { businessId };
    }),
  );

  server.registerTool(
    'list_payments',
    {
      description: 'List all payments for a specific business',
      inputSchema: {
        businessId: z.string().describe('Business ID to list payments for'),
      },
    },
    createToolHandler('list_payments', async ({ businessId }) => {
      const payments = await service.list(businessId);
      return { payments };
    }),
  );

  server.registerTool(
    'get_payments_paginated',
    {
      description:
        'Get paginated payments for a business with optional filters. Requires Firestore indexes for status filtering.',
      inputSchema: {
        businessId: z.string().describe('Business ID'),
        pageSize: z.number().optional().describe('Number of items per page (default: 10)'),
        dateFrom: z.string().optional().describe('Filter payments from this date (ISO format)'),
        dateTo: z.string().optional().describe('Filter payments until this date (ISO format)'),
        lastCreatedAt: z
          .string()
          .optional()
          .describe('Last createdAt value for pagination cursor'),
        status: z
          .string()
          .optional()
          .describe('Filter by payment status (e.g., "pending", "paid", "error", "all")'),
        searchTerm: z
          .string()
          .optional()
          .describe('Search by payment ID, email, phone, or title offer'),
        countOnly: z.boolean().optional().describe('Return only the total count, not the data'),
      },
    },
    createToolHandler('get_payments_paginated', async ({ businessId, ...options }) => {
      return service.getPaginated(businessId, options);
    }),
  );

  server.registerTool(
    'get_payment',
    {
      description: 'Get details of a specific payment by ID',
      inputSchema: {
        businessId: z.string().describe('Business ID'),
        paymentId: z.string().describe('Payment ID (transaction ID)'),
      },
    },
    createToolHandler('get_payment', async ({ businessId, paymentId }) => {
      const payment = await service.getById(businessId, paymentId);
      return { payment };
    }),
  );

  server.registerTool(
    'get_payment_fulfillment',
    {
      description: 'Get fulfillment status for a physical order payment (tracking, status, package info)',
      inputSchema: {
        businessId: z.string().describe('Business ID'),
        paymentId: z.string().describe('Payment ID'),
      },
    },
    createToolHandler('get_payment_fulfillment', async ({ businessId, paymentId }) => {
      const result = await service.getFulfillment(businessId, paymentId);
      return result;
    }),
  );

  server.registerTool(
    'update_payment_fulfillment',
    {
      description: 'Update fulfillment status for a physical order (e.g., mark as shipped, add tracking)',
      inputSchema: {
        businessId: z.string().describe('Business ID'),
        paymentId: z.string().describe('Payment ID'),
        status: z
          .enum([
            'pending', 'separating', 'ready', 'shipped', 'in_transit',
            'out_for_delivery', 'delivered', 'failed_attempt', 'returned', 'cancelled',
          ])
          .describe('Fulfillment status'),
        note: z.string().optional().describe('Optional note about the status change'),
        tracking: z
          .object({
            code: z.string().describe('Tracking code'),
            url: z.string().optional().describe('Tracking URL'),
            carrier: z.string().describe('Carrier name'),
          })
          .optional()
          .describe('Tracking information'),
        separatedItems: z.array(z.string()).optional().describe('List of separated item IDs'),
      },
    },
    createToolHandler('update_payment_fulfillment', async ({ businessId, paymentId, ...data }) => {
      const result = await service.updateFulfillment(businessId, paymentId, data);
      return result;
    }),
  );

  server.registerTool(
    'check_payment_status',
    {
      description: 'Check the current payment status directly from the payment gateway',
      inputSchema: {
        paymentId: z.string().describe('Payment ID'),
      },
    },
    createToolHandler('check_payment_status', async ({ paymentId }) => {
      const result = await service.checkStatus(paymentId);
      return result;
    }),
  );
}
