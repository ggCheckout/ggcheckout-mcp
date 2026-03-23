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

export interface PaginationOptions {
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  lastCreatedAt?: string;
  status?: string;
  searchTerm?: string;
  countOnly?: boolean;
}

export interface FulfillmentData {
  [key: string]: unknown;
  status?: string;
  separatedItems?: any[];
  statusHistory?: any[];
  tracking?: {
    code?: string;
    url?: string;
    carrier?: string;
  };
  packageDimensions?: {
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
  };
}

export interface PaymentStatusCheck {
  [key: string]: unknown;
  status: string;
  gatewayStatus?: string;
}
