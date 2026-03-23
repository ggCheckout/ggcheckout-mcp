export type Currency = 'BRL' | 'USD';
export type UpsellMediaType = 'image' | 'video';
export type UpsellChainBehavior = 'continue' | 'stop_on_decline';
export type DownsellChainBehavior = 'continue' | 'stop';
export type UpsellStatus = 'active' | 'inactive';

export interface UpsellCustomImageConfig {
  url?: string;
  alt?: string;
}

export interface UpsellVideoConfig {
  provider?: string;
  url?: string;
  sourceType?: string;
  aspectRatio?: string;
}

export interface UpsellVideosSectionConfig {
  enabled?: boolean;
  videos?: Array<{ url: string; title?: string }>;
}

export interface WhatsAppDeliveryConfig {
  enabled: boolean;
  sessionId?: string;
  sendOnPending: boolean;
  sendOnCompleted: boolean;
  customMessage?: string;
}

export interface CustomerSupportConfig {
  enabled: boolean;
  supportEmailId?: string;
}

export interface DeliverableConfig {
  enabled: boolean;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  filePath: string;
  uploadedAt: string;
}

export interface Product {
  uid?: string;
  title: string;
  sellerName?: string;
  description: string;
  price: number;
  currency?: Currency;
  url?: string;
  imageUrl?: string;
  discount: number;
  deliverable?: DeliverableConfig;
  whatsappConfig?: WhatsAppDeliveryConfig;
  customSupport?: CustomerSupportConfig;
  membersAreaEnabled?: boolean;
  membersAreaConfig?: { autoEnroll: boolean; sendWelcomeEmail: boolean };
  isPhysicalProduct?: boolean;
  stockEnabled?: boolean;
  unlimitedStock?: boolean;
  stockQuantity?: number;
  upsells?: any[];
  tags?: ProductTag[];
  uuidOwner?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductTag {
  name: string;
  color: string;
}

export interface CreateProductInput {
  title: string;
  description: string;
  price: number | string;
  currency?: Currency;
  url?: string;
  imageUrl?: string;
  discount?: number;
  whatsappUrl?: string;
  deliveryMethod?: 'url' | 'whatsapp' | 'both';
  deliverableType?: 'url' | 'file' | 'text';
  deliverableUrl?: string;
  skipDeliveryEmail?: boolean;
  isPhysicalProduct?: boolean;
  stockEnabled?: boolean;
  unlimitedStock?: boolean;
  stockQuantity?: number;
  membersAreaEnabled?: boolean;
  customSupport?: CustomerSupportConfig;
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  price?: number | string;
  currency?: Currency;
  url?: string;
  imageUrl?: string;
  discount?: number;
  whatsappUrl?: string;
  deliveryMethod?: 'url' | 'whatsapp' | 'both';
  deliverableType?: 'url' | 'file' | 'text';
  deliverableUrl?: string;
  skipDeliveryEmail?: boolean;
  isPhysicalProduct?: boolean;
  stockEnabled?: boolean;
  unlimitedStock?: boolean;
  stockQuantity?: number;
  membersAreaEnabled?: boolean;
  customSupport?: CustomerSupportConfig;
}

export interface UploadDeliverableInput {
  fileUrl: string;
  fileName: string;
  fileType?: string;
}

export interface UpsellPaymentMethodConfig {
  token: string;
  type: string;
}

export interface Upsell {
  uid: string;
  id: string;
  order?: number;
  chainBehavior?: UpsellChainBehavior;
  upsellProductId: string;
  title: string;
  description?: string;
  price?: number;
  originalPrice?: number;
  discount?: string;
  imageUrl?: string;
  mediaType?: UpsellMediaType;
  customImage?: UpsellCustomImageConfig;
  video?: UpsellVideoConfig;
  videosSection?: UpsellVideosSectionConfig;
  paymentMethods?: {
    credit_card?: UpsellPaymentMethodConfig | null;
    pix?: UpsellPaymentMethodConfig | null;
    bank_slip?: UpsellPaymentMethodConfig | null;
    crypto?: UpsellPaymentMethodConfig | null;
    installments?: number;
  } | null;
  deliveryMethod?: 'url' | 'file' | 'whatsapp';
  deliverableType?: 'url' | 'file';
  deliverableUrl?: string;
  deliverableFile?: any;
  deliverableFileId?: string;
  url?: string;
  whatsappEnabled?: boolean;
  whatsappMessage?: string;
  membersAreaEnabled?: boolean;
  membersAreaConfig?: { autoEnroll: boolean; sendWelcomeEmail: boolean };
  status: UpsellStatus;
  timerEnabled?: boolean;
  timerMinutes?: number;
  downsell?: DownsellConfig;
  uuidOwner: string;
  createdAt: string;
  updatedAt: string;
}

export interface DownsellConfig {
  enabled: boolean;
  downsellProductId: string;
  title: string;
  description?: string;
  headline?: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  timerEnabled?: boolean;
  timerMinutes?: number;
  mediaType?: UpsellMediaType;
  customImage?: UpsellCustomImageConfig;
  video?: UpsellVideoConfig;
  videosSection?: UpsellVideosSectionConfig;
}

export interface CreateUpsellInput {
  upsellProductId: string;
  title: string;
  description?: string;
  price?: number;
  originalPrice?: number;
  discount?: string;
  imageUrl?: string;
  mediaType?: UpsellMediaType;
  customImage?: UpsellCustomImageConfig;
  video?: UpsellVideoConfig;
  paymentMethods?: Upsell['paymentMethods'];
  deliveryMethod?: 'url' | 'file' | 'whatsapp';
  timerEnabled?: boolean;
  timerMinutes?: number;
  downsell?: DownsellConfig;
  status?: UpsellStatus;
}

export interface DownsellSequenceItem {
  uid: string;
  order: number;
  status: UpsellStatus;
  chainBehavior: DownsellChainBehavior;
  downsellProductId: string;
  title: string;
  headline?: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  timerEnabled?: boolean;
  timerMinutes?: number;
  mediaType?: UpsellMediaType;
  customImage?: UpsellCustomImageConfig;
  videosSection?: UpsellVideosSectionConfig;
  uuidOwner: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDownsellInput {
  downsellProductId: string;
  title: string;
  description?: string;
  headline?: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  timerEnabled?: boolean;
  timerMinutes?: number;
  mediaType?: UpsellMediaType;
  customImage?: UpsellCustomImageConfig;
  status?: UpsellStatus;
  chainBehavior?: DownsellChainBehavior;
}
