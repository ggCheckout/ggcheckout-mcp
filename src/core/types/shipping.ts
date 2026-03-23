export interface CalculatedShippingOption {
  id: string;
  name: string;
  company: string;
  price: number;
  deliveryDays: string;
  deliveryRange: { min: number; max: number };
}

export interface CalculateShippingInput {
  checkoutId?: string;
  tokenId?: string;
  businessId?: string;
  toPostalCode: string;
  selectedOrderBumps?: string[];
  products?: Array<{ weight: number; width: number; height: number; length: number; quantity?: number }>;
  package?: { weight: number; width: number; height: number; length: number };
}

export interface ShippingCartInput {
  paymentId: string;
  businessId: string;
  serviceId: number;
  productName: string;
  productValue: number;
  packageDimensions: { weight: number; width: number; height: number; length: number };
}
