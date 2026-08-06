import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { HttpClient } from './http-client.js';
import { AuthenticationError, RateLimitError, ApiError } from '../../shared/errors.js';

vi.mock('axios');
vi.mock('../../shared/logger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

describe('HttpClient', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    const interceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    };
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors,
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
  });

  it('creates axios instance with correct baseURL and timeout', () => {
    new HttpClient('https://api.test.com', 'test-key');
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.test.com',
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('registers request interceptor for Bearer auth', () => {
    new HttpClient('https://api.test.com', 'my-api-key');
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledOnce();

    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
    const config = { headers: {} as any };
    const result = requestInterceptor(config);
    expect(result.headers.Authorization).toBe('Bearer my-api-key');
  });

  it('registers response error interceptor that maps 401 to AuthenticationError', () => {
    new HttpClient('https://api.test.com', 'key');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 401, data: { error: 'Invalid token' } },
      message: 'Request failed',
    };

    expect(() => errorHandler(axiosError)).toThrow(AuthenticationError);
  });

  it('maps 429 to RateLimitError', () => {
    new HttpClient('https://api.test.com', 'key');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 429, data: { error: 'Too many requests' } },
      message: 'Request failed',
    };

    expect(() => errorHandler(axiosError)).toThrow(RateLimitError);
  });

  it('includes Retry-After seconds in RateLimitError message when header is present', () => {
    expect.assertions(2);
    new HttpClient('https://api.test.com', 'key');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: {
        status: 429,
        data: { error: 'Too many requests' },
        headers: { 'retry-after': '45' },
      },
      message: 'Request failed',
    };

    try {
      errorHandler(axiosError);
    } catch (e: any) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect(e.message).toContain('Retry after 45 seconds');
    }
  });

  it('omits retry seconds from RateLimitError message when header is absent', () => {
    expect.assertions(2);
    new HttpClient('https://api.test.com', 'key');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 429, data: { error: 'Too many requests' }, headers: {} },
      message: 'Request failed',
    };

    try {
      errorHandler(axiosError);
    } catch (e: any) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect(e.message).not.toContain('Retry after');
    }
  });

  it('maps other errors to ApiError', () => {
    new HttpClient('https://api.test.com', 'key');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 500, data: { error: 'Internal error' } },
      message: 'Request failed',
    };

    expect(() => errorHandler(axiosError)).toThrow(ApiError);
  });

  it('uses safe fallback message when API returns no error string', () => {
    new HttpClient('https://api.test.com', 'key');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 503, data: null },
      message: 'connect ECONNREFUSED 127.0.0.1:3000 - internal stack trace here',
    };

    try {
      errorHandler(axiosError);
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.message).not.toContain('ECONNREFUSED');
      expect(e.message).toContain('503');
    }
  });

  it('reads message field as fallback when error field is missing', () => {
    new HttpClient('https://api.test.com', 'key');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 400, data: { message: 'Invalid input' } },
      message: 'Request failed',
    };

    try {
      errorHandler(axiosError);
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.message).toContain('Invalid input');
    }
  });

  it('get() calls axios.get and returns data', async () => {
    const client = new HttpClient('https://api.test.com', 'key');
    mockAxiosInstance.get.mockResolvedValue({ data: { products: [] } });

    const result = await client.get('/api/products');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/products', { params: undefined });
    expect(result).toEqual({ products: [] });
  });

  it('post() calls axios.post and returns data', async () => {
    const client = new HttpClient('https://api.test.com', 'key');
    mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

    const result = await client.post('/api/products', { title: 'Test' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/products', { title: 'Test' });
    expect(result).toEqual({ success: true });
  });

  it('delete() passes data in config', async () => {
    const client = new HttpClient('https://api.test.com', 'key');
    mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });

    await client.delete('/api/checkouts/123', { uuidOwner: 'owner-1' });
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/checkouts/123', { data: { uuidOwner: 'owner-1' } });
  });
});
