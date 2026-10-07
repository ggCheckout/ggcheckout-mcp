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
        title: z.string().max(200).describe('Product title'),
        description: z.string().max(5000).describe('Product description'),
        price: z
          .union([z.number(), z.string()])
          .describe('Price in Brazilian Reais (number) or Brazilian format (string)'),
        discount: z.number().min(0).max(100).describe('Discount percentage (use 0 for no discount)'),
        url: z.string().url().describe('Product delivery URL (required for digital products)'),
        currency: z.enum(['BRL', 'USD']).optional().describe('Currency (default: BRL)'),
        imageUrl: z.string().url().optional().describe('Product image URL'),
        deliverableUrl: z.string().url().optional().describe('Alternative: direct file URL for delivery'),
        deliveryMethod: z
          .enum(['url', 'whatsapp', 'both'])
          .optional()
          .describe('Delivery method (default: url)'),
        isPhysicalProduct: z.boolean().optional().describe('Whether this is a physical product'),
        stockEnabled: z.boolean().optional().describe('Enable stock control'),
        stockQuantity: z.number().min(0).max(100000).optional().describe('Stock quantity (if stockEnabled)'),
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
      description:
        'Update an existing product/delivery. Only provide fields you want to update — the stored product is re-sent with your changes on top.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        title: z.string().max(200).optional().describe('Product title'),
        description: z.string().max(5000).optional().describe('Product description'),
        price: z
          .union([z.number(), z.string()])
          .optional()
          .describe('Price in Brazilian Reais (number) or Brazilian format (string)'),
        currency: z.enum(['BRL', 'USD']).optional().describe('Currency'),
        url: z.string().url().optional().describe('Product URL'),
        imageUrl: z.string().url().optional().describe('Product image URL'),
        discount: z.number().min(0).max(100).optional().describe('Discount percentage'),
        deliveryMethod: z
          .enum(['url', 'whatsapp', 'both'])
          .optional()
          .describe('Delivery method'),
        isPhysicalProduct: z.boolean().optional().describe('Whether this is a physical product'),
        stockEnabled: z.boolean().optional().describe('Enable stock control'),
        unlimitedStock: z.boolean().optional().describe('Unlimited stock (if stockEnabled)'),
        stockQuantity: z.number().min(0).max(100000).optional().describe('Stock quantity (if stockEnabled)'),
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
        'Step 1 of 2 to attach a file to a product: mint an upload URL. The file does NOT pass through '
        + 'this server. Returns { uploadUrl, filePath, contentType }. Step 2 is yours: PUT the raw bytes '
        + 'to `uploadUrl` with ONLY the header `Content-Type: <fileType>` and NO Authorization header '
        + '(the signature is in the URL and an extra header breaks it); the URL expires in 1 hour. '
        + 'Then call attach_deliverable with the same filePath/fileName/fileSize/fileType to confirm the '
        + 'upload and link it to the product. Max 250MB.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        fileName: z.string().max(200).describe('File name (e.g., "ebook.pdf")'),
        fileType: z.string().describe('MIME type of the file (e.g., "application/pdf")'),
        fileSize: z.number().int().positive().describe('File size in bytes (max 250MB)'),
      },
    },
    createToolHandler('upload_deliverable', async ({ productId, ...input }) => {
      const presign = await service.presignDeliverable(productId, input);
      return {
        ...presign,
        next: 'PUT the bytes to uploadUrl with only Content-Type set, then call attach_deliverable.',
      };
    }),
  );

  server.registerTool(
    'attach_deliverable',
    {
      description:
        'Step 2 of 2: confirm an uploaded file exists in storage and attach it to the product as its '
        + 'deliverable. Call it after PUTting the bytes to the uploadUrl from upload_deliverable, with '
        + 'the same values. Answers 404 if the bytes never landed.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        filePath: z.string().describe('The filePath returned by upload_deliverable'),
        fileName: z.string().max(200).describe('File name'),
        fileType: z.string().describe('MIME type'),
        fileSize: z.number().int().positive().describe('File size in bytes'),
      },
    },
    createToolHandler('attach_deliverable', async ({ productId, ...input }) => {
      const deliverable = await service.attachDeliverable(productId, input);
      return { success: true, deliverable };
    }),
  );

  server.registerTool(
    'delete_deliverable',
    {
      description:
        'Unlink the deliverable file from a product. Pass `filePath` to also delete the stored bytes; '
        + 'without it the file stays in storage, unreferenced.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        filePath: z.string().optional()
          .describe('The stored path (from get_product deliverable data) to also delete the bytes'),
      },
    },
    createToolHandler('delete_deliverable', async ({ productId, filePath }) => {
      await service.deleteDeliverable(productId, filePath);
      return {
        success: true,
        message: `Deliverable unlinked from product ${productId}${filePath ? ' and the file deleted' : ''}`,
      };
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
        title: z.string().max(200).describe('Upsell title'),
        description: z.string().max(5000).optional().describe('Upsell description'),
        price: z.number().min(0).optional().describe('Upsell price in cents'),
        originalPrice: z.number().min(0).optional().describe('Original price in cents (for showing discount)'),
        discount: z.string().max(50).optional().describe('Discount label (e.g., "30% OFF")'),
        imageUrl: z.string().url().optional().describe('Upsell image URL'),
        mediaType: z.enum(['image', 'video']).optional().describe('Media type'),
        deliveryMethod: z.enum(['url', 'file', 'whatsapp']).optional().describe('Delivery method'),
        timerEnabled: z.boolean().optional().describe('Enable countdown timer'),
        timerMinutes: z.number().min(0).max(525600).optional().describe('Timer duration in minutes'),
        status: z.enum(['active', 'inactive']).optional().describe('Upsell status (default: active)'),
        order: z.number().int().min(1).max(1000).optional().describe('Position in the funnel, 1-based (default: after the existing upsells)'),
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
      description:
        'Reorder the upsells of a product: send every upsell id, in the order you want. Returns the '
        + 'positions as stored. Ids are taken from list_upsells; an id that does not belong to the '
        + 'product is refused.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        upsellIds: z.array(z.string()).min(1).max(50)
          .describe('All upsell ids, in the desired order'),
      },
    },
    createToolHandler('reorder_upsells', async ({ productId, upsellIds }) => {
      const newOrder = await service.reorderUpsells(productId, upsellIds);
      return { success: true, newOrder };
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
        title: z.string().max(200).describe('Downsell title'),
        description: z.string().max(5000).optional().describe('Downsell description'),
        headline: z.string().max(200).optional().describe('Downsell headline'),
        price: z.number().min(0).describe('Downsell price in cents'),
        originalPrice: z.number().min(0).optional().describe('Original price in cents'),
        discount: z.string().max(50).optional().describe('Discount label'),
        timerEnabled: z.boolean().optional().describe('Enable countdown timer'),
        timerMinutes: z.number().min(0).max(525600).optional().describe('Timer duration in minutes'),
        mediaType: z.enum(['image', 'video']).optional().describe('Media type'),
        status: z.enum(['active', 'inactive']).optional().describe('Downsell status'),
        chainBehavior: z.enum(['continue', 'stop']).optional().describe('Chain behavior after this downsell'),
        order: z.number().int().min(1).max(1000).optional().describe('Position in the sequence, 1-based (default: after the existing downsells)'),
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
      description:
        'Reorder the downsells of a product. Returns the positions as stored. An id that does not '
        + 'belong to the product is refused.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        order: z.array(z.string()).min(1).max(100).describe('All downsell ids, in the desired order'),
      },
    },
    createToolHandler('reorder_downsells', async ({ productId, order }) => {
      const newOrder = await service.reorderDownsells(productId, order);
      return { success: true, newOrder };
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
              name: z.string().max(200).describe('Tag name'),
              color: z.string().max(20).describe('Tag color (hex code, e.g., "#FF5733")'),
            }),
          )
          .max(100)
          .describe('List of tags to set on the product'),
      },
    },
    createToolHandler('manage_tags', async ({ productId, tags }) => {
      const result = await service.manageTags(productId, tags);
      return { success: true, tags: result.tags };
    }),
  );
}
