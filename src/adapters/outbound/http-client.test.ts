import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { HttpClient } from './http-client.js';
import { getVersionWarning, resetUpdateNotice } from '../../shared/update-notice.js';
import {
  AuthenticationError,
  RateLimitError,
  ApiError,
  TemporarilyUnavailableError,
} from '../../shared/errors.js';

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
    new HttpClient('https://api.test.com', 'test-key', '9.8.7');
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.test.com',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ggcheckout-mcp/9.8.7',
        'X-GG-MCP-Version': '9.8.7',
      },
    });
  });

  it('identifies the package version on every call with a User-Agent', () => {
    new HttpClient('https://api.test.com', 'k', '0.4.0');
    const created = vi.mocked(axios.create).mock.calls.at(-1)![0] as any;
    expect(created.headers['User-Agent']).toBe('ggcheckout-mcp/0.4.0');
  });

  it('registers request interceptor for Bearer auth', () => {
    new HttpClient('https://api.test.com', 'my-api-key', '1.0.0');
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledOnce();

    const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
    const config = { headers: {} as any };
    const result = requestInterceptor(config);
    expect(result.headers.Authorization).toBe('Bearer my-api-key');
  });

  it('registers response error interceptor that maps 401 to AuthenticationError', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 401, data: { error: 'Invalid token' } },
      message: 'Request failed',
    };

    expect(() => errorHandler(axiosError)).toThrow(AuthenticationError);
  });

  it('maps 429 to RateLimitError', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 429, data: { error: 'Too many requests' } },
      message: 'Request failed',
    };

    expect(() => errorHandler(axiosError)).toThrow(RateLimitError);
  });

  it('includes Retry-After seconds in RateLimitError message when header is present', () => {
    expect.assertions(2);
    new HttpClient('https://api.test.com', 'key', '1.0.0');
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
    new HttpClient('https://api.test.com', 'key', '1.0.0');
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
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 500, data: { error: 'Internal error' } },
      message: 'Request failed',
    };

    expect(() => errorHandler(axiosError)).toThrow(ApiError);
  });

  it('uses safe fallback message when API returns no error string', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 500, data: null },
      message: 'connect ECONNREFUSED 127.0.0.1:3000 - internal stack trace here',
    };

    try {
      errorHandler(axiosError);
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.message).not.toContain('ECONNREFUSED');
      expect(e.message).toContain('500');
    }
  });

  // 503 is the rate limiter failing closed, not a rejection on the merits, and the wait comes in
  // the body as `retry_after` — the header is dropped when the answer is forwarded.
  it('turns 503 into a retryable error and puts retry_after from the body in the message', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: {
        status: 503,
        data: { error: 'service_unavailable', reason: 'rate_limit_backend_degraded', retry_after: 5 },
        headers: {},
      },
      message: 'Request failed',
    };

    try {
      errorHandler(axiosError);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(TemporarilyUnavailableError);
      expect(e.message).toContain('Retry after 5 seconds');
      expect(e.message).toContain('nothing was changed');
    }
  });

  // A 502 on a write is ambiguous: the service behind the API may have applied it before the
  // answer was lost, so a blind retry can repeat it (a second PIX charge, for one).
  it('turns 502 into an error that says to check a write before repeating it', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: { status: 502, data: { error: 'Erro ao comunicar com o serviço' }, headers: {} },
      message: 'Request failed',
    };

    try {
      errorHandler(axiosError);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(TemporarilyUnavailableError);
      expect(e.message).toContain('may or may not have been applied');
      expect(e.message).toContain('check its result before repeating it');
    }
  });

  it('treats a 504 like a 502 and only suggests waiting once the write was checked', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    try {
      errorHandler({ response: { status: 504, data: { error: 'Gateway Timeout', retry_after: 30 }, headers: {} }, message: 'x' });
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(TemporarilyUnavailableError);
      expect(e.statusCode).toBe(504);
      expect(e.message).toContain('check its result before repeating it');
      expect(e.message).toContain('If it did not, wait 30 seconds');
      expect(e.message).not.toContain('Retry after');
    }
  });

  // A bare "Request failed with status 409" told the caller nothing; the refusal explains itself
  // in `code`, beside the message.
  it('surfaces the code beside the error message', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
    const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

    const axiosError = {
      response: {
        status: 409,
        data: { error: 'Seller migrado', code: 'seller_migrated_to_payments' },
        headers: {},
      },
      message: 'Request failed',
    };

    try {
      errorHandler(axiosError);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.message).toContain('Seller migrado');
      expect(e.message).toContain('seller_migrated_to_payments');
    }
  });

  it('reads message field as fallback when error field is missing', () => {
    new HttpClient('https://api.test.com', 'key', '1.0.0');
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
    const client = new HttpClient('https://api.test.com', 'key', '1.0.0');
    mockAxiosInstance.get.mockResolvedValue({ data: { products: [] } });

    const result = await client.get('/api/products');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/products', { params: undefined });
    expect(result).toEqual({ products: [] });
  });

  it('post() calls axios.post and returns data', async () => {
    const client = new HttpClient('https://api.test.com', 'key', '1.0.0');
    mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

    const result = await client.post('/api/products', { title: 'Test' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/products', { title: 'Test' });
    expect(result).toEqual({ success: true });
  });

  it('delete() passes data in config', async () => {
    const client = new HttpClient('https://api.test.com', 'key', '1.0.0');
    mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });

    await client.delete('/api/checkouts/123', { uuidOwner: 'owner-1' });
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/checkouts/123', { data: { uuidOwner: 'owner-1' } });
  });

  describe('version headers', () => {
    afterEach(() => resetUpdateNotice());

    it('reads X-GG-MCP-Latest / X-GG-MCP-Update off a success', () => {
      new HttpClient('https://api.test.com', 'k', '0.4.0');
      const ok = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      const response = { data: {}, headers: { 'x-gg-mcp-latest': '0.5.0', 'x-gg-mcp-update': 'npx -y ggcheckout-mcp@latest' } };
      expect(ok(response)).toBe(response);
      expect(getVersionWarning()).toContain('(0.4.0 → 0.5.0)');
    });

    it('reads them off an error response too', () => {
      new HttpClient('https://api.test.com', 'k', '0.4.0');
      const fail = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      expect(() => fail({
        response: { status: 409, data: { error: 'x' }, headers: { 'x-gg-mcp-latest': '0.5.0', 'x-gg-mcp-update': 'upd' } },
      })).toThrow(ApiError);
      expect(getVersionWarning()).toContain('`upd`');
    });
  });
});
