import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CheckoutService } from '../../../core/services/checkout.service.js';
import { createToolHandler } from '../tool-handler.js';

const paymentMethodConfigSchema = z.object({
  token: z.string(),
  type: z.string(),
}).nullable().optional();

/**
 * PIX and card charge through a wallet (a payment route) of the seller: its gateways, order and
 * fallback live in the wallet, not in the checkout. `list_checkout_wallets` gives the ids.
 */
const walletMethodSchema = z.object({
  routeId: z.string().uuid().describe('Wallet id, from list_checkout_wallets'),
}).nullable().optional();

/** PayPal stays per checkout (outside the wallet): its own credential, by id. */
const paypalMethodSchema = z.object({
  token: z.string().min(1).describe('Id of the PayPal credential, from list_tokens'),
  type: z.literal('paypal'),
}).nullable().optional();

// Strict: an unknown key (a method this schema does not know) fails instead of being dropped, since a
// dropped method is a deleted one (the map replaces the stored methods as a whole).
const paymentMethodsSchema = z.strictObject({
  credit_card: walletMethodSchema
    .describe("Card through a wallet: {routeId}. The wallet's card charges. null turns card off"),
  pix: walletMethodSchema
    .describe("PIX through a wallet: {routeId}. The wallet's PIX chain charges, in its order. null turns PIX off"),
  bank_slip: paymentMethodConfigSchema
    .describe('Bank slip: {token, type}, the credential id from list_tokens. null turns bank slip off'),
  paypal: paypalMethodSchema
    .describe("PayPal, outside the wallet: {token, type: 'paypal'}, the credential id from list_tokens. null turns PayPal off"),
  installments: z.number().min(1).max(24).optional()
    .describe('Max card installments. Travels in this same map: send it with every stored method, never alone'),
  showInstallmentsOnPrice: z.boolean().optional()
    .describe('Show the installment value next to the price. Same rule as installments'),
  primaryPaymentMethod: z.enum(['pix', 'credit_card']).optional()
    .describe('Method selected first on the page. Same rule as installments'),
});

const socialCardSchema = z.array(z.object({
  text: z.string().min(1).max(1000),
  socialName: z.string().min(1).max(200),
  rating: z.number().min(1).max(5).optional(),
  photoUrl: z.string().optional(),
  isVerified: z.boolean().optional(),
  images: z.array(z.object({
    id: z.string(),
    url: z.string(),
  })).max(5).optional(),
})).max(50);

const fieldsSchema = z.object({
  havePhone: z.boolean().optional(),
  haveName: z.boolean().optional(),
  haveCpf: z.boolean().optional(),
});

/**
 * An image field of a checkout (`image`, `bannerUrl`): an absolute https URL, or the relative
 * `/api/r2-proxy/...` path `upload_media` returns (the only relative form the API accepts).
 */
const imageRefSchema = z.string().max(2048)
  .refine(
    (value) => value.startsWith('/api/r2-proxy/') || /^https:\/\/\S+$/.test(value),
    'must be an absolute https URL or a /api/r2-proxy/... path from upload_media',
  );

const timerSchema = z.strictObject({
  enabled: z.boolean().optional()
    .describe('true shows the countdown bar, false hides it. The API stores it inverted (`disabled`); the server maps it'),
  time: z.string().regex(/^\d{2}:[0-5]\d:[0-5]\d$/, 'time is HH:MM:SS').optional().describe('Countdown start, HH:MM:SS'),
  text: z.string().max(500).optional().describe('Text next to the countdown'),
  bgColor: z.string().max(20).optional().describe('Bar background, hex'),
  barColor: z.string().max(20).optional().describe('Urgency bar color, hex; empty is automatic (the model\'s color)'),
  textColor: z.string().max(20).optional().describe('Text color, hex'),
  enableSticky: z.boolean().optional().describe('Keep the bar fixed at the top while scrolling'),
});

