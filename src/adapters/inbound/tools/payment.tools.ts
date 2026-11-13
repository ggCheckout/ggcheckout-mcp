import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PaymentService } from '../../../core/services/payment.service.js';
import { createToolHandler } from '../tool-handler.js';
import { appMeta, withDrawnNote } from '../apps/apps.js';
import { ATTRIBUTION_KEYS } from '../../../core/types/payment.js';

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
      description:
        'List the newest payments of a business, newest first. The answer is the first page of '
        + '`get_payments_paginated` with no filters: `total` counts every payment, and `nextCursor` '
        + '(null on the last page) continues the list through `get_payments_paginated`.',
      inputSchema: {
        businessId: z.string().describe('Business ID to list payments for'),
        pageSize: z.number().min(1).max(100).optional()
          .describe('Number of payments to return (default: 10, max 100)'),
      },
      _meta: appMeta(),
    },
    withDrawnNote(server, createToolHandler('list_payments', async ({ businessId, pageSize }) => {
      return service.getPaginated(businessId, { pageSize: pageSize ?? 10 });
    })),
  );

  server.registerTool(
    'get_payments_paginated',
    {
      description:
        'Get paginated payments for a business with optional filters. Page through it with `lastCreatedAt` '
        + '= the `nextCursor` of the previous answer; `nextCursor` is null on the last page. `total` is a '
        + 'count, not a collection size, and comes back 0 when counting is skipped; with `totalCapped: true` '
        + 'the count stopped at its cap and `total` is a floor, not the exact number. On a `searchTerm` query '
        + 'the answer may carry `coverageCapped: true`, meaning the scan hit its read cap and more matches '
        + 'may exist. Status filtering requires the matching index.',
      inputSchema: {
        businessId: z.string().describe('Business ID'),
        pageSize: z.number().min(1).max(100).optional()
          .describe('Number of items per page (default: 10, hard cap 100 — a larger value is silently reduced)'),
        dateFrom: z.string().optional().describe('Filter payments from this date (ISO format)'),
        dateTo: z.string().optional().describe('Filter payments until this date (ISO format)'),
        lastCreatedAt: z
          .string()
          .optional()
          .describe('Pagination cursor: the `nextCursor` returned by the previous page'),
        status: z
          .string()
          .optional()
          .describe('Filter by payment status (e.g., "pending", "paid", "error", "all")'),
        searchTerm: z
          .string()
          .max(200)
          .optional()
          .describe('Search by payment ID, email, phone, or title offer'),
        countOnly: z.boolean().optional().describe('Return only the total count, not the data'),
      },
      _meta: appMeta(),
    },
    withDrawnNote(server, createToolHandler('get_payments_paginated', async ({ businessId, ...options }) => {
      return service.getPaginated(businessId, options);
    })),
  );

  server.registerTool(
    'get_sales_attribution',
    {
      description:
        'Sales aggregated by UTM or click-source keys, to see which campaign or ad sells: per combination of keys, '
        + 'paidCount and paidGrossCents (paid sales) and refundedCount and refundedCents, plus `totals`. Aggregated only, '
        + 'no buyer data. A `null` key value is the sales that came without that parameter. `utm_content` usually carries the '
        + 'ad id. Period default: last 7 days, at most 90 days. `truncated: true` means the rows were cut: narrow the period or '
        + 'group by fewer keys. Cents, as everywhere.',
      inputSchema: {
        businessId: z.string().describe('Business ID (get_my_business_id)'),
        from: z.string().optional().describe('Start of the period: ISO 8601, or a plain date YYYY-MM-DD meaning that day in Sao Paulo, from 00:00 (default: 7 days before `to`)'),
        to: z.string().optional().describe('End of the period: ISO 8601, or a plain date YYYY-MM-DD meaning that day in Sao Paulo, inclusive through 23:59:59.999 (default: now). At most 90 days after `from`'),
        groupBy: z.array(z.enum(ATTRIBUTION_KEYS)).min(1).max(3)
          .refine((keys) => new Set(keys).size === keys.length, 'groupBy keys must be distinct').optional()
          .describe('1 to 3 distinct keys: utm_source, utm_medium, utm_campaign, utm_content, utm_term, src, sck '
            + '(default: utm_source, utm_campaign, utm_content)'),
      },
    },
    createToolHandler('get_sales_attribution', async ({ businessId, ...query }) => {
      return service.getSalesAttribution(businessId, query);
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
      _meta: appMeta(),
    },
    withDrawnNote(server, createToolHandler('get_payment', async ({ businessId, paymentId }) => {
      const payment = await service.getById(businessId, paymentId);
      return { payment };
    })),
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
        note: z.string().max(10000).optional().describe('Optional note about the status change'),
        tracking: z
          .object({
            code: z.string().max(200).describe('Tracking code'),
            url: z.string().url().optional().describe('Tracking URL'),
            carrier: z.string().max(200).describe('Carrier name'),
          })
          .optional()
          .describe('Tracking information'),
        separatedItems: z.array(z.string()).max(100).optional().describe('List of separated item IDs'),
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
