export type DiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
export type DiscountPaymentMethod = 'pix' | 'credit_card' | 'bank_slip';

export interface Discount {
  id: string;
  uuidOwner: string;
  createdBy: string;
  name: string;
  description: string;
  couponCode?: string;
  isActive: boolean;
  type: DiscountType;
  value: number;
  buyQuantity?: number;
  getQuantity?: number;
  startDate?: string;
  endDate?: string;
  hasExpiration: boolean;
  usageLimit?: number;
  usageCount: number;
  limitPerCustomer?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  minimumItems?: number;
  applicableProducts: string[];
  excludedProducts: string[];
  newCustomersOnly: boolean;
  allowedRegions?: string[];
  allowedPaymentMethods?: DiscountPaymentMethod[];
  isAutomatic: boolean;
  priority: number;
  isStackable: boolean;
  totalSavings: number;
  totalOrders: number;
  conversionRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscountInput {
  name: string;
  description?: string;
  couponCode?: string;
  type: DiscountType;
  value: number;
  buyQuantity?: number;
  getQuantity?: number;
  hasExpiration?: boolean;
  startDate?: string;
  endDate?: string;
  usageLimit?: number;
  limitPerCustomer?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  minimumItems?: number;
  applicableProducts?: string[];
  excludedProducts?: string[];
  newCustomersOnly?: boolean;
  allowedRegions?: string[];
  allowedPaymentMethods?: DiscountPaymentMethod[];
  isAutomatic?: boolean;
  priority?: number;
  isStackable?: boolean;
}

export interface UpdateDiscountInput extends Partial<CreateDiscountInput> {
  isActive?: boolean;
}

export interface ValidateDiscountInput {
  couponCode?: string;
  couponCodes?: string[];
  checkoutId: string;
  customerEmail?: string;
  customerCpf?: string;
  orderValue: number;
  paymentMethod?: DiscountPaymentMethod;
  items: Array<{ productId: string; quantity: number; price: number }>;
}

export interface ValidateDiscountResponse {
  isValid: boolean;
  discount?: Discount;
  discountValue: number;
  finalValue: number;
  message: string;
}