const salesNotificationsSchema = z.strictObject({
  enabled: z.boolean().optional()
    .describe('true shows the "someone just bought" pop-ups, false hides them. Stored inverted (`disabled`); the server maps it'),
  position: z.enum(['bottom-left', 'bottom-right', 'top-left', 'top-right']).optional().describe('Where the pop-up shows'),
  defaultMessages: z.array(z.string().max(500)).max(50).optional().describe('Built-in messages to keep'),
  customMessages: z.array(z.union([
    z.string().max(500),
    z.object({ text: z.string().max(500), enabled: z.boolean().optional() }),
  ])).max(50).optional().describe('Own messages: a text, or { text, enabled }'),
  minMessages: z.union([z.string(), z.number()]).optional().describe('Minimum messages before it starts'),
  interval: z.union([z.string(), z.number()]).optional().describe('Seconds between pop-ups'),
  bgColor: z.string().max(20).optional(),
  borderColor: z.string().max(20).optional(),
  textColor: z.string().max(20).optional(),
  iconColor: z.string().max(20).optional(),
  iconBgColor: z.string().max(20).optional(),
});

const metricTokenSchema = z.union([
  z.string().max(500),
  z.array(z.string().max(500)).max(20),
]).describe('Id of a metric credential from list_tokens, or an array of them to fire several pixels (one per platform)');

const checkoutModelSchema = z.enum(['v2', 'v3', 'v4', 'v5', 'v6'])
  .describe('Checkout layout. The API default is v2. v6 is the button/embed checkout and is refused for a checkout with shipping');

const customDomainIdSchema = z.string().min(1).max(100).nullable()
  .describe('Id of a verified custom domain, from list_custom_domains, so the checkout opens on it; null unbinds it');

const analyticsSchema = z.strictObject({
  clarity: z.strictObject({
    projectId: z.string().regex(/^[a-z0-9]{10,64}$/, 'a Clarity project id is 10 to 64 lowercase letters and digits'),
  }).nullable().describe('Microsoft Clarity project; null removes it'),
}).describe('Page analytics, top level (not inside `checkout`)');

const FEATURES_NOTE = 'Timer and sales pop-ups go through the top-level `timer` and `salesNotifications` (with `enabled`), not inside `checkout`.';

