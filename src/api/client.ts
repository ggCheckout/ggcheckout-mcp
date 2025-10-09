import axios, { AxiosInstance, AxiosError } from 'axios';
import * as logger from '../utils/logger.js';
import { ProductDelivery, PaymentsListResponse, PaymentsPaginatedResponse, Payment } from '../tools/types.js';

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
      // Fetch all payments and filter client-side to avoid Firestore index requirements
      // The searchTerm parameter uses Filter.or() which requires multiple composite indexes
      const response = await this.client.get<PaymentsListResponse>(
        `/api/get-clients/business/${businessId}/payments`
      );
      
      if (!response.data.payments || response.data.payments.length === 0) {
        throw new Error('No payments found for this business');
      }
      
      // Filter client-side by paymentId
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
}
