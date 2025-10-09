export interface ProductDelivery {
  uid?: string;
  title: string;
  url: string;
  imageUrl?: string;
  description: string;
  discount: string;
  price: number;
  createdAt?: string;
  updatedAt?: string;
  uuidOwner?: string;
}

export interface CreateProductInput {
  title: string;
  url: string;
  imageUrl?: string;
  description: string;
  discount: string;
  price: number | string;
}

export interface UpdateProductInput {
  title?: string;
  url?: string;
  imageUrl?: string;
  description?: string;
  discount?: string;
  price?: number | string;
}

export interface Payment {
  [key: string]: unknown;
  id: string;
  businessId: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  value: number;
  productId: string;
  titleOffer: string;
  status: string;
  createdAt: string;
  utmify?: any;
  emailProvider?: string | null;
  orderBumps?: any[];
  delivery?: any;
  trackProps?: any;
  discountsApplied?: any[];
  finalValueInCents?: number;
  couponsCodesApplied?: string[];
}

export interface PaymentsListResponse {
  [key: string]: unknown;
  payments: Payment[];
}

export interface PaymentsPaginatedResponse {
  [key: string]: unknown;
  payments: Payment[];
  total: number;
  lastCreatedAt: string | null;
}
