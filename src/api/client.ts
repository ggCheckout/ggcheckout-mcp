import axios, { AxiosInstance, AxiosError } from 'axios';
import * as logger from '../utils/logger.js';
import { ProductDelivery } from '../tools/types.js';

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
}
