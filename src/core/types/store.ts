export interface StoreTheme {
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor?: string;
  logo: string;
  favicon: string;
}

export interface StoreSettings {
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export interface StorePaymentMethodConfig {
  enabled: boolean;
  gateways: string[];
  token?: string;
}

export interface StorePaymentMethods {
  pix?: StorePaymentMethodConfig;
  credit_card?: StorePaymentMethodConfig;
}

export interface StoreAnalytics {
  enabled: boolean;
  providers?: {
    google_analytics?: { enabled: boolean; measurementId?: string };
    facebook_pixel?: { enabled: boolean; pixelId?: string };
    tiktok_pixel?: { enabled: boolean; pixelId?: string };
    utmify?: { enabled: boolean; token?: string };
  };
}

export interface StoreSocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  discord?: string;
  telegram?: string;
  whatsapp?: string;
}

export interface StoreSupportButton {
  enabled: boolean;
  text?: string;
  url?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export interface StoreOrderBump {
  enabled: boolean;
  showFakeDiscount?: boolean;
  fakeDiscountPercent?: number;
}

export interface Store {
  storeId: string;
  userId: string;
  template: string;
  theme: StoreTheme;
  settings: StoreSettings;
  paymentMethods: StorePaymentMethods;
  analytics?: StoreAnalytics;
  socialLinks?: StoreSocialLinks;
  supportButton?: StoreSupportButton;
  orderBump?: StoreOrderBump;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreConfig {
  paymentMethods: StorePaymentMethods;
  theme: StoreTheme;
  settings: StoreSettings;
}

export interface StoreProduct {
  uid: string;
  title: string;
  description: string;
  price: number;
  discount: number;
  imageUrl: string;
  createdAt?: any;
  featured?: boolean;
  stockEnabled?: boolean;
  unlimitedStock?: boolean;
  stockQuantity?: number;
  inStock?: boolean;
}

export interface StoreProductDetail extends StoreProduct {
  deliverableType?: string;
  hasVariants?: boolean;
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    stock: number;
    available: boolean;
  }>;
  available?: boolean;
  updatedAt?: string | null;
}

export interface StoreCategory {
  id: string;
  name: string;
  description: string;
  image: string;
  imagePosition?: string;
  productIds: string[];
  order: number;
}

export interface StoreOrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  variantId?: string;
  variantTitle?: string;
  customFields?: Record<string, any>;
  stockLines?: string[];
  productUrl?: string;
  downloadUrl?: string;
}

export interface StoreOrderCustomer {
  name: string;
  email: string;
  phone: string | null;
  cpf?: string | null;
}

export interface StoreOrderPricing {
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
}

export interface StoreOrderCoupon {
  code: string;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountAmount: number;
}

export interface StoreOrder {
  orderId: string;
  storeId: string;
  items: StoreOrderItem[];
  customer: StoreOrderCustomer;
  pricing: StoreOrderPricing;
  coupon?: StoreOrderCoupon;
  paymentMethod: string;
  paymentId?: string;
  status?: string;
  utmParams?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  completedAt?: string;
}

export type CustomFieldType = 'text' | 'number' | 'roblox' | 'email' | 'phone';

export interface CustomFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface CustomField {
  id: string;
  storeId: string;
  userId: string;
  type: CustomFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  validation: CustomFieldValidation;
  applyToAllProducts?: boolean;
  productIds?: string[];
  categoryIds?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreFeedback {
  feedbackId: string;
  orderId: string;
  storeId: string;
  userId: string;
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  avatarUrl?: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}

export interface FeedbacksPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface FeedbacksStats {
  average: number;
  total: number;
  distribution: Record<string, number>;
}

export interface CouponValidationResult {
  isValid: boolean;
  discount?: { value: number };
  finalValue?: number;
  message?: string;
}
