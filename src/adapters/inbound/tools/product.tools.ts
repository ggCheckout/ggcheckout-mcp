import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProductService } from '../../../core/services/product.service.js';
import { createToolHandler } from '../tool-handler.js';
import { isSellerPageUrl } from '../../../shared/external-offer-snippet.js';

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
        'Update an existing product/delivery. Only provide fields you want to update; everything else is '
        + 'kept. Refused with an explanation when the product delivers only stock lines or a file on an '
        + 'account where the API cannot read them back: pass `url` with the change, or edit it in the dashboard.',
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
        + 'the same values. Answers 404 if the bytes never landed. A link (`url`) the product already '
        + 'has is kept; when both exist, the file is what the buyer receives.',
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
        'Unlink the deliverable file from a product; a link (`url`) it also has stays. Refused when the '
        + 'file is the only deliverable, because the API will not save a product with nothing to deliver: '
        + 'give it a `url` first. Pass `filePath` to also delete the stored bytes; without it the file '
        + 'stays in storage, unreferenced. If the unlink works and the byte deletion does not, the answer '
        + 'says so in `fileDeleteError` and the product stays unlinked.',
      inputSchema: {
        productId: z.string().describe('Product ID (uid)'),
        filePath: z.string().optional()
          .describe('The filePath returned by upload_deliverable (also `deliverableFile.filePath` in '
            + 'get_product, on accounts whose read carries it), to also delete the bytes. It must be a file '
            + 'of this product; a file uploaded in the dashboard before the product was saved cannot be '
            + 'confirmed here, so for those call without filePath (unlink only)'),
      },
    },
    createToolHandler('delete_deliverable', async ({ productId, filePath }) => {
      const result = await service.deleteDeliverable(productId, filePath);
      const bytes = result.fileDeleted ? ' and the file deleted' : '';
      return { success: true, ...result, message: `Deliverable unlinked from product ${productId}${bytes}` };
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

  // --- Offers on the seller's page ("Minha página") ---

  // Scheme checked in code: `z.string().url()` alone accepts `javascript:`. http only for localhost
  // (a development server); the API has the final word.
  const sellerPageUrl = z.string().url().max(2048)
    .refine((value) => isSellerPageUrl(value), 'must be an https URL (http only for localhost)');
  const offerTarget = {
    productId: z.string()
      .describe('Product ID (uid) the offer is configured under — for an upsell, the product sold by the checkout'),
    kind: z.enum(['upsell', 'downsell']).describe('Offer kind'),
    offerId: z.string().describe('The offer uid, from list_upsells / list_downsells'),
  };

  server.registerTool(
    'get_offer_snippets',
    {
      description:
        "Read-only. Every product of an upsell or downsell offer in funnel order, with where it opens "
        + "(the GG offer page, or the seller's own page) and, for each product on the seller's page, the "
        + 'HTML to paste there (the same as "Copiar HTML" in the dashboard) and the page it goes on. Use '
        + "it to have an agent put the buttons on the seller's landing page: paste each `html` where the "
        + 'buttons should appear on its `pageUrl`, keeping the <script> tag. Each snippet works only for '
        + 'its own product, when the funnel order reaches it.',
      inputSchema: offerTarget,
    },
    createToolHandler('get_offer_snippets', async ({ productId, kind, offerId }) => {
      const result = await service.getOfferPages(productId, kind, offerId);
      return { success: true, ...result };
    }),
  );

  server.registerTool(
    'set_offer_product_page',
    {
      description:
        "Put ONE product of an upsell or downsell offer on the seller's own page (\"Minha página\") "
        + 'instead of the GG offer page, or back on the GG page with `page: null`. GG and seller pages '
        + 'can be mixed in the same funnel: the funnel order decides where the buyer goes after '
        + 'accepting or declining, and each product opens on its own kind of page (there are no '
        + "per-button destinations). `page.pageUrl` is the seller's page where that product's buttons "
        + 'are pasted (https; http only for localhost on a development server). Answers every product '
        + 'of the offer like get_offer_snippets, with the HTML to paste for the products on the '
        + "seller's page. Back on the GG page keeps the stored page, so nothing is lost.",
      inputSchema: {
        ...offerTarget,
        offeredProductId: z.string()
          .describe('The offered product (uid) to move: one of the products the offer sells, as listed by get_offer_snippets'),
        page: z
          .object({
            pageUrl: sellerPageUrl.describe("The seller's page where this product's buttons are pasted"),
            acceptLabel: z.string().trim().min(1).max(160).describe('Text of the accept button'),
            declineLabel: z.string().trim().min(1).max(160).describe('Text of the decline link'),
            buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).describe('Accept button color, #RRGGBB'),
          })
          .nullable()
          .describe("The seller's page of this product, or null to show it on the GG offer page again"),
      },
    },
    createToolHandler('set_offer_product_page', async ({ productId, kind, offerId, offeredProductId, page }) => {
      const result = await service.setOfferProductPage(productId, kind, offerId, offeredProductId, page);
      return { success: true, ...result };
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
