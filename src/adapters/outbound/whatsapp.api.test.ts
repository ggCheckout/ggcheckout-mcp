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

  it('lists chips and keeps the QR and the Meta secrets out', async () => {
    vi.mocked(http.get).mockResolvedValue([
      { uid: 'n1', provider: 'waha', qrCode: 'data:image/png;base64,AA', phoneNumber: '5511999887766', status: 'authenticated' },
      { uid: 'n2', provider: 'meta', meta: { wabaId: 'w', accessTokenEnc: 'secret' }, status: 'authenticated' },
    ]);
    const [qr, meta] = await adapter.listNumbers();
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/numbers');
    expect(qr.qrCode).toBeUndefined();
    expect(qr.phoneNumber).toContain('****');
    expect(JSON.stringify(meta)).not.toContain('secret');
  });

  it('getPairingCode POSTs the phone to the chip', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, code: 'ABCD-EFGH' });
    const result = await adapter.getPairingCode('n 1', '5511999999999');
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/numbers/n%201/pairing-code', { phoneNumber: '5511999999999' });
    expect(result.code).toBe('ABCD-EFGH');
  });

  it('setNumberActive PATCHes only isActive', async () => {
    vi.mocked(http.patch).mockResolvedValue({ uid: 'n1', isActive: false });
    await adapter.setNumberActive('n1', false);
    expect(http.patch).toHaveBeenCalledWith('/api/whatsapp/numbers/n1', { isActive: false });
  });

  it('restartNumber POSTs to the chip restart', async () => {
    vi.mocked(http.post).mockResolvedValue({ message: 'Chip reiniciado', numberId: 'n1' });
    await adapter.restartNumber('n1');
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/numbers/n1/restart');
  });

  it('checkNumbersHealth GETs the health check and drops the connection ids', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, data: {
      summary: { total: 1, connected: 0, disconnected: 1, divergent: 1, synced: 1 },
      numbers: [{ numberId: 'n1', displayName: 'Vendas', sessionId: 'waha-s1', workerId: 'w1', firebaseStatus: 'authenticated', firebaseIsActive: true, realStatus: 'disconnected', diverged: true }],
    } });
    const health = await adapter.checkNumbersHealth();
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/numbers/health-check');
    expect(health.summary.divergent).toBe(1);
    expect(health.numbers[0]).not.toHaveProperty('sessionId');
    expect(health.numbers[0]).not.toHaveProperty('workerId');
  });

  it('reads sessions from the groups routes', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.listSessions();
    await adapter.getSession('g1');
    expect(vi.mocked(http.get).mock.calls.map((c) => c[0])).toEqual(['/api/whatsapp/groups', '/api/whatsapp/groups/g1']);
  });

  it('manages a session chips and products', async () => {
    vi.mocked(http.post).mockResolvedValue({});
    vi.mocked(http.delete).mockResolvedValue({});
    vi.mocked(http.patch).mockResolvedValue({});
    await adapter.addSessionNumber('g1', 'n2');
    await adapter.removeSessionNumber('g1', 'n2');
    await adapter.setSessionProducts('g1', ['p1', 'p2']);
    await adapter.updateSession('g1', { primaryNumberId: 'n2', fallbackNumberIds: ['n1'] });
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/groups/g1/numbers', { numberId: 'n2' });
    expect(http.delete).toHaveBeenCalledWith('/api/whatsapp/groups/g1/numbers/n2');
    expect(http.patch).toHaveBeenCalledWith('/api/whatsapp/groups/g1/products', { assignedProducts: ['p1', 'p2'] });
    expect(http.patch).toHaveBeenCalledWith('/api/whatsapp/groups/g1', { primaryNumberId: 'n2', fallbackNumberIds: ['n1'] });
  });

  it('createTemplate sends the linked sessions as sessionIds', async () => {
    vi.mocked(http.post).mockResolvedValue({ uid: 't1' });
    await adapter.createTemplate({ sessionIds: ['g1'], eventType: 'upsell_paid', messageText: 'Oi', sendType: 'text_only' });
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/templates', { sessionIds: ['g1'], eventType: 'upsell_paid', messageText: 'Oi', sendType: 'text_only' });
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
});
