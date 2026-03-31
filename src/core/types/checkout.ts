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
  uid?: string;
  id: string;
  title: string;
  uuidOwnwer: string;
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
  id: string;
  uuidOwnwer?: string;
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
