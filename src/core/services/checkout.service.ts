import type { AuthPort } from '../ports/auth.port.js';
import type { CheckoutPort } from '../ports/checkout.port.js';
import type { ProductPort } from '../ports/product.port.js';
import type {
  Checkout,
  CheckoutTag,
  CreateCheckoutInput,
  UpdateCheckoutInput,
  UpdateCheckoutPayload,
} from '../types/checkout.js';
import type { Product } from '../types/product.js';
import { AppError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { parsePriceToCents } from '../../shared/validation.js';

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

  async create(input: Omit<CreateCheckoutInput, 'uuidOwner'>): Promise<Checkout> {
    // Independent lookups: the product resolution needs only the input, the business id
    // needs nothing from it.
    const [, businessId, orderBumps] = await Promise.all([
      this.resolveProduct(input.productId),
      this.authPort.getMyBusinessId(),
      this.serializeOrderBumps(input.orderBumps),
    ]);
    return this.checkoutPort.create({
      ...input,
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
      if (status !== 403 && status !== 404) throw error;
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

  async update(id: string, input: UpdateCheckoutInput): Promise<Checkout> {
    const current = await this.checkoutPort.getById(id);
    if (!current.productId) {
      throw new ValidationError(
        `Checkout ${id} has no product pointer, and every update has to resend one. `
        + 'Recreate the offer with create_checkout against the product it sells.',
      );
    }
    const orderBumps = await this.serializeOrderBumps(input.orderBumps);
    const fullPayload: UpdateCheckoutPayload = {
      // The API destructures with defaults instead of merging, so anything omitted here is
      // reset — a one-field edit would wipe url, fields, sellerName and currency.
      title: current.title,
      uuidOwner: current.uuidOwner,
      productId: current.productId,
      price: current.price,
      paymentMethods: current.paymentMethods,
      checkout: current.checkout,
      orderBumps: current.orderBumps || [],
      published: current.published ?? true,
      createBy: current.createBy || 'system',
      url: current.url,
      fields: current.fields,
      sellerName: current.sellerName,
      currency: current.currency,
      internationalizeCheckout: current.internationalizeCheckout,
      ...input,
      ...(input.price !== undefined ? { price: parsePriceToCents(input.price) } : {}),
      ...(orderBumps ? { orderBumps } : {}),
    };
    return this.checkoutPort.update(id, fullPayload);
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
