import type { AuthPort } from '../ports/auth.port.js';
import type { CheckoutPort } from '../ports/checkout.port.js';
import type { ProductPort } from '../ports/product.port.js';
import type {
  Checkout,
  CheckoutPaymentMethods,
  CheckoutTag,
  CheckoutPageFeaturesInput,
  CreateCheckoutRequest,
  UpdateCheckoutRequest,
  UpdateCheckoutPayload,
} from '../types/checkout.js';
import type { Product } from '../types/product.js';
import { AppError, EdgeBlockedError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { parsePriceToCents } from '../../shared/validation.js';
import { mergeDeep } from '../../shared/merge.js';

const PRODUCT_HINT =
  'It does not exist or belongs to another seller. Call create_product first and use the '
  + 'productId it returns, or pick a uid from list_products.';

export class CheckoutService {
  constructor(
    private readonly checkoutPort: CheckoutPort,
    private readonly authPort: AuthPort,
    private readonly productPort: ProductPort,
  ) {}

  async list(): Promise<Checkout[]> {
    const businessId = await this.authPort.getMyBusinessId();
    return this.checkoutPort.list(businessId);
  }

  async getById(id: string): Promise<Checkout> {
    return this.checkoutPort.getById(id);
  }

  async create(request: CreateCheckoutRequest): Promise<Checkout> {
    const { timer, salesNotifications, ...input } = request;
    refuseNestedPaymentMethods(input.checkout);
    // Independent lookups: the product resolution needs only the input, the business id
    // needs nothing from it.
    const [, businessId, orderBumps] = await Promise.all([
      this.resolveProduct(input.productId),
      this.authPort.getMyBusinessId(),
      this.serializeOrderBumps(input.orderBumps),
    ]);
    return this.checkoutPort.create({
      ...input,
      // A new checkout has no sales pop-ups unless the caller turns them on.
      checkout: withPageFeatures(input.checkout, { timer, salesNotifications }, { salesNotificationsOffByDefault: true }) ?? {},
      uuidOwner: businessId,
      price: parsePriceToCents(input.price),
      ...(orderBumps ? { orderBumps } : {}),
    });
  }

  /**
   * Resolves the product a checkout hangs off. A checkout whose owning product does not
   * exist is accepted by the API but becomes an orphan the seller cannot open, so this
   * runs before the write, while the agent can still act on it.
   *
   * Only the product route's own verdict means a bad productId — it answers 403 for a
   * document that does not exist, so a missing product and a foreign one look identical.
   * Every other failure (timeout, 5xx, expired key, throttling) must reach the agent
   * unchanged: told "product not found" during an outage, it creates a duplicate product.
   */
  private async resolveProduct(productId: string): Promise<Product> {
    try {
      return await this.productPort.getById(productId);
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : undefined;
      if (error instanceof EdgeBlockedError || (status !== 403 && status !== 404)) throw error;
      throw new NotFoundError('Product', productId, PRODUCT_HINT);
    }
  }

  /**
   * Order bumps are stored as one JSON snapshot per bump, not as bare uids: every checkout
   * runtime does `JSON.parse` on each entry and silently drops what it cannot read, so a
   * bare uid vanishes from the page with no error for the agent or the seller.
   */
  private async serializeOrderBumps(productIds?: string[]): Promise<string[] | undefined> {
    if (!productIds?.length) return undefined;
    const products = await Promise.all(productIds.map((id) => this.resolveProduct(id)));
    return products.map((product, index) => JSON.stringify({
      uid: product.uid ?? productIds[index],
      id: product.uid ?? productIds[index],
      title: product.title,
      description: product.description ?? '',
      price: product.price,
      imageUrl: product.imageUrl ?? '',
      currency: product.currency ?? 'BRL',
    }));
  }

  async update(id: string, request: UpdateCheckoutRequest): Promise<Checkout> {
    const { timer, salesNotifications, ...input } = request;
    refuseNestedPaymentMethods(input.checkout);
    const current = await this.checkoutPort.getById(id);
    if (!current.productId) {
      throw new ValidationError(
        `Checkout ${id} has no product pointer, and every update has to resend one. `
        + 'Recreate the offer with create_checkout against the product it sells.',
      );
    }
    if (input.paymentMethods) refuseDroppedMethods(id, current.paymentMethods, input.paymentMethods);
    const orderBumps = await this.serializeOrderBumps(input.orderBumps);
    const pageSetup = withPageFeatures(input.checkout, { timer, salesNotifications });
    // The write keeps every key absent from the body as stored (field mask), so only the
    // checkout's identity (title, owner, product, price, re-sent unchanged) and what the caller
    // changed travel. Nothing else is echoed from the read: it does not necessarily carry every
    // stored value, so echoing `paymentMethods`, `checkout` or `orderBumps` could rewrite them
    // with less than what is stored (stored order bumps, for one, would lose their per-bump
    // original price and button text). Each of those travels only when the caller sends it.
    const payload: UpdateCheckoutPayload = {
      title: current.title,
      uuidOwner: current.uuidOwner,
      productId: current.productId,
      price: current.price,
      ...input,
      ...(pageSetup !== undefined ? { checkout: mergePageSetup(current.checkout, pageSetup) } : {}),
      ...(input.price !== undefined ? { price: parsePriceToCents(input.price) } : {}),
      ...(orderBumps ? { orderBumps } : {}),
    };
    return this.checkoutPort.update(id, payload);
  }

  async delete(id: string): Promise<void> {
    // Ownership comes from the authenticated token; the route never reads the body, so
    // there is nothing to look up first.
    return this.checkoutPort.delete(id);
  }

  async manageTags(id: string, tags: CheckoutTag[]): Promise<{ tags: CheckoutTag[] }> {
    return this.checkoutPort.manageTags(id, tags);
  }
}

/**
 * The `checkout` object of an update: the stored page setup with the caller's keys merged in.
 *
 * Merged, not replaced: the API stores `checkout` as a whole, and it holds the whole page setup
 * (timer, coupon, shipping…), so a caller that sets one key (the timer, say) would otherwise wipe the
 * rest of it.
 *
 * `paymentMethods` is the one key never carried over from the read. When the body has no top-level
 * `paymentMethods`, the API takes the methods from `checkout.paymentMethods` and rewrites them from
 * it, and the read does not return every stored value of the methods: echoing that copy would rewrite
 * them with less than what is stored, on an edit that only touched the timer. A caller cannot send it
 * either (`refuseNestedPaymentMethods`).
 *
 * `shipping` is carried over whole, on purpose: the read returns it complete, and a partial one would
 * be stored as the whole shipping setup.
 */
function mergePageSetup(
  stored: Record<string, unknown> | undefined,
  edit: Record<string, unknown>,
): Record<string, unknown> {
  const { paymentMethods: _readCopy, ...setup } = stored ?? {};
  return mergeDeep(setup, edit);
}

/** The page features whose stored flag is the inverse of what an agent says: `disabled`, never `enabled`. */
const INVERTED_FLAG_KEYS = ['timer', 'salesNotifications'] as const;

/** `{ enabled }` becomes `{ disabled: !enabled }`; a `disabled` that contradicts `enabled` is refused. */
function toStoredFlag(key: string, source: Record<string, unknown>): Record<string, unknown> {
  const { enabled, ...rest } = source;
  if (enabled === undefined) return rest;
  if (typeof enabled !== 'boolean') {
    throw new ValidationError(`${key}.enabled must be true or false, got ${JSON.stringify(enabled)}.`);
  }
  if (rest.disabled !== undefined && rest.disabled === enabled) {
    throw new ValidationError(`${key} has enabled: ${enabled} and disabled: ${String(rest.disabled)}, which contradict each other. Send only \`enabled\`.`);
  }
  return { ...rest, disabled: !enabled };
}

/**
 * Puts the timer and the sales pop-ups into the page setup the way they are stored. Both are kept as a
 * `disabled` flag, and nothing reads `enabled`: a body with `timer.enabled: false` used to store a stray
 * key and leave the timer visible. The typed `timer` / `salesNotifications` and a raw one inside the
 * free-form `checkout` are both mapped (the typed one wins on a clash).
 *
 * Returns undefined when there is nothing to write, so an update without a `checkout` stays that way.
 */
function withPageFeatures(
  setup: Record<string, unknown> | undefined,
  features: CheckoutPageFeaturesInput,
  options: { salesNotificationsOffByDefault?: boolean } = {},
): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = { ...(setup ?? {}) };
  for (const key of INVERTED_FLAG_KEYS) {
    const raw = result[key];
    const typed = features[key] as Record<string, unknown> | undefined;
    if (typed === undefined && !(raw && typeof raw === 'object' && !Array.isArray(raw))) continue;
    result[key] = {
      ...toStoredFlag(`checkout.${key}`, (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>),
      ...(typed ? toStoredFlag(key, typed) : {}),
    };
  }
  if (options.salesNotificationsOffByDefault && !('salesNotifications' in result)) {
    result.salesNotifications = { disabled: true };
  }
  return setup === undefined && Object.keys(result).length === 0 ? undefined : result;
}

/**
 * `checkout.paymentMethods` is a second way into the stored methods, and it takes the own-gateway list
 * (`{ token, type }`) the wallet-only top-level `paymentMethods` refuses. Methods go only through the top level.
 */
function refuseNestedPaymentMethods(setup: Record<string, unknown> | undefined): void {
  if (setup && 'paymentMethods' in setup) {
    throw new ValidationError(
      'Payment methods are not set inside `checkout`: use the top-level `paymentMethods`. PIX and card take a wallet '
      + '`{ routeId }` (from list_checkout_wallets); bank slip takes `{ token, type }` and PayPal `{ token, type: \'paypal\' }`, '
      + 'the credential id from list_tokens.',
    );
  }
}

const METHODS = ['pix', 'credit_card', 'bank_slip', 'paypal'] as const;

/**
 * The body's `paymentMethods` replaces the stored methods as a whole: a stored method absent from it is
 * deleted, and the API still answers success (with no method left, it also unpublishes the checkout). So
 * every method the read shows has to come back, as a value or as an explicit `null`. This also covers
 * an edit of `installments` alone, which travels in the same map.
 *
 * Guards what the read shows. A method the API hides from the read (it cannot charge today) is the
 * API's to guard: the PATCH refuses a body that leaves it out with `HIDDEN_PAYMENT_METHOD_OMITTED`
 * (ggCheckout/saas-checkout#2183), and its message reaches the user as is.
 */
function refuseDroppedMethods(
  id: string,
  stored: CheckoutPaymentMethods | undefined,
  sent: CheckoutPaymentMethods,
): void {
  const dropped = METHODS.filter((m) => stored?.[m] && !(m in sent));
  if (dropped.length === 0) return;
  throw new ValidationError(
    `paymentMethods replaces the stored methods as a whole, and checkout ${id} has ${dropped.join(', ')} `
    + 'that this body leaves out, which would delete them. Resend every stored method (pix and credit_card '
    + 'with their wallet {routeId} from get_checkout, bank_slip and paypal with their credential id from '
    + 'list_tokens), or send null for the ones to turn off.',
  );
}
