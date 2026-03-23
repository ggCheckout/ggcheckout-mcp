import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StoreService } from '../../../core/services/store.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerStoreTools(server: McpServer, service: StoreService) {
  server.registerTool(
    'get_store_config',
    {
      description: 'Get store configuration (theme, settings, payment methods)',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
      },
    },
    createToolHandler('get_store_config', async ({ storeId }) => {
      const config = await service.getConfig(storeId);
      return { config };
    }),
  );

  server.registerTool(
    'get_store_public',
    {
      description: 'Get full public store data including categories and products',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
      },
    },
    createToolHandler('get_store_public', async ({ storeId }) => {
      return service.getPublic(storeId);
    }),
  );

  server.registerTool(
    'list_store_products',
    {
      description: 'List products in the store catalog with pagination, search, and sorting',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
        categoryId: z.string().optional().describe('Filter by category ID'),
        search: z.string().optional().describe('Search by product title'),
        page: z.number().optional().describe('Page number (default: 1)'),
        limit: z.number().optional().describe('Items per page (default: 20, max: 100)'),
        sortBy: z.enum(['title', 'price', 'createdAt']).optional().describe('Sort field (default: createdAt)'),
        sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (default: desc)'),
      },
    },
    createToolHandler('list_store_products', async ({ storeId, ...options }) => {
      return service.listProducts(storeId, options);
    }),
  );

  server.registerTool(
    'get_store_product',
    {
      description: 'Get detailed product information including variants and stock',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
        productId: z.string().describe('Product ID'),
      },
    },
    createToolHandler('get_store_product', async ({ storeId, productId }) => {
      const product = await service.getProduct(storeId, productId);
      return { product };
    }),
  );

  server.registerTool(
    'list_categories',
    {
      description: 'List all categories in the store',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
      },
    },
    createToolHandler('list_categories', async ({ storeId }) => {
      return service.listCategories(storeId);
    }),
  );

  server.registerTool(
    'list_custom_fields',
    {
      description: 'List custom fields configured for the store, optionally filtered by product',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
        productId: z.string().optional().describe('Filter fields applicable to this product'),
      },
    },
    createToolHandler('list_custom_fields', async ({ storeId, productId }) => {
      return service.listCustomFields(storeId, productId);
    }),
  );

  server.registerTool(
    'get_store_order',
    {
      description: 'Get details of a specific store order (items, customer, pricing, payment status)',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
        orderId: z.string().describe('Order ID'),
      },
    },
    createToolHandler('get_store_order', async ({ storeId, orderId }) => {
      const order = await service.getOrder(storeId, orderId);
      return { order };
    }),
  );

  server.registerTool(
    'list_feedbacks',
    {
      description: 'List store product feedbacks/reviews with pagination and optional stats',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
        productId: z.string().optional().describe('Filter by product ID'),
        rating: z.number().min(1).max(5).optional().describe('Filter by rating (1-5)'),
        page: z.number().optional().describe('Page number (default: 1)'),
        limit: z.number().optional().describe('Items per page (default: 10, max: 50)'),
        includeStats: z.boolean().optional().describe('Include rating stats (average, distribution)'),
      },
    },
    createToolHandler('list_feedbacks', async ({ storeId, ...options }) => {
      return service.listFeedbacks(storeId, options);
    }),
  );

  server.registerTool(
    'validate_coupon',
    {
      description: 'Validate a coupon code for a given order value',
      inputSchema: {
        storeId: z.string().describe('Store ID'),
        code: z.string().describe('Coupon code to validate'),
        orderValue: z.number().describe('Order value in cents to check against'),
      },
    },
    createToolHandler('validate_coupon', async ({ storeId, code, orderValue }) => {
      return service.validateCoupon(storeId, code, orderValue);
    }),
  );
}
