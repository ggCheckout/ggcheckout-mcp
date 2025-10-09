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
