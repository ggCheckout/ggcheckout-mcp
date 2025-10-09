import { z } from 'zod';
import { ApiClient } from '../api/client.js';
import { validateCreateInput, validateUpdateInput } from '../utils/validation.js';
import * as logger from '../utils/logger.js';

export function registerProductTools(server: any, apiClient: ApiClient) {
  server.registerTool(
    'list_products',
    {
      title: 'List Products',
      description: 'List all products/deliveries for the authenticated user',
      inputSchema: {},
      outputSchema: {
        products: z.array(z.object({
          uid: z.string().optional(),
          title: z.string(),
          url: z.string(),
          imageUrl: z.string().optional(),
          description: z.string(),
          discount: z.string(),
          price: z.number(),
        }))
      }
    },
    async () => {
      const start = Date.now();
      try {
        logger.info('TOOL', 'list_products: Starting');
        const products = await apiClient.listProducts();
        const duration = Date.now() - start;
        logger.info('TOOL', `list_products: Success (${duration}ms)`, { count: products.length });
        
        const output = { products };
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `list_products: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'get_product',
    {
      title: 'Get Product',
      description: 'Get details of a specific product by ID',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)')
      },
      outputSchema: {
        product: z.object({
          uid: z.string().optional(),
          title: z.string(),
          url: z.string(),
          imageUrl: z.string().optional(),
          description: z.string(),
          discount: z.string(),
          price: z.number(),
        })
      }
    },
    async ({ productId }) => {
      const start = Date.now();
      try {
        logger.info('TOOL', `get_product: Starting for ${productId}`);
        const product = await apiClient.getProduct(productId);
        const duration = Date.now() - start;
        logger.info('TOOL', `get_product: Success (${duration}ms)`);
        
        const output = { product };
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `get_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'create_product',
    {
      title: 'Create Product',
      description: 'Create a new product/delivery. Price should be in cents (e.g., 1990 for R$19.90) or Brazilian format string (e.g., "19,90")',
      inputSchema: {
        title: z.string().describe('Product title'),
        url: z.string().describe('Product URL'),
        imageUrl: z.string().optional().describe('Product image URL (optional)'),
        description: z.string().describe('Product description'),
        discount: z.string().describe('Discount information (e.g., "30%")'),
        price: z.union([z.number(), z.string()]).describe('Price in cents (number) or Brazilian format (string)')
      },
      outputSchema: {
        success: z.boolean(),
        product: z.object({
          uid: z.string().optional(),
          title: z.string(),
          url: z.string(),
          imageUrl: z.string().optional(),
          description: z.string(),
          discount: z.string(),
          price: z.number(),
        })
      }
    },
    async (input) => {
      const start = Date.now();
      try {
        logger.info('TOOL', 'create_product: Starting', { title: input.title });
        const validated = validateCreateInput(input);
        const product = await apiClient.createProduct(validated);
        const duration = Date.now() - start;
        logger.info('TOOL', `create_product: Success (${duration}ms)`, { uid: product.uid });
        
        const output = { success: true, product };
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `create_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'update_product',
    {
      title: 'Update Product',
      description: 'Update an existing product/delivery. Only provide fields you want to update.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        title: z.string().optional().describe('Product title'),
        url: z.string().optional().describe('Product URL'),
        imageUrl: z.string().optional().describe('Product image URL'),
        description: z.string().optional().describe('Product description'),
        discount: z.string().optional().describe('Discount information'),
        price: z.union([z.number(), z.string()]).optional().describe('Price in cents (number) or Brazilian format (string)')
      },
      outputSchema: {
        success: z.boolean(),
        product: z.object({
          uid: z.string().optional(),
          title: z.string().optional(),
          url: z.string().optional(),
          imageUrl: z.string().optional(),
          description: z.string().optional(),
          discount: z.string().optional(),
          price: z.number().optional(),
        })
      }
    },
    async ({ productId, ...input }) => {
      const start = Date.now();
      try {
        logger.info('TOOL', `update_product: Starting for ${productId}`);
        const validated = validateUpdateInput(input);
        const product = await apiClient.updateProduct(productId, validated);
        const duration = Date.now() - start;
        logger.info('TOOL', `update_product: Success (${duration}ms)`);
        
        const output = { success: true, product };
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `update_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'delete_product',
    {
      title: 'Delete Product',
      description: 'Delete a product/delivery by ID',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)')
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string()
      }
    },
    async ({ productId }) => {
      const start = Date.now();
      try {
        logger.info('TOOL', `delete_product: Starting for ${productId}`);
        await apiClient.deleteProduct(productId);
        const duration = Date.now() - start;
        logger.info('TOOL', `delete_product: Success (${duration}ms)`);
        
        const output = { success: true, message: `Product ${productId} deleted successfully` };
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error('TOOL', `delete_product: Failed (${duration}ms)`, error.message);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
