export interface Product {
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

export interface DeliverableConfig {
  enabled: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  filePath?: string;
}

export interface UploadDeliverableInput {
  fileUrl: string;
  fileName: string;
  fileType?: string;
}

export interface Upsell {
  uid?: string;
  id?: string;
  order?: number;
  chainBehavior?: string;
  upsellProductId?: string;
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl?: string;
  mediaType?: string;
  customImage?: string;
  video?: string;
  videosSection?: any;
  paymentMethods?: Record<string, boolean>;
  deliveryMethod?: string;
  deliverableUrl?: string;
  whatsappEnabled?: boolean;
  whatsappMessage?: string;
  membersAreaEnabled?: boolean;
  membersAreaConfig?: any;
  status?: string;
  timerEnabled?: boolean;
  timerMinutes?: number;
  downsell?: DownsellConfig;
}

export interface DownsellConfig {
  enabled?: boolean;
  downsellProductId?: string;
  title?: string;
  description?: string;
  headline?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  timerEnabled?: boolean;
  timerMinutes?: number;
  mediaType?: string;
  customImage?: string;
  video?: string;
  videosSection?: any;
}

export interface CreateUpsellInput {
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl?: string;
  mediaType?: string;
  video?: string;
  paymentMethods?: Record<string, boolean>;
  deliveryMethod?: string;
  timerEnabled?: boolean;
  timerMinutes?: number;
  downsell?: DownsellConfig;
}

export interface CreateDownsellInput {
  title: string;
  description?: string;
  headline?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  timerEnabled?: boolean;
  timerMinutes?: number;
  mediaType?: string;
  customImage?: string;
  video?: string;
}

export interface DownsellSequenceItem {
  uid?: string;
  id?: string;
  order?: number;
  title: string;
  description?: string;
  headline?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  timerEnabled?: boolean;
  timerMinutes?: number;
  mediaType?: string;
  customImage?: string;
  video?: string;
  videosSection?: any;
}
