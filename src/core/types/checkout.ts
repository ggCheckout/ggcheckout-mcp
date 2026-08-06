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
  havePhone?: boolean;
  haveName?: boolean;
  haveCpf?: boolean;
}

export interface Checkout {
  [key: string]: unknown;
  /**
   * The checkout's own Firestore document id. This is what `get_checkout`,
   * `update_checkout` and `delete_checkout` take. Only the collection routes
   * project it, so it is undefined on by-id responses.
   */
  uid?: string;
  /** Foreign key to the owning `productDelivery` uid — NOT a slug, NOT this checkout's id. */
  id: string;
  title: string;
  uuidOwner: string;
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
