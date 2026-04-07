import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushApiAdapter } from './push.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('PushApiAdapter', () => {
  let adapter: PushApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new PushApiAdapter(http);
  });

  it('listDevices passes userId as query param', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, devices: [], count: 0 });
    await adapter.listDevices('uid-1');
    expect(http.get).toHaveBeenCalledWith('/api/push-tokens/devices?userId=uid-1');
  });

  it('registerToken POSTs token and optional deviceId', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true });
    await adapter.registerToken('fcm-token-123', 'device-1');
    expect(http.post).toHaveBeenCalledWith('/api/push-tokens', { token: 'fcm-token-123', deviceId: 'device-1' });
  });

  it('removeDevice DELETEs with deviceId and userId in body', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.removeDevice('device-1', 'uid-1');
    expect(http.delete).toHaveBeenCalledWith('/api/push-tokens/devices', { deviceId: 'device-1', userId: 'uid-1' });
  });
});
