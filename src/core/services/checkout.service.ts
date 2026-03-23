import type { AuthPort } from '../ports/auth.port.js';
import type { CheckoutPort } from '../ports/checkout.port.js';
import type { Checkout, CreateCheckoutInput, UpdateCheckoutInput } from '../types/checkout.js';

export class CheckoutService {
  constructor(
    private readonly checkoutPort: CheckoutPort,
    private readonly authPort: AuthPort,
  ) {}

  async list(): Promise<Checkout[]> {
    const businessId = await this.authPort.getMyBusinessId();
    return this.checkoutPort.list(businessId);
  }

  async getById(id: string): Promise<Checkout> {
    return this.checkoutPort.getById(id);
  }

  async create(input: Omit<CreateCheckoutInput, 'uuidOwnwer'>): Promise<Checkout> {
    const businessId = await this.authPort.getMyBusinessId();
    return this.checkoutPort.create({ ...input, uuidOwnwer: businessId });
  }

  async update(id: string, input: UpdateCheckoutInput): Promise<Checkout> {
    const current = await this.checkoutPort.getById(id);
    const fullPayload = {
      title: current.title,
      uuidOwnwer: current.uuidOwnwer,
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
    return this.checkoutPort.delete(id, checkout.uuidOwnwer);
  }

  async manageTags(id: string, tags: string[]): Promise<void> {
    return this.checkoutPort.manageTags(id, tags);
  }
}
