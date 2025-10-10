import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../api/client.js';
import * as logger from '../utils/logger.js';

export function registerCheckoutTools(server: McpServer, apiClient: ApiClient) {
  // List all checkouts for a user
  server.tool(
    'list_checkouts',
    'List all checkouts for the authenticated user',
    async () => {
      const start = Date.now();
      try {
        logger.info('TOOL', 'list_checkouts: Starting');
        // Get user's businessId first
        const businessId = await apiClient.getMyBusinessId();
        const checkouts = await apiClient.listCheckouts(businessId);
        const duration = Date.now() - start;
        logger.info('TOOL', `list_checkouts: Success (${duration}ms)`, { count: checkouts.length });
        
        const output = { checkouts };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `list_checkouts: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Get specific checkout
  server.registerTool(
    'get_checkout',
    {
      description: 'Get details of a specific checkout by ID',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)')
      }
    },
    async (args: any) => {
      const { checkoutId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `get_checkout: Starting for ${checkoutId}`);
        const checkout = await apiClient.getCheckout(checkoutId);
        const duration = Date.now() - start;
        logger.info('TOOL', `get_checkout: Success (${duration}ms)`);
        
        const output = { checkout };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `get_checkout: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Create checkout
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
        emailProviderToken: z.string().optional().describe('Email provider token (optional)')
      }
    },
    async (args: any) => {
      const input = args;
      const start = Date.now();
      try {
        logger.info('TOOL', 'create_checkout: Starting', { title: input.title });
        // Get user's businessId and add to payload
        const businessId = await apiClient.getMyBusinessId();
        const payload = {
          ...input,
          uuidOwnwer: businessId
        };
        const checkout = await apiClient.createCheckout(payload);
        const duration = Date.now() - start;
        logger.info('TOOL', `create_checkout: Success (${duration}ms)`, { uid: checkout.uid });
        
        const output = { success: true, checkout };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `create_checkout: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Update checkout
  server.registerTool(
    'update_checkout',
    {
      description: 'Update an existing checkout page. Only provide fields you want to update.',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
        title: z.string().optional().describe('Checkout page title'),
        price: z.number().optional().describe('Price in Brazilian Reais'),
        paymentMethods: z.object({}).passthrough().optional().describe('Payment methods configuration'),
        checkout: z.object({}).passthrough().optional().describe('Checkout page configuration'),
        url: z.string().optional().describe('Checkout URL'),
        bannerUrl: z.string().optional().describe('Banner image URL'),
        image: z.string().optional().describe('Product image URL'),
        sellerName: z.string().optional().describe('Seller name'),
        orderBumps: z.array(z.any()).optional().describe('Order bumps (upsells)'),
        fields: z.array(z.any()).optional().describe('Custom form fields'),
        socialCard: z.any().optional().describe('Social card configuration'),
        published: z.boolean().optional().describe('Published status'),
        metricToken: z.string().optional().describe('Metrics token'),
        emailProviderToken: z.string().optional().describe('Email provider token')
      }
    },
    async (args: any) => {
      const { checkoutId, ...input } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `update_checkout: Starting for ${checkoutId}`);
        const checkout = await apiClient.updateCheckout(checkoutId, input);
        const duration = Date.now() - start;
        logger.info('TOOL', `update_checkout: Success (${duration}ms)`);
        
        const output = { success: true, checkout };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `update_checkout: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Delete checkout
  server.registerTool(
    'delete_checkout',
    {
      description: 'Delete a checkout page by ID',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)')
      }
    },
    async (args: any) => {
      const { checkoutId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `delete_checkout: Starting for ${checkoutId}`);
        await apiClient.deleteCheckout(checkoutId);
        const duration = Date.now() - start;
        logger.info('TOOL', `delete_checkout: Success (${duration}ms)`);
        
        const output = { success: true, message: `Checkout ${checkoutId} deleted successfully` };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `delete_checkout: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
