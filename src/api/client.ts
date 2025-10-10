import axios, { AxiosInstance, AxiosError } from 'axios';
import * as logger from '../utils/logger.js';
import { ProductDelivery, PaymentsListResponse, PaymentsPaginatedResponse, Payment, Checkout, CreateCheckoutInput, UpdateCheckoutInput, Webhook, CreateWebhookInput, UpdateWebhookInput, WebhooksListResponse } from '../tools/types.js';

export class ApiClient {
  private client: AxiosInstance;

  constructor(apiUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${apiKey}`;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status;
        const message = (error.response?.data as any)?.error || error.message;
        logger.error('HTTP', `Request failed: ${status} - ${message}`);
        throw new Error(`API Error (${status}): ${message}`);
      }
    );
  }

  async listProducts(): Promise<ProductDelivery[]> {
    try {
      logger.info('HTTP', 'Listing products');
      const response = await this.client.get<ProductDelivery[]>('/api/product-delivery');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getProduct(id: string): Promise<ProductDelivery> {
    try {
      logger.info('HTTP', `Getting product: ${id}`);
      const response = await this.client.get<ProductDelivery>(`/api/product-delivery/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async createProduct(payload: any): Promise<ProductDelivery> {
    try {
      logger.info('HTTP', 'Creating product', { title: payload.title });
      const response = await this.client.post<any>('/api/product-delivery', payload);
      return { ...payload, uid: response.data.documentId };
    } catch (error) {
      throw error;
    }
  }

  async updateProduct(id: string, payload: any): Promise<ProductDelivery> {
    try {
      logger.info('HTTP', `Updating product: ${id}`);
      const response = await this.client.patch<any>(`/api/product-delivery/${id}`, {
        ...payload,
        id,
      });
      return { ...payload, uid: id };
    } catch (error) {
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      logger.info('HTTP', `Deleting product: ${id}`);
      await this.client.delete(`/api/product-delivery/${id}`);
    } catch (error) {
      throw error;
    }
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    try {
      logger.info('HTTP', `Listing payments for business: ${businessId}`);
      const response = await this.client.get<PaymentsListResponse>(`/api/get-clients/business/${businessId}/payments`);
      return response.data.payments;
    } catch (error) {
      throw error;
    }
  }

  async getPaymentsPaginated(
    businessId: string,
    options?: {
      pageSize?: number;
      dateFrom?: string;
      dateTo?: string;
      lastCreatedAt?: string;
      status?: string;
      searchTerm?: string;
      countOnly?: boolean;
    }
  ): Promise<PaymentsPaginatedResponse | { total: number }> {
    try {
      const params = new URLSearchParams();
      if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
      if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
      if (options?.dateTo) params.append('dateTo', options.dateTo);
      if (options?.lastCreatedAt) params.append('lastCreatedAt', options.lastCreatedAt);
      if (options?.status && options.status !== 'all') {
        params.append('status', options.status);
      }
      if (options?.searchTerm) params.append('searchTerm', options.searchTerm);
      if (options?.countOnly) params.append('countOnly', 'true');

      const queryString = params.toString();
      const url = `/api/get-clients/business/${businessId}/payments/paginated${queryString ? `?${queryString}` : ''}`;
      
      logger.info('HTTP', `Getting paginated payments for business: ${businessId}`, { options });
      const response = await this.client.get<PaymentsPaginatedResponse | { total: number }>(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getPayment(businessId: string, paymentId: string): Promise<Payment> {
    try {
      logger.info('HTTP', `Getting payment: ${paymentId} for business: ${businessId}`);
      const response = await this.client.get<PaymentsPaginatedResponse>(
        `/api/get-clients/business/${businessId}/payments/paginated?pageSize=1000`
      );
      
      if (!response.data.payments || response.data.payments.length === 0) {
        throw new Error('No payments found for this business');
      }
      
      
      const payment = response.data.payments.find(p => p.id === paymentId);
      
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }
      
      return payment;
    } catch (error) {
      throw error;
    }
  }

  async getMyBusinessId(): Promise<string> {
    try {
      logger.info('HTTP', 'Getting authenticated user business ID');
      const response = await this.client.get<{ businessId: string; uid: string; email?: string; authMethod: string }>('/api/me');
      return response.data.businessId;
    } catch (error) {
      throw error;
    }
  }

  async listCheckouts(uuidOwnwer: string): Promise<Checkout[]> {
    try {
      logger.info('HTTP', `Listing checkouts for owner: ${uuidOwnwer}`);
      const response = await this.client.get<Checkout[]>(`/api/checkouts?uuidOwnwer=${uuidOwnwer}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getCheckout(id: string): Promise<Checkout> {
    try {
      logger.info('HTTP', `Getting checkout: ${id}`);
      const response = await this.client.get<Checkout>(`/api/checkouts/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async createCheckout(payload: CreateCheckoutInput): Promise<Checkout> {
    try {
      logger.info('HTTP', 'Creating checkout', { title: payload.title });
      const response = await this.client.post<any>('/api/checkouts', payload);
      // Backend now returns { success: true, message: string, checkout: {...} }
      return response.data.checkout;
    } catch (error) {
      throw error;
    }
  }

  async updateCheckout(id: string, payload: UpdateCheckoutInput): Promise<Checkout> {
    try {
      logger.info('HTTP', `Updating checkout: ${id}`);
      // First, get current checkout to merge with updates
      const currentCheckout = await this.getCheckout(id);
      // Backend requires all mandatory fields even for updates
      const fullPayload = {
        title: currentCheckout.title,
        uuidOwnwer: currentCheckout.uuidOwnwer,
        id: currentCheckout.id,
        price: currentCheckout.price,
        paymentMethods: currentCheckout.paymentMethods,
        checkout: currentCheckout.checkout,
        orderBumps: currentCheckout.orderBumps || [],
        published: currentCheckout.published ?? true,
        createBy: currentCheckout.createBy || 'system',
        ...payload, // Override with user updates
      };
      const response = await this.client.patch<any>(`/api/checkouts/${id}`, fullPayload);
      return response.data.productData || { ...fullPayload, uid: id };
    } catch (error) {
      throw error;
    }
  }

  async deleteCheckout(id: string): Promise<void> {
    try {
      logger.info('HTTP', `Deleting checkout: ${id}`);
      // Get checkout first to get uuidOwnwer
      const checkout = await this.getCheckout(id);
      // Backend DELETE requires uuidOwnwer in body
      await this.client.delete(`/api/checkouts/${id}`, {
        data: { uuidOwnwer: checkout.uuidOwnwer }
      });
    } catch (error) {
      throw error;
    }
  }

  async listWebhooks(): Promise<Webhook[]> {
    try {
      logger.info('HTTP', 'Listing webhooks');
      const response = await this.client.get<WebhooksListResponse>('/api/clients-webhook');
      return response.data.webhooks;
    } catch (error) {
      throw error;
    }
  }

  async getWebhook(id: string): Promise<Webhook> {
    try {
      logger.info('HTTP', `Getting webhook: ${id}`);
      // Backend doesn't have a GET by ID endpoint, so we list and filter
      const webhooks = await this.listWebhooks();
      const webhook = webhooks.find(w => w.id === id);
      if (!webhook) {
        throw new Error(`Webhook ${id} not found`);
      }
      return webhook;
    } catch (error) {
      throw error;
    }
  }

  async createWebhook(payload: CreateWebhookInput): Promise<Webhook> {
    try {
      logger.info('HTTP', 'Creating webhook', { name: payload.name });
      // Add businessId if not provided
      if (!payload.businessId) {
        payload.businessId = await this.getMyBusinessId();
      }
      const response = await this.client.post<Webhook>('/api/clients-webhook', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateWebhook(id: string, payload: UpdateWebhookInput): Promise<Webhook> {
    try {
      logger.info('HTTP', `Updating webhook: ${id}`);
      const response = await this.client.put<Webhook>(`/api/clients-webhook?id=${id}`, payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteWebhook(id: string): Promise<void> {
    try {
      logger.info('HTTP', `Deleting webhook: ${id}`);
      await this.client.delete(`/api/clients-webhook?id=${id}`);
    } catch (error) {
      throw error;
    }
  }
}
