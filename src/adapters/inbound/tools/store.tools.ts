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
        + 'The API validates every block, so keep the block shapes you read. Returns the layout as stored: the API drops keys it does not know, '
        + 'so compare it with what you sent.',
      inputSchema: {
        storeId: storeIdSchema,
        theme: z.record(z.string(), z.unknown()).optional().describe('Theme changes (colors, fonts…), merged into the stored theme'),
        blocks: z.array(z.record(z.string(), z.unknown())).max(200).optional().describe('ALL page blocks, in order (replaces the stored blocks)'),
        config: z.record(z.string(), z.unknown()).optional().describe('Layout config changes, merged'),
        pageSettings: z.object({
          product: z.object({
            density: z.enum(['comfortable', 'compact']),
            showBreadcrumbs: z.boolean(),
            showRelatedProducts: z.boolean(),
            galleryStyle: z.enum(['thumbnails', 'dots']),
          }).partial(),
          category: z.object({
            density: z.enum(['comfortable', 'compact']),
            columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
            showCount: z.boolean(),
          }).partial(),
          cart: z.object({ density: z.enum(['comfortable', 'compact']) }).partial(),
        }).partial().strict().optional().describe('Product, category and cart page settings, merged'),
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

  // --- Store admin (seller routes under /api/stores) ---

  server.registerTool(
    'create_store',
    {
      description:
        'Create a store. It starts unpublished, with the default theme and no categories or gateways. Returns its storeId. '
        + 'Requires a seller with verified email and phone. Then configure it with update_store (gateways in paymentMethods) and publish it.',
      inputSchema: {
        title: z.string().trim().min(1).max(120).optional().describe('Store title (default: "Nova Loja")'),
      },
    },
    createToolHandler('create_store', async ({ title }) => {
      const { storeId } = await service.createStore(title);
      return { success: true, storeId };
    }),
  );

  server.registerTool(
    'get_store',
    {
      description: "Get the seller's full store configuration, unpublished stores included (payment tokens are never returned)",
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('get_store', async ({ storeId }) => {
      const config = await service.getStore(storeId);
      return { config };
    }),
  );

  const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use #RRGGBB');
  const paymentMethod = z.object({
    enabled: z.boolean(),
    gateways: z.array(z.string()).max(20).describe('Gateway token ids from list_tokens (replaces the list)'),
  }).partial();

  server.registerTool(
    'update_store',
    {
      description:
        'Update store configuration. Send only what changes: objects are merged into the stored ones, lists (productOrder, gateways, productIds) '
        + 'replace the stored list. `published: true` makes the store public (requires a verified seller). '
        + 'Integrations, store upsells/downsells, video and sales notifications are dashboard-only.',
      inputSchema: {
        storeId: storeIdSchema,
        template: z.string().min(1).max(64).optional(),
        settings: z.object({ title: z.string().min(1).max(120), description: z.string().max(2000) }).partial().optional(),
        theme: z.object({
          primaryColor: hexColor,
          secondaryColor: hexColor,
          backgroundColor: hexColor,
          logo: z.string().max(2048).describe('http(s) URL, or "" to remove'),
          favicon: z.string().max(2048).describe('http(s) URL, or "" to remove'),
        }).partial().optional(),
        paymentMethods: z.object({ pix: paymentMethod, credit_card: paymentMethod }).partial().optional(),
        socialLinks: z.object({
          facebook: z.string().max(500), instagram: z.string().max(500), twitter: z.string().max(500),
          youtube: z.string().max(500), discord: z.string().max(500), telegram: z.string().max(500),
          whatsapp: z.string().max(500),
        }).partial().optional(),
        supportButton: z.object({
          enabled: z.boolean(),
          text: z.string().max(100),
          url: z.string().max(2048).describe('http(s) URL, or ""'),
          position: z.enum(['bottom-left', 'bottom-right', 'top-left', 'top-right']),
        }).partial().optional(),
        orderBump: z.object({
          enabled: z.boolean(),
          showFakeDiscount: z.boolean(),
          fakeDiscountPercent: z.number().min(0).max(100),
          globalBumpProductIds: z.array(z.string()).max(1000),
          maxBumpsToShow: z.number().int().min(1).max(10),
        }).partial().optional(),
        storeOrderBumps: z.record(z.string(), z.array(z.string()).max(1000)).optional()
          .describe('productId -> ids of the products offered as bump, in order'),
        storeOriginalPrices: z.record(z.string(), z.number().int().min(0)).optional()
          .describe('productId -> struck-through original price in CENTS'),
        customerFields: z.object({
          haveEmail: z.boolean(), haveName: z.boolean(), havePhone: z.boolean(), haveCpf: z.boolean(),
          cpfPaymentMethods: z.array(z.enum(['pix', 'credit_card'])).max(2),
          requireEmailConfirmation: z.boolean(), requirePhoneConfirmation: z.boolean(), phoneSingleField: z.boolean(),
        }).partial().optional(),
        customDomainId: z.string().nullable().optional().describe('Id from list_custom_domains; null for the default domain'),
        productOrder: z.array(z.string()).max(1000).optional().describe('Product uids in storefront order (replaces the list)'),
        showVerifiedBadge: z.boolean().optional(),
        published: z.boolean().optional().describe('Make the store public or hide it'),
      },
    },
    createToolHandler('update_store', async ({ storeId, ...patch }) => {
      const config = await service.updateStore(storeId, patch);
      return { success: true, config };
    }),
  );

  server.registerTool(
    'delete_store',
    {
      description: 'Delete a store (soft delete; the storefront stops answering)',
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('delete_store', async ({ storeId }) => {
      await service.deleteStore(storeId);
      return { success: true, message: `Store ${storeId} deleted` };
    }),
  );

  // --- Store categories (owner view; list_categories is the public storefront view) ---

  const categoryFields = {
    description: z.string().max(1000).optional(),
    image: z.string().max(2048).optional().describe('http(s) URL, or "" to remove'),
    imagePosition: z.string().max(40).optional().describe('CSS object-position, e.g. "center" or "50% 30%"'),
    productIds: z.array(z.string()).max(1000).optional()
      .describe('Product uids in this category (replaces the list; unknown or deleted ids are dropped silently)'),
    parentId: z.string().nullable().optional().describe('Parent category id; null for top level (max depth 3)'),
  };

  server.registerTool(
    'list_store_categories',
    {
      description: "List the store's categories as the owner sees them (works on unpublished stores), with productIds, order and parentId",
      inputSchema: {
        storeId: storeIdSchema,
      },
    },
    createToolHandler('list_store_categories', async ({ storeId }) => {
      const categories = await service.listStoreCategories(storeId);
      return { categories };
    }),
  );

  server.registerTool(
    'create_store_category',
    {
      description: 'Create a store category and optionally put products in it. It is added last among its siblings; move it with update_store_category. Check productIds in the response: unknown ids are dropped.',
      inputSchema: {
        storeId: storeIdSchema,
        name: z.string().trim().min(1).max(100).describe('Category name'),
        ...categoryFields,
      },
    },
    createToolHandler('create_store_category', async ({ storeId, ...input }) => {
      const category = await service.createStoreCategory(storeId, input);
      return { success: true, category };
    }),
  );

  server.registerTool(
    'update_store_category',
    {
      description: 'Update a store category. Fields you omit are kept; productIds replaces the list.',
      inputSchema: {
        storeId: storeIdSchema,
        categoryId: z.string().describe('Category id from list_store_categories'),
        name: z.string().trim().min(1).max(100).optional(),
        ...categoryFields,
        order: z.number().int().min(0).max(100000).optional().describe('Position among siblings (same parent)'),
      },
    },
    createToolHandler('update_store_category', async ({ storeId, categoryId, ...input }) => {
      const category = await service.updateStoreCategory(storeId, categoryId, input);
      return { success: true, category };
    }),
  );

  server.registerTool(
    'delete_store_category',
    {
      description: 'Delete a store category AND all its subcategories. Products are not deleted.',
      inputSchema: {
        storeId: storeIdSchema,
        categoryId: z.string().describe('Category id'),
      },
    },
    createToolHandler('delete_store_category', async ({ storeId, categoryId }) => {
      const { deletedIds } = await service.deleteStoreCategory(storeId, categoryId);
      return { success: true, deletedIds };
    }),
  );

  // --- Store reviews moderation (list_feedbacks is the public, approved-only view) ---

  server.registerTool(
    'list_store_reviews',
    {
      description: 'List store reviews for moderation, pending included, with counts per status',
      inputSchema: {
        storeId: storeIdSchema,
        status: z.enum(['all', 'approved', 'pending']).optional().describe('Default: all'),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional().describe('Default: 10'),
      },
    },
    createToolHandler('list_store_reviews', async ({ storeId, ...options }) => {
      return service.listStoreReviews(storeId, options);
    }),
  );

  const reviewContent = {
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(10).max(1000),
    customerName: z.string().trim().min(2).max(100),
  };

  server.registerTool(
    'create_store_review',
    {
      description: 'Add a review written by the seller to a store product. It is published (approved) immediately.',
      inputSchema: {
        storeId: storeIdSchema,
        productId: z.string().describe('Product uid'),
        ...reviewContent,
        createdAt: z.string().datetime({ offset: true }).optional().describe('Date shown on the review (ISO 8601; default now)'),
      },
    },
    createToolHandler('create_store_review', async ({ storeId, ...input }) => {
      const feedback = await service.createStoreReview(storeId, input);
      return { success: true, feedback };
    }),
  );

  server.registerTool(
    'update_store_review',
    {
      description:
        'Approve or hide a review (`approved`), and/or edit a review the SELLER wrote. To edit, send customerName, rating, comment and createdAt together; '
        + "reviews written by real buyers can only be approved or hidden.",
      inputSchema: {
        storeId: storeIdSchema,
        feedbackId: z.string().describe('Review id from list_store_reviews'),
        approved: z.boolean().optional().describe('true shows it on the store, false hides it'),
        rating: reviewContent.rating.optional(),
        comment: reviewContent.comment.optional(),
        customerName: reviewContent.customerName.optional(),
        createdAt: z.string().datetime({ offset: true }).optional(),
      },
    },
    createToolHandler('update_store_review', async ({ storeId, feedbackId, ...update }) => {
      await service.updateStoreReview(storeId, feedbackId, update);
      return { success: true, message: `Review ${feedbackId} updated` };
    }),
  );

  server.registerTool(
    'delete_store_review',
    {
      description: 'Permanently delete a store review',
      inputSchema: {
        storeId: storeIdSchema,
        feedbackId: z.string().describe('Review id'),
      },
    },
    createToolHandler('delete_store_review', async ({ storeId, feedbackId }) => {
      await service.deleteStoreReview(storeId, feedbackId);
      return { success: true, message: `Review ${feedbackId} deleted` };
    }),
  );
}
