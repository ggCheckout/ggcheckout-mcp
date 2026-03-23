import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProductService } from '../../../core/services/product.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerProductTools(server: McpServer, service: ProductService) {
  server.tool(
    'list_products',
    'List all products/deliveries for the authenticated user',
    createToolHandler('list_products', async () => {
      const products = await service.list();
      return { products };
    }),
  );

  server.registerTool(
    'get_product',
    {
      description: 'Get details of a specific product by ID',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
      },
    },
    createToolHandler('get_product', async ({ productId }) => {
      const product = await service.getById(productId);
      return { product };
    }),
  );

  server.registerTool(
    'create_product',
    {
      description:
        'Create a new product/delivery. Price should be a number in Brazilian Reais (e.g., 19.90 for R$19.90) or Brazilian format string (e.g., "19,90")',
      inputSchema: {
        title: z.string().describe('Product title'),
        url: z.string().describe('Product URL'),
        imageUrl: z.string().optional().describe('Product image URL (optional)'),
        description: z.string().describe('Product description'),
        discount: z.string().describe('Discount information (e.g., "30%")'),
        price: z
          .union([z.number(), z.string()])
          .describe('Price in Brazilian Reais (number) or Brazilian format (string)'),
      },
    },
    createToolHandler('create_product', async (args) => {
      const product = await service.create(args);
      return { success: true, product };
    }),
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
        price: z
          .union([z.number(), z.string()])
          .optional()
          .describe('Price in Brazilian Reais (number) or Brazilian format (string)'),
      },
    },
    createToolHandler('update_product', async ({ productId, ...input }) => {
      const product = await service.update(productId, input);
      return { success: true, product };
    }),
  );

  server.registerTool(
    'delete_product',
    {
      description: 'Delete a product/delivery by ID',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
      },
    },
    createToolHandler('delete_product', async ({ productId }) => {
      await service.delete(productId);
      return { success: true, message: `Product ${productId} deleted successfully` };
    }),
  );
}
