export interface CheckoutTag {
  name: string;
  color: string;
}

export interface CheckoutPaymentMethodConfig {
  token: string;
  type: string;
}

/** PIX or card through one of the seller's wallets (`list_checkout_wallets`). */
export interface CheckoutWalletMethod {
  routeId: string;
}

export interface CheckoutPaymentMethods {
  credit_card?: CheckoutWalletMethod | null;
  pix?: CheckoutWalletMethod | null;
  bank_slip?: CheckoutPaymentMethodConfig | null;
  /** Per checkout, outside the wallet: the PayPal credential id from `list_tokens`. */
  paypal?: { token: string; type: 'paypal' } | null;
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
  /**
   * Ids of the metric credentials (`list_tokens`) the checkout fires. The API stores one id or a
   * list of them (one per platform), so a read can answer any of the three.
   */
  metricToken?: string | string[] | null;
  emailProviderToken?: string;
  paymentMethods?: CheckoutPaymentMethods;
  price: number;
  image?: string;
  createBy?: string;
  /** The id in the public checkout link (`/checkout/{publicId}`); the link uses `uid` when absent. */
  publicId?: string;
  /** Which checkout layout the page renders (the same field `FunnelCheckoutSummary` reports). */
  checkoutModel?: string;
  /** Hostname of the verified custom domain the checkout opens on; null or absent on the app origin. */
  customDomain?: string | null;
  /** The absolute public link the API computes (the dashboard's own link); absent on an API that predates it. */
  publicUrl?: string;
  tags?: CheckoutTag[];
  createdAt?: string;
  updatedAt?: string;
}

/** The layouts a checkout renders; v6 is the button/embed checkout, which is refused with shipping. */
export type CheckoutModel = 'v2' | 'v3' | 'v4' | 'v5' | 'v6';

/**
 * Microsoft Clarity for the checkout page; `null` removes it. Top level, not inside `checkout`.
 */
export interface CheckoutAnalytics {
  clarity: { projectId: string } | null;
}

/**
 * The countdown bar. The stored flag is inverted (`checkout.timer.disabled`); `enabled` is what callers
 * say and the service maps it to `disabled = !enabled`.
 */
export interface CheckoutTimerInput {
  enabled?: boolean;
  /** Countdown start, `HH:MM:SS`. */
  time?: string;
  text?: string;
  bgColor?: string;
  barColor?: string;
  textColor?: string;
  enableSticky?: boolean;
}

/** The "someone just bought" pop-ups; stored inverted (`checkout.salesNotifications.disabled`) like the timer. */
export interface CheckoutSalesNotificationsInput {
  enabled?: boolean;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  defaultMessages?: string[];
  customMessages?: Array<string | { text: string; enabled?: boolean }>;
  minMessages?: string | number;
  interval?: string | number;
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  iconColor?: string;
  iconBgColor?: string;
}

/** `timer` and `salesNotifications` are mapped into the stored `checkout` object by the service. */
export interface CheckoutPageFeaturesInput {
  timer?: CheckoutTimerInput;
  salesNotifications?: CheckoutSalesNotificationsInput;
}

/** What a caller sends to create a checkout; the service turns it into a {@link CreateCheckoutInput}. */
export type CreateCheckoutRequest = Omit<CreateCheckoutInput, 'uuidOwner'> & CheckoutPageFeaturesInput;

/** What a caller sends to update a checkout; the service turns it into an {@link UpdateCheckoutPayload}. */
export type UpdateCheckoutRequest = UpdateCheckoutInput & CheckoutPageFeaturesInput;

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
  /** Id of a metric credential from `list_tokens`, or a list of them (one per platform). */
  metricToken?: string | string[] | null;
  emailProviderToken?: string;
  paymentMethods: CheckoutPaymentMethods;
  price: number;
  image?: string;
  /** The layout; the API's default is `v2`. */
  checkoutModel?: CheckoutModel;
  /** Id of a verified custom domain (`list_custom_domains`) the checkout opens on; `null` unbinds it. */
  customDomainId?: string | null;
  analytics?: CheckoutAnalytics;
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
  metricToken?: string | string[] | null;
  emailProviderToken?: string;
  paymentMethods?: CheckoutPaymentMethods;
  price?: number;
  image?: string;
  checkoutModel?: CheckoutModel;
  customDomainId?: string | null;
  analytics?: CheckoutAnalytics;
}

/**
 * The body of `PATCH /api/checkouts/{id}`.
 *
 * The write keeps every key absent from the body as stored (field mask). Send the checkout's
 * identity (`title`, `uuidOwner`, `productId` — `id` on the wire — and `price`) plus what changed,
 * and never echo the document read back: the read does not necessarily carry every stored value
 * (`paymentMethods`, `checkout` and `orderBumps` above all).
 */
export interface UpdateCheckoutPayload {
  title: string;
  uuidOwner: string;
  productId: string;
  price: number;
  paymentMethods?: CheckoutPaymentMethods;
  checkout?: Record<string, unknown>;
  orderBumps?: string[];
  published?: boolean;
  createBy?: string;
  url?: string;
  fields?: CheckoutFields;
  sellerName?: string | null;
  currency?: string;
  internationalizeCheckout?: boolean;
  bannerUrl?: string;
  image?: string;
  socialCard?: CheckoutSocialCard[];
  metricToken?: string | string[] | null;
  emailProviderToken?: string;
  checkoutModel?: CheckoutModel;
  customDomainId?: string | null;
  analytics?: CheckoutAnalytics;
}
