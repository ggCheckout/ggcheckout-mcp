export interface CheckoutTag {
  name: string;
  color: string;
}

export interface CheckoutPaymentMethodConfig {
  token: string;
  type: string;
}

export interface CheckoutPixGatewayEntry {
  tokenId: string;
  type: string;
}

export interface CheckoutPixGatewaysConfig {
  gateways: CheckoutPixGatewayEntry[];
}

export interface CheckoutPaymentMethods {
  credit_card?: CheckoutPaymentMethodConfig | null;
  pix?: CheckoutPaymentMethodConfig | CheckoutPixGatewaysConfig | null;
  bank_slip?: CheckoutPaymentMethodConfig | null;
  installments?: number;
  showInstallmentsOnPrice?: boolean;
  primaryPaymentMethod?: 'pix' | 'credit_card';
}

export interface CheckoutSocialCard {
  text: string;
  socialName: string;
  rating?: number;
  photoUrl?: string;
  isVerified?: boolean;
  images?: Array<{ id: string; url: string }>;
}

export interface CheckoutFields {
  haveEmail?: boolean;
  havePhone?: boolean;
  haveName?: boolean;
  haveCpf?: boolean;
}

export interface Checkout {
  [key: string]: unknown;
  /**
   * The checkout's own Firestore document id, present on every response. This is
   * what `get_checkout`, `update_checkout` and `delete_checkout` take.
   */
  uid?: string;
  /**
   * Uid of the `productDelivery` this checkout sells. The API names this field
   * `id`, which collides with the checkout's own identifier; the adapter renames
   * it in both directions so the domain has one name for it. Absent on a checkout
   * whose product pointer was never set — the API omits the key entirely.
   */
  productId?: string;
  title: string;
  uuidOwner: string;
  sellerName?: string | null;
  socialCard?: CheckoutSocialCard[];
  fields?: CheckoutFields;
  bannerUrl?: string;
  url?: string;
  currency?: string;
  internationalizeCheckout?: boolean;
  published?: boolean;
  orderBumps?: string[];
  checkout?: Record<string, unknown>;
  metricToken?: string | null;
  emailProviderToken?: string;
  paymentMethods?: CheckoutPaymentMethods;
  price: number;
  image?: string;
  createBy?: string;
  tags?: CheckoutTag[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCheckoutInput {
  title: string;
  /** Uid of the product that owns this checkout. Serialized as `id` in the API body. */
  productId: string;
  uuidOwner?: string;
  sellerName?: string | null;
  socialCard?: CheckoutSocialCard[];
  fields?: CheckoutFields;
  bannerUrl?: string;
  url?: string;
  published?: boolean;
  /** Uids of the products offered as bumps. Serialized into JSON snapshots by the service. */
  orderBumps?: string[];
  checkout: Record<string, unknown>;
  metricToken?: string | null;
  emailProviderToken?: string;
  paymentMethods: CheckoutPaymentMethods;
  price: number;
  image?: string;
}

export interface UpdateCheckoutInput {
  title?: string;
  sellerName?: string | null;
  socialCard?: CheckoutSocialCard[];
  fields?: CheckoutFields;
  bannerUrl?: string;
  url?: string;
  published?: boolean;
  orderBumps?: string[];
  checkout?: Record<string, unknown>;
  metricToken?: string | null;
  emailProviderToken?: string;
  paymentMethods?: CheckoutPaymentMethods;
  price?: number;
  image?: string;
}

/**
 * The full body `PATCH /api/checkouts/{id}` expects.
 *
 * The API destructures with defaults rather than merging, so every key listed here
 * is RESET when it is absent from the body — `url` to `''`, `fields` to the default
 * form shape, `sellerName` to `null`, `currency` to `'BRL'`. A partial PATCH is a
 * silent wipe, which is why the service rebuilds the whole document.
 */
export interface UpdateCheckoutPayload {
  title: string;
  uuidOwner: string;
  productId: string;
  price: number;
  paymentMethods?: CheckoutPaymentMethods;
  checkout?: Record<string, unknown>;
  orderBumps: string[];
  published: boolean;
  createBy: string;
  url?: string;
  fields?: CheckoutFields;
  sellerName?: string | null;
  currency?: string;
  internationalizeCheckout?: boolean;
}
