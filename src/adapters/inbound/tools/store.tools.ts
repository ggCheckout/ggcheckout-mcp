import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StoreService } from '../../../core/services/store.service.js';
import { createToolHandler } from '../tool-handler.js';

// These tools read the PUBLIC storefront, exactly what a buyer sees: they only find published
// stores, return approved reviews only, and may be served from a cache up to 7 days old.
const STOREFRONT_NOTE =
  ' Reads the public storefront (what a buyer sees): the store must be published, and results may be cached for up to 7 days.';

const storeIdSchema = z.string().describe('Store ID (from list_stores)');

export function registerStoreTools(server: McpServer, service: StoreService) {
  server.tool(
    'list_stores',
    'List the stores owned by the authenticated seller ({ storeId, title, logo }). Every other store tool takes one of these storeIds.',
    createToolHandler('list_stores', async () => {
      const stores = await service.listStores();
      return { stores };
    }),
  );

  server.registerTool(
    'get_store_config',
    {
      description: 'Get store configuration (theme, settings, payment methods). Works on unpublished stores; may be cached.',
      inputSchema: {
        storeId: storeIdSchema,
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
      description: `Get the public store page data: store info, categories and products (prices in cents).${STOREFRONT_NOTE}`,
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('get_store_public', async ({ storeId }) => {
      return service.getPublic(storeId);
    }),
  );

  server.registerTool(
    'list_store_products',
    {
      description: `List products in the store catalog with pagination, search and sorting (prices in reais).${STOREFRONT_NOTE}`,
      inputSchema: {
        storeId: storeIdSchema,
        categoryId: z.string().optional().describe('Filter by category ID'),
        search: z.string().max(200).optional().describe('Search by product title'),
        page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
        limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
        sortBy: z.enum(['title', 'price']).optional().describe('Sort field (default: store order)'),
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
      description: `Get detailed product information including variants and stock.${STOREFRONT_NOTE}`,
      inputSchema: {
        storeId: storeIdSchema,
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
      description: `List all categories in the store.${STOREFRONT_NOTE}`,
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('list_categories', async ({ storeId }) => {
      return service.listCategories(storeId);
    }),
  );

  server.registerTool(
    'list_custom_fields',
    {
      description: 'List custom fields configured for the store, optionally filtered by product (read-only: there is no API to edit them)',
      inputSchema: {
        storeId: storeIdSchema,
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
      description:
        'Get a store order by ID. With an API key only PENDING orders are returned: paid orders need the buyer or seller browser session. For paid sales use the payment tools.',
      inputSchema: {
        storeId: storeIdSchema,
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
      description: `List APPROVED product reviews with pagination and optional stats (pending reviews are not visible here).${STOREFRONT_NOTE}`,
      inputSchema: {
        storeId: storeIdSchema,
        productId: z.string().optional().describe('Filter by product ID'),
        rating: z.number().int().min(1).max(5).optional().describe('Filter by rating (1-5)'),
        page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
        limit: z.number().int().min(1).max(50).optional().describe('Items per page (default: 10, max: 50)'),
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
      description: 'Check whether a coupon applies to an order value in this store (coupons themselves are managed with the discount tools)',
      inputSchema: {
        storeId: storeIdSchema,
        code: z.string().max(50).describe('Coupon code to validate'),
        orderValue: z.number().int().min(0).describe('Order value in CENTS (integer), e.g. 9990 for R$99,90'),
      },
    },
    createToolHandler('validate_coupon', async ({ storeId, code, orderValue }) => {
      return service.validateCoupon(storeId, code, orderValue);
    }),
  );

  // --- Store builder (the seller's layout editor) ---

  server.registerTool(
    'get_store_layout',
    {
      description:
        'Get the layout the store builder opens: the draft, else the published layout, else a seed from the theme. `layout` is null and `isNewStore` true for a store that was never designed.',
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('get_store_layout', async ({ storeId }) => {
      return service.getLayout(storeId);
    }),
  );

  server.registerTool(
    'update_store_layout',
    {
      description:
        'Save the store builder DRAFT (not public until publish_store_layout). `theme`, `config` and `pageSettings` are merged into the stored ones, '
        + 'so send only the keys you change. `blocks` REPLACES the stored list: call get_store_layout, edit the full array and send it back. '
        + 'The API validates every block, so keep the block shapes you read.',
      inputSchema: {
        storeId: storeIdSchema,
        theme: z.record(z.string(), z.unknown()).optional().describe('Theme changes (colors, fonts…), merged into the stored theme'),
        blocks: z.array(z.record(z.string(), z.unknown())).max(200).optional().describe('ALL page blocks, in order (replaces the stored blocks)'),
        config: z.record(z.string(), z.unknown()).optional().describe('Layout config changes, merged'),
        pageSettings: z.record(z.string(), z.unknown()).optional().describe('Page settings changes, merged'),
      },
    },
    createToolHandler('update_store_layout', async ({ storeId, ...update }) => {
      const layout = await service.updateLayout(storeId, update);
      return { success: true, layout };
    }),
  );

  server.registerTool(
    'publish_store_layout',
    {
      description:
        'Publish the current draft layout, making it the public storefront and marking the store published. The previous published layout goes to the history. Limited to 5 per minute; requires a verified seller.',
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('publish_store_layout', async ({ storeId }) => {
      const { version } = await service.publishLayout(storeId);
      return { success: true, version };
    }),
  );

  server.registerTool(
    'list_store_layout_history',
    {
      description: 'List previously published layout versions of a store, newest first',
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('list_store_layout_history', async ({ storeId }) => {
      const versions = await service.listLayoutHistory(storeId);
      return { versions };
    }),
  );

  server.registerTool(
    'restore_store_layout_version',
    {
      description: 'Copy a published version from the history into the DRAFT. The public store does not change until publish_store_layout.',
      inputSchema: {
        storeId: storeIdSchema,
        version: z.number().int().min(0).describe('Version number from list_store_layout_history'),
      },
    },
    createToolHandler('restore_store_layout_version', async ({ storeId, version }) => {
      const layout = await service.restoreLayoutVersion(storeId, version);
      return { success: true, layout };
    }),
  );

  server.registerTool(
    'get_store_theme',
    {
      description: "Get the store's theme snapshot as the builder's template gallery reads it (not cached)",
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('get_store_theme', async ({ storeId }) => {
      return service.getTheme(storeId);
    }),
  );
}
