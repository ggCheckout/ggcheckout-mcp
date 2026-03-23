export interface Webhook {
  [key: string]: unknown;
  id?: string;
  businessId: string;
  name: string;
  url: string;
  secret?: string;
  productsId?: string[];
  events: string[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateWebhookInput {
  businessId?: string;
  name: string;
  url: string;
  secret?: string;
  productsId?: string[];
  events: string[];
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  secret?: string;
  productsId?: string[];
  events?: string[];
}
