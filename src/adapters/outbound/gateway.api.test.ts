import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayApiAdapter } from './gateway.api.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('GatewayApiAdapter', () => {
  let adapter: GatewayApiAdapter;
  let http: ReturnType<typeof createMockHttp>;
  let authPort: AuthPort;

  beforeEach(() => {
    http = createMockHttp();
    authPort = { getMyBusinessId: vi.fn().mockResolvedValue('user-1') };
    adapter = new GatewayApiAdapter(http, authPort);
  });

  it('listTokens GETs /api/user/tokens', async () => {
    vi.mocked(http.get).mockResolvedValue({ tokens: [], count: 0 });
    await adapter.listTokens();
    expect(http.get).toHaveBeenCalledWith('/api/user/tokens');
  });

  it('listTokens passes type filter', async () => {
    vi.mocked(http.get).mockResolvedValue({ tokens: [], count: 0 });
    await adapter.listTokens({ type: 'mercadopago' });
    expect(http.get).toHaveBeenCalledWith('/api/user/tokens?type=mercadopago');
  });

  it('insertToken POSTs to /api/insert-token with userId from authPort', async () => {
    vi.mocked(http.post).mockResolvedValue({});
    await adapter.insertToken({ token: 'tk-1', type: 'stripe', title: 'My Stripe', status: 'active', target: 'stripe' });
    expect(authPort.getMyBusinessId).toHaveBeenCalled();
    expect(http.post).toHaveBeenCalledWith('/api/insert-token', expect.objectContaining({
      userId: 'user-1',
      token: 'tk-1',
      type: 'stripe',
    }));
  });

  it('deleteToken uses POST (not DELETE) to /api/delete-token', async () => {
    vi.mocked(http.post).mockResolvedValue({});
    await adapter.deleteToken('tk-1', 'stripe', 'token-val', 'stripe');
    expect(http.post).toHaveBeenCalledWith('/api/delete-token', expect.objectContaining({
      userId: 'user-1',
      tokenId: 'tk-1',
      target: 'stripe',
    }));
  });

  it('getFallbackStats GETs /api/user/gateway-stats', async () => {
    const mockStats = {
      stats: {
        amplopay: { success: 100, errors: 5, total: 105, reliability: 95.2 },
      },
      cachedAt: 1711900000000,
    };
    vi.mocked(http.get).mockResolvedValue(mockStats);
    const result = await adapter.getFallbackStats();
    expect(http.get).toHaveBeenCalledWith('/api/user/gateway-stats');
    expect(result).toEqual(mockStats);
  });
});
