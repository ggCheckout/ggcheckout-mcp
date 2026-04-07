import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomDomainApiAdapter } from './custom-domain.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('CustomDomainApiAdapter', () => {
  let adapter: CustomDomainApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new CustomDomainApiAdapter(http);
  });

  it('add POSTs domain string', async () => {
    vi.mocked(http.post).mockResolvedValue({ id: 'd1', domain: 'checkout.example.com', verified: false });
    const result = await adapter.add('checkout.example.com');
    expect(http.post).toHaveBeenCalledWith('/api/custom-domains', { domain: 'checkout.example.com' });
    expect(result.verified).toBe(false);
  });

  it('verify POSTs to /verify endpoint', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, verified: true });
    const result = await adapter.verify('d1');
    expect(http.post).toHaveBeenCalledWith('/api/custom-domains/d1/verify');
    expect(result.verified).toBe(true);
  });

  it('delete calls correct URL', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.delete('d1');
    expect(http.delete).toHaveBeenCalledWith('/api/custom-domains/d1');
  });
});
