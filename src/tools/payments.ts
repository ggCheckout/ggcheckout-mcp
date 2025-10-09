import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../api/client.js';
import * as logger from '../utils/logger.js';

export function registerPaymentTools(server: McpServer, apiClient: ApiClient) {
  // Get authenticated user's business ID
  server.tool(
    'get_my_business_id',
    'Get the business ID of the authenticated user (from API key)',
    async () => {
      const start = Date.now();
      try {
        logger.info('TOOL', 'get_my_business_id: Starting');
        const businessId = await apiClient.getMyBusinessId();
        const duration = Date.now() - start;
        logger.info('TOOL', `get_my_business_id: Success (${duration}ms)`, { businessId });
        
        const output = { businessId };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `get_my_business_id: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // List all payments for a business
  server.registerTool(
    'list_payments',
    {
      description: 'List all payments for a specific business',
      inputSchema: {
        businessId: z.string().describe('Business ID to list payments for')
      }
    },
    async (args: any) => {
      const { businessId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `list_payments: Starting for business ${businessId}`);
        const payments = await apiClient.listPayments(businessId);
        const duration = Date.now() - start;
        logger.info('TOOL', `list_payments: Success (${duration}ms)`, { count: payments.length });
        
        const output = { payments };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `list_payments: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Get paginated payments with filters
  server.registerTool(
    'get_payments_paginated',
    {
      description: 'Get paginated payments for a business with optional filters. Note: Status filtering is done client-side after fetching data.',
      inputSchema: {
        businessId: z.string().describe('Business ID'),
        pageSize: z.number().optional().describe('Number of items per page (default: 10)'),
        dateFrom: z.string().optional().describe('Filter payments from this date (ISO format)'),
        dateTo: z.string().optional().describe('Filter payments until this date (ISO format)'),
        lastCreatedAt: z.string().optional().describe('Last createdAt value for pagination cursor'),
        status: z.string().optional().describe('Filter by payment status (e.g., "pending", "paid", "error"). This is filtered client-side.'),
        searchTerm: z.string().optional().describe('Search by payment ID, email, phone, or title offer'),
        countOnly: z.boolean().optional().describe('Return only the total count, not the data')
      }
    },
    async (args: any) => {
      const { businessId, status: statusFilter, ...options } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `get_payments_paginated: Starting for business ${businessId}`, { options, statusFilter });
        
       
        const result = await apiClient.getPaymentsPaginated(businessId, options);
        
        // Client-side filtering by status if requested
        let output: any;
        if ('payments' in result && statusFilter && statusFilter !== 'all') {
          const filteredPayments = result.payments.filter(
            (payment) => payment.status === statusFilter
          );
          output = {
            payments: filteredPayments,
            total: filteredPayments.length,
            lastCreatedAt: result.lastCreatedAt,
            note: 'Status filtering applied client-side'
          };
        } else {
          output = result;
        }
        
        const duration = Date.now() - start;
        logger.info('TOOL', `get_payments_paginated: Success (${duration}ms)`);
        
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `get_payments_paginated: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Get specific payment by ID
  server.registerTool(
    'get_payment',
    {
      description: 'Get details of a specific payment by ID',
      inputSchema: {
        businessId: z.string().describe('Business ID'),
        paymentId: z.string().describe('Payment ID (transaction ID)')
      }
    },
    async (args: any) => {
      const { businessId, paymentId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `get_payment: Starting for ${paymentId} in business ${businessId}`);
        const payment = await apiClient.getPayment(businessId, paymentId);
        const duration = Date.now() - start;
        logger.info('TOOL', `get_payment: Success (${duration}ms)`);
        
        const output = { payment };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `get_payment: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
