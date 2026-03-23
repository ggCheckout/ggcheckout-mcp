import axios, { AxiosInstance, AxiosError } from 'axios';
import * as logger from '../../shared/logger.js';
import { ApiError, AuthenticationError, RateLimitError } from '../../shared/errors.js';

export class HttpClient {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
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

        if (status === 401) throw new AuthenticationError(message);
        if (status === 429) throw new RateLimitError(message);
        throw new ApiError(status || 500, message);
      },
    );
  }

  async get<T>(url: string, params?: Record<string, string>): Promise<T> {
    logger.info('HTTP', `GET ${url}`);
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `POST ${url}`);
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `PATCH ${url}`);
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `PUT ${url}`);
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string, data?: any): Promise<T> {
    logger.info('HTTP', `DELETE ${url}`);
    const response = await this.client.delete<T>(url, { data });
    return response.data;
  }
}
