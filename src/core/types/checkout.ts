export interface Checkout {
  [key: string]: unknown;
  uid?: string;
  id: string;
  title: string;
  uuidOwnwer: string;
  sellerName?: string | null;
  socialCard?: any;
  fields?: any[];
  bannerUrl?: string;
  url?: string;
  published?: boolean;
  orderBumps?: any[];
  checkout?: any;
  metricToken?: string | null;
  emailProviderToken?: string;
  paymentMethods?: any;
  price: number;
  image?: string;
  createBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCheckoutInput {
  title: string;
  id: string;
  uuidOwnwer?: string;
  sellerName?: string | null;
  socialCard?: any;
  fields?: any[];
  bannerUrl?: string;
  url?: string;
  published?: boolean;
  orderBumps?: any[];
  checkout: any;
  metricToken?: string | null;
  emailProviderToken?: string;
  paymentMethods: any;
  price: number;
  image?: string;
}

export interface UpdateCheckoutInput {
  title?: string;
  sellerName?: string | null;
  socialCard?: any;
  fields?: any[];
  bannerUrl?: string;
  url?: string;
  published?: boolean;
  orderBumps?: any[];
  checkout?: any;
  metricToken?: string | null;
  emailProviderToken?: string;
  paymentMethods?: any;
  price?: number;
  image?: string;
}