export function registerCheckoutTools(server: McpServer, service: CheckoutService) {
  server.tool(
    'list_checkouts',
    'List all checkouts for the authenticated user',
    createToolHandler('list_checkouts', async () => {
      const checkouts = await service.list();
      return { checkouts };
    }),
  );

  server.registerTool(
    'get_checkout',
    {
      description: 'Get details of a specific checkout by ID',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
      },
    },
    createToolHandler('get_checkout', async ({ checkoutId }) => {
      const checkout = await service.getById(checkoutId);
      return { checkout };
    }),
  );

  server.registerTool(
    'create_checkout',
    {
      description: 'Create a new checkout page (an offer for an existing product). ' + FEATURES_NOTE
        + ' Sales pop-ups are off unless `salesNotifications.enabled` is true; the timer follows the API default.',
      inputSchema: {
        title: z.string().max(200).describe('Checkout page title'),
        productId: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/, 'productId must be a product uid').describe(
          'Uid of the product this checkout sells — the `productId` returned by create_product, '
          + 'or a `uid` from list_products. NOT a slug and NOT a name you invent: an invented '
          + 'value creates an orphan checkout the seller cannot open in the dashboard.',
        ),
        price: z.number().min(0).describe('Price in Brazilian Reais (e.g., 99.90) — converted to cents before it is sent'),
        paymentMethods: paymentMethodsSchema.describe('Payment methods configuration (credit_card, pix, bank_slip, paypal)'),
        checkout: z.record(z.string(), z.unknown()).describe('Checkout page styling/configuration (theme, colors, coupon, shipping…). ' + FEATURES_NOTE),
        timer: timerSchema.optional().describe('Countdown bar: { enabled, time "HH:MM:SS", text, colors }'),
        salesNotifications: salesNotificationsSchema.optional().describe('"Someone just bought" pop-ups: { enabled, position, messages, interval, colors }'),
        checkoutModel: checkoutModelSchema.optional(),
        customDomainId: customDomainIdSchema.optional(),
        analytics: analyticsSchema.optional(),
        url: z.string().url().optional().describe('Checkout URL (optional)'),
        bannerUrl: imageRefSchema.optional().describe('Banner image: an https URL or the /api/r2-proxy/... path from upload_media. The API silently drops a rejected banner, so check get_checkout'),
        image: imageRefSchema.optional().describe('Product image: an https URL or the /api/r2-proxy/... path from upload_media'),
        sellerName: z.string().max(200).optional().describe('Seller name (optional)'),
        orderBumps: z.array(z.string()).max(20).optional().describe('Uids of products offered as order bumps, resolved and snapshotted server-side (optional)'),
        fields: fieldsSchema.optional().describe('Custom form fields config (havePhone, haveName, haveCpf)'),
        socialCard: socialCardSchema.optional().describe('Social proof cards (optional)'),
        published: z.boolean().optional().describe('Published status (default: true)'),
        metricToken: metricTokenSchema.optional(),
        emailProviderToken: z.string().max(500).optional().describe('Email provider token (optional)'),
      },
    },
    createToolHandler('create_checkout', async (args) => {
      const checkout = await service.create(args);
      return { success: true, checkout };
    }),
  );

  server.registerTool(
    'update_checkout',
    {
      description: 'Update an existing checkout page. Only provide fields you want to update. ' + FEATURES_NOTE,
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
        title: z.string().max(200).optional().describe('Checkout page title'),
        price: z.number().min(0).optional().describe('Price in Brazilian Reais — converted to cents before it is sent'),
        paymentMethods: paymentMethodsSchema.optional()
          .describe('Payment methods configuration. Replaces the stored methods as a whole: send every stored method '
            + '(pix and credit_card with their {routeId}, bank_slip and paypal with their credential id from list_tokens), '
            + 'not only the one that changes, and null for one to turn off. installments and the other settings travel '
            + 'in this map too, so changing only them still means resending every method. A stored method left out '
            + 'is refused'),
        checkout: z.record(z.string(), z.unknown()).optional()
          .describe('Checkout page configuration, merged into the stored one (send only the keys to change). '
            + 'Payment methods are changed through `paymentMethods`; the stored ones are never re-sent from here. '
            + FEATURES_NOTE),
        timer: timerSchema.optional().describe('Countdown bar: { enabled, time "HH:MM:SS", text, colors }; merged into the stored one'),
        salesNotifications: salesNotificationsSchema.optional().describe('"Someone just bought" pop-ups; merged into the stored ones'),
        checkoutModel: checkoutModelSchema.optional(),
        customDomainId: customDomainIdSchema.optional(),
        analytics: analyticsSchema.optional(),
        url: z.string().url().optional()
          .describe('Where the buyer goes after the post-purchase funnel (upsells and downsells), or right after the '
            + "purchase when there is none. The offers on the seller's own page are set per product with "
            + 'set_offer_product_page, not here'),
        bannerUrl: imageRefSchema.optional().describe('Banner image: an https URL or the /api/r2-proxy/... path from upload_media. The API silently drops a rejected banner, so check get_checkout'),
        image: imageRefSchema.optional().describe('Product image: an https URL or the /api/r2-proxy/... path from upload_media'),
        sellerName: z.string().max(200).optional().describe('Seller name'),
        orderBumps: z.array(z.string()).max(20).optional().describe('Uids of products offered as order bumps, resolved and snapshotted server-side'),
        fields: fieldsSchema.optional().describe('Custom form fields config'),
        socialCard: socialCardSchema.optional().describe('Social proof cards'),
        published: z.boolean().optional().describe('Published status'),
        metricToken: metricTokenSchema.optional(),
        emailProviderToken: z.string().max(500).optional().describe('Email provider token'),
      },
    },
    createToolHandler('update_checkout', async ({ checkoutId, ...input }) => {
      const checkout = await service.update(checkoutId, input);
      return { success: true, checkout };
    }),
  );

  server.registerTool(
    'delete_checkout',
    {
      description: 'Delete a checkout page by ID',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
      },
    },
    createToolHandler('delete_checkout', async ({ checkoutId }) => {
      await service.delete(checkoutId);
      return { success: true, message: `Checkout ${checkoutId} deleted successfully` };
    }),
  );

  server.registerTool(
    'manage_checkout_tags',
    {
      description: 'Set tags for a checkout (replaces existing tags, max 5). Each tag has a name and hex color.',
      inputSchema: {
        checkoutId: z.string().describe('Checkout ID (uid)'),
        tags: z
          .array(
            z.object({
              name: z.string().max(50).describe('Tag name'),
              color: z.string().max(20).describe('Tag color in hex format (e.g., "#8b5cf6")'),
            }),
          )
          .max(5)
          .describe('List of tags to set on the checkout (max 5)'),
      },
    },
    createToolHandler('manage_checkout_tags', async ({ checkoutId, tags }) => {
      const result = await service.manageTags(checkoutId, tags);
      return { success: true, tags: result.tags };
    }),
  );
}
