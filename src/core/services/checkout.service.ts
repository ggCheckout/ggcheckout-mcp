import type { AuthPort } from '../ports/auth.port.js';
import type { CheckoutPort } from '../ports/checkout.port.js';
import type { ProductPort } from '../ports/product.port.js';
import type { Checkout, CheckoutTag, CreateCheckoutInput, UpdateCheckoutInput } from '../types/checkout.js';
import { AuthenticationError, RateLimitError, ValidationError } from '../../shared/errors.js';

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
    await this.assertProductExists(input.productId);
    const businessId = await this.authPort.getMyBusinessId();
    return this.checkoutPort.create({ ...input, uuidOwner: businessId });
  }

  /**
   * A checkout whose owning product does not exist is accepted by the API but
   * becomes an orphan the seller cannot open in the dashboard. Fail here, while
   * the agent can still act on it.
   *
   * The product route answers 403 (not 404) for a missing document, so the raw
   * error reads as an API key problem. Rewrite it — except for the two statuses
   * that really are about credentials or throttling.
   */
  private async assertProductExists(productId: string): Promise<void> {
    try {
      await this.productPort.getById(productId);
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof RateLimitError) throw error;
      throw new ValidationError(
        `Product ${productId} not found or not yours. `
        + 'Call create_product first and use the productId it returns, '
        + 'or pick a uid from list_products.',
      );
    }
  }

  async update(id: string, input: UpdateCheckoutInput): Promise<Checkout> {
    const current = await this.checkoutPort.getById(id);
    const fullPayload = {
      title: current.title,
      uuidOwner: current.uuidOwner,
      id: current.id,
      price: current.price,
      paymentMethods: current.paymentMethods,
      checkout: current.checkout,
      orderBumps: current.orderBumps || [],
      published: current.published ?? true,
      createBy: current.createBy || 'system',
      ...input,
    };
    return this.checkoutPort.update(id, fullPayload);
  }

  async delete(id: string): Promise<void> {
    const checkout = await this.checkoutPort.getById(id);
    return this.checkoutPort.delete(id, checkout.uuidOwner);
  }

  async manageTags(id: string, tags: CheckoutTag[]): Promise<{ tags: CheckoutTag[] }> {
    return this.checkoutPort.manageTags(id, tags);
  }
}
