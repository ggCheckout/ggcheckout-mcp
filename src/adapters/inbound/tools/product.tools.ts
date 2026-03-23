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
        'Create a new product/delivery. Requires at least a URL or deliverableUrl for digital delivery. Price in Brazilian Reais (e.g., 19.90 for R$19.90).',
      inputSchema: {
        title: z.string().describe('Product title'),
        description: z.string().describe('Product description'),
        price: z
          .union([z.number(), z.string()])
          .describe('Price in Brazilian Reais (number) or Brazilian format (string)'),
        discount: z.number().describe('Discount percentage (use 0 for no discount)'),
        url: z.string().describe('Product delivery URL (required for digital products)'),
        currency: z.enum(['BRL', 'USD']).optional().describe('Currency (default: BRL)'),
        imageUrl: z.string().optional().describe('Product image URL'),
        deliverableUrl: z.string().optional().describe('Alternative: direct file URL for delivery'),
        deliveryMethod: z
          .enum(['url', 'whatsapp', 'both'])
          .optional()
          .describe('Delivery method (default: url)'),
        isPhysicalProduct: z.boolean().optional().describe('Whether this is a physical product'),
        stockEnabled: z.boolean().optional().describe('Enable stock control'),
        stockQuantity: z.number().optional().describe('Stock quantity (if stockEnabled)'),
      },
    },
    createToolHandler('create_product', async (args) => {
      const result = await service.create(args);
      return { success: true, productId: result.productId };
    }),
  );

  server.registerTool(
    'update_product',
    {
      description: 'Update an existing product/delivery. Only provide fields you want to update.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        title: z.string().optional().describe('Product title'),
        description: z.string().optional().describe('Product description'),
        price: z
          .union([z.number(), z.string()])
          .optional()
          .describe('Price in Brazilian Reais (number) or Brazilian format (string)'),
        currency: z.enum(['BRL', 'USD']).optional().describe('Currency'),
        url: z.string().optional().describe('Product URL'),
        imageUrl: z.string().optional().describe('Product image URL'),
        discount: z.number().optional().describe('Discount percentage'),
        deliveryMethod: z
          .enum(['url', 'whatsapp', 'both'])
          .optional()
          .describe('Delivery method'),
        isPhysicalProduct: z.boolean().optional().describe('Whether this is a physical product'),
      },
    },
    createToolHandler('update_product', async ({ productId, ...input }) => {
      await service.update(productId, input);
      return { success: true, message: `Product ${productId} updated successfully` };
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

  server.registerTool(
    'upload_deliverable',
    {
      description:
        'Upload a deliverable file to a product. Provide the file URL, name, and optionally the MIME type.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        fileUrl: z.string().url().describe('Public URL of the file to attach as deliverable'),
        fileName: z.string().describe('File name (e.g., "ebook.pdf")'),
        fileType: z
          .string()
          .optional()
          .describe('MIME type of the file (e.g., "application/pdf"). Auto-detected if omitted.'),
      },
    },
    createToolHandler('upload_deliverable', async ({ productId, ...input }) => {
      const deliverable = await service.uploadDeliverable(productId, input);
      return { success: true, deliverable };
    }),
  );

  server.registerTool(
    'delete_deliverable',
    {
      description: 'Remove the deliverable file from a product',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
      },
    },
    createToolHandler('delete_deliverable', async ({ productId }) => {
      await service.deleteDeliverable(productId);
      return { success: true, message: `Deliverable removed from product ${productId}` };
    }),
  );

  // --- Upsells ---

  server.registerTool(
    'list_upsells',
    {
      description: 'List all upsells for a product',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
      },
    },
    createToolHandler('list_upsells', async ({ productId }) => {
      const upsells = await service.listUpsells(productId);
      return { upsells };
    }),
  );

  server.registerTool(
    'create_upsell',
    {
      description: 'Create an upsell for a product. Requires upsellProductId (the product being offered as upsell) and a unique upsellId.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid) the upsell belongs to'),
        upsellId: z.string().describe('Unique ID for this upsell'),
        upsellProductId: z.string().describe('Product ID being offered as upsell'),
        title: z.string().describe('Upsell title'),
        description: z.string().optional().describe('Upsell description'),
        price: z.number().optional().describe('Upsell price in cents'),
        originalPrice: z.number().optional().describe('Original price in cents (for showing discount)'),
        discount: z.string().optional().describe('Discount label (e.g., "30% OFF")'),
        imageUrl: z.string().optional().describe('Upsell image URL'),
        mediaType: z.enum(['image', 'video']).optional().describe('Media type'),
        deliveryMethod: z.enum(['url', 'file', 'whatsapp']).optional().describe('Delivery method'),
        timerEnabled: z.boolean().optional().describe('Enable countdown timer'),
        timerMinutes: z.number().optional().describe('Timer duration in minutes'),
        status: z.enum(['active', 'inactive']).optional().describe('Upsell status (default: active)'),
      },
    },
    createToolHandler('create_upsell', async (args) => {
      const { productId, upsellId, ...input } = args;
      const upsell = await service.createUpsell(productId, upsellId, input);
      return { success: true, upsell };
    }),
  );

  server.registerTool(
    'delete_upsell',
    {
      description: 'Delete an upsell from a product',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        upsellId: z.string().describe('Upsell ID'),
      },
    },
    createToolHandler('delete_upsell', async ({ productId, upsellId }) => {
      await service.deleteUpsell(productId, upsellId);
      return { success: true, message: `Upsell ${upsellId} deleted` };
    }),
  );

  server.registerTool(
    'reorder_upsells',
    {
      description: 'Reorder upsells for a product by sending the full upsells array in desired order',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        upsells: z.array(z.object({}).passthrough()).describe('Full upsells array in desired order'),
      },
    },
    createToolHandler('reorder_upsells', async ({ productId, upsells }) => {
      await service.reorderUpsells(productId, upsells);
      return { success: true, message: 'Upsells reordered' };
    }),
  );

  // --- Downsells ---

  server.registerTool(
    'list_downsells',
    {
      description: 'List all downsells for a product',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
      },
    },
    createToolHandler('list_downsells', async ({ productId }) => {
      const result = await service.listDownsells(productId);
      return { downsells: result.downsells, count: result.count };
    }),
  );

  server.registerTool(
    'create_downsell',
    {
      description: 'Create a downsell for a product. Requires downsellProductId and a unique downsellId.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid) the downsell belongs to'),
        downsellId: z.string().describe('Unique ID for this downsell'),
        downsellProductId: z.string().describe('Product ID being offered as downsell'),
        title: z.string().describe('Downsell title'),
        description: z.string().optional().describe('Downsell description'),
        headline: z.string().optional().describe('Downsell headline'),
        price: z.number().describe('Downsell price in cents'),
        originalPrice: z.number().optional().describe('Original price in cents'),
        discount: z.string().optional().describe('Discount label'),
        timerEnabled: z.boolean().optional().describe('Enable countdown timer'),
        timerMinutes: z.number().optional().describe('Timer duration in minutes'),
        mediaType: z.enum(['image', 'video']).optional().describe('Media type'),
        status: z.enum(['active', 'inactive']).optional().describe('Downsell status'),
        chainBehavior: z.enum(['continue', 'stop']).optional().describe('Chain behavior after this downsell'),
      },
    },
    createToolHandler('create_downsell', async (args) => {
      const { productId, downsellId, ...input } = args;
      const downsell = await service.createDownsell(productId, downsellId, input);
      return { success: true, downsell };
    }),
  );

  server.registerTool(
    'delete_downsell',
    {
      description: 'Delete a downsell from a product',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        downsellId: z.string().describe('Downsell ID'),
      },
    },
    createToolHandler('delete_downsell', async ({ productId, downsellId }) => {
      await service.deleteDownsell(productId, downsellId);
      return { success: true, message: `Downsell ${downsellId} deleted` };
    }),
  );

  server.registerTool(
    'reorder_downsells',
    {
      description: 'Reorder downsells for a product',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        order: z.array(z.string()).describe('Ordered list of downsell IDs'),
      },
    },
    createToolHandler('reorder_downsells', async ({ productId, order }) => {
      await service.reorderDownsells(productId, order);
      return { success: true, message: 'Downsells reordered' };
    }),
  );

  // --- Tags ---

  server.registerTool(
    'manage_tags',
    {
      description: 'Set tags for a product (replaces existing tags). Each tag has a name and color.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        tags: z
          .array(
            z.object({
              name: z.string().describe('Tag name'),
              color: z.string().describe('Tag color (hex code, e.g., "#FF5733")'),
            }),
          )
          .describe('List of tags to set on the product'),
      },
    },
    createToolHandler('manage_tags', async ({ productId, tags }) => {
      const result = await service.manageTags(productId, tags);
      return { success: true, tags: result.tags };
    }),
  );
}
