import type { CheckoutPort } from '../../core/ports/checkout.port.js';
import type {
  Checkout,
  CheckoutTag,
  CreateCheckoutInput,
  UpdateCheckoutPayload,
} from '../../core/types/checkout.js';
import type { HttpClient } from './http-client.js';

/**
 * The API calls the owning product's uid `id`, which collides with the checkout's own
 * identifier. The domain calls it `productId`; both translations live here so the API
 * name never leaks past the adapter.
 */
function toApiBody<T extends { productId: string }>(payload: T): Record<string, unknown> {
  const { productId, ...rest } = payload;
  return { ...rest, id: productId };
}

function fromApiCheckout(raw: Checkout): Checkout {
  const { id, ...rest } = raw as Checkout & { id?: string };
  return id === undefined ? (rest as Checkout) : ({ ...rest, productId: id } as Checkout);
}

export class CheckoutApiAdapter implements CheckoutPort {
  constructor(private readonly http: HttpClient) {}

  async list(uuidOwner: string): Promise<Checkout[]> {
    const query = new URLSearchParams({ uuidOwner });
    const checkouts = await this.http.get<Checkout[]>(`/api/checkouts?${query}`);
    return checkouts.map(fromApiCheckout);
  }

  async getById(id: string): Promise<Checkout> {
    return fromApiCheckout(await this.http.get<Checkout>(`/api/checkouts/${encodeURIComponent(id)}`));
  }

  async create(payload: CreateCheckoutInput): Promise<Checkout> {
    const data = await this.http.post<{ checkout: Checkout }>('/api/checkouts', toApiBody(payload));
    return fromApiCheckout(data.checkout);
  }

  async update(id: string, payload: UpdateCheckoutPayload): Promise<Checkout> {
    const data = await this.http.patch<{ productData?: Checkout }>(
      `/api/checkouts/${encodeURIComponent(id)}`,
      toApiBody(payload),
    );
    return data.productData ? fromApiCheckout(data.productData) : { ...payload, uid: id };
  }

  async delete(id: string): Promise<void> {
    // The route takes ownership from the authenticated token and never reads the body.
    await this.http.delete(`/api/checkouts/${encodeURIComponent(id)}`);
  }

  async manageTags(id: string, tags: CheckoutTag[]): Promise<{ tags: CheckoutTag[] }> {
    return this.http.patch<{ message: string; tags: CheckoutTag[] }>(
      `/api/checkouts/${encodeURIComponent(id)}/tags`,
      { tags },
    );
  }
}
