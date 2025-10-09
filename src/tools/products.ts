import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../api/client.js';
import { validateCreateInput, validateUpdateInput } from '../utils/validation.js';
import * as logger from '../utils/logger.js';

export function registerProductTools(server: McpServer, apiClient: ApiClient) {
  // List products (no parameters)
  server.tool(
    'list_products',
    'List all products/deliveries for the authenticated user',
    async () => {
      const start = Date.now();
      try {
        logger.info('TOOL', 'list_products: Starting');
        const products = await apiClient.listProducts();
        const duration = Date.now() - start;
        logger.info('TOOL', `list_products: Success (${duration}ms)`, { count: products.length });
        
        const output = { products };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `list_products: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'get_product',
    {
      description: 'Get details of a specific product by ID',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)')
      }
    },
    async (args: any) => {
      const { productId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `get_product: Starting for ${productId}`);
        const product = await apiClient.getProduct(productId);
        const duration = Date.now() - start;
        logger.info('TOOL', `get_product: Success (${duration}ms)`);
        
        const output = { product };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `get_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'create_product',
    {
      description: 'Create a new product/delivery. Price should be in cents (e.g., 1990 for R$19.90) or Brazilian format string (e.g., "19,90")',
      inputSchema: {
        title: z.string().describe('Product title'),
        url: z.string().describe('Product URL'),
        imageUrl: z.string().optional().describe('Product image URL (optional)'),
        description: z.string().describe('Product description'),
        discount: z.string().describe('Discount information (e.g., "30%")'),
        price: z.union([z.number(), z.string()]).describe('Price in cents (number) or Brazilian format (string)')
      }
    },
    async (args: any) => {
      const input = args;
      const start = Date.now();
      try {
        logger.info('TOOL', 'create_product: Starting', { title: input.title });
        const validated = validateCreateInput(input);
        const product = await apiClient.createProduct(validated);
        const duration = Date.now() - start;
        logger.info('TOOL', `create_product: Success (${duration}ms)`, { uid: product.uid });
        
        const output = { success: true, product };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `create_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'update_product',
    {
      description: 'Update an existing product/delivery. Only provide fields you want to update.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        title: z.string().optional().describe('Product title'),
        url: z.string().optional().describe('Product URL'),
        imageUrl: z.string().optional().describe('Product image URL'),
        description: z.string().optional().describe('Product description'),
        discount: z.string().optional().describe('Discount information'),
        price: z.union([z.number(), z.string()]).optional().describe('Price in cents (number) or Brazilian format (string)')
      }
    },
    async (args: any) => {
      const { productId, ...input } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `update_product: Starting for ${productId}`);
        const validated = validateUpdateInput(input);
        const product = await apiClient.updateProduct(productId, validated);
        const duration = Date.now() - start;
        logger.info('TOOL', `update_product: Success (${duration}ms)`);
        
        const output = { success: true, product };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `update_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'delete_product',
    {
      description: 'Delete a product/delivery by ID',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)')
      }
    },
    async (args: any) => {
      const { productId } = args;
      const start = Date.now();
      try {
        logger.info('TOOL', `delete_product: Starting for ${productId}`);
        await apiClient.deleteProduct(productId);
        const duration = Date.now() - start;
        logger.info('TOOL', `delete_product: Success (${duration}ms)`);
        
        const output = { success: true, message: `Product ${productId} deleted successfully` };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `delete_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
