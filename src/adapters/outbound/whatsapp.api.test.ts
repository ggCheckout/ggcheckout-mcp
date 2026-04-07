import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppApiAdapter } from './whatsapp.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('WhatsAppApiAdapter', () => {
  let adapter: WhatsAppApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new WhatsAppApiAdapter(http);
  });

  it('createSession POSTs sessionName', async () => {
    vi.mocked(http.post).mockResolvedValue({ uid: 's1', sessionId: 'sid' });
    await adapter.createSession('My Session');
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/sessions', { sessionName: 'My Session' });
  });

  it('getPairingCode POSTs phoneNumber to session endpoint', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, code: 'ABCD-EFGH' });
    const result = await adapter.getPairingCode('sid-1', '5511999999999');
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/sessions/sid-1/pairing-code', { phoneNumber: '5511999999999' });
    expect(result.code).toBe('ABCD-EFGH');
  });

  it('listTemplates filters by sessionId when provided', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.listTemplates('sid-1');
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/templates?sessionId=sid-1');
  });

  it('listTemplates calls without filter when no sessionId', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.listTemplates();
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/templates');
  });

  it('toggleTemplate POSTs to /templates/{id}/toggle', async () => {
    vi.mocked(http.post).mockResolvedValue({ uid: 't1', isEnabled: false });
    await adapter.toggleTemplate('t1');
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/templates/t1/toggle');
  });

  it('updateTemplate uses PATCH (not PUT)', async () => {
    vi.mocked(http.patch).mockResolvedValue({ uid: 't1' });
    await adapter.updateTemplate('t1', { messageText: 'updated' });
    expect(http.patch).toHaveBeenCalledWith('/api/whatsapp/templates/t1', { messageText: 'updated' });
  });

  it('resendDelivery POSTs to /deliveries/{paymentId}/resend', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, message: 'Resent' });
    await adapter.resendDelivery('pay-1');
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/deliveries/pay-1/resend');
  });

  it('sendMessage POSTs to /api/whatsapp/send', async () => {
    vi.mocked(http.post).mockResolvedValue({ message: 'Sent' });
    await adapter.sendMessage({ sessionId: 's1', phone: '5511999', message: 'Hello' });
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/send', { sessionId: 's1', phone: '5511999', message: 'Hello' });
  });
});
