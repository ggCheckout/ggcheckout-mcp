import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppAgentApiAdapter } from './whatsapp-agent.api.js';
import type { HttpClient } from './http-client.js';
import {
  ApiError, AuthenticationError, FeatureUnavailableError, RateLimitError, WhatsAppAgentRefusalError,
} from '../../shared/errors.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

const KEY = '553199998888';
const BASE = '/api/whatsapp/agent/conversations';

describe('WhatsAppAgentApiAdapter', () => {
  let adapter: WhatsAppAgentApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new WhatsAppAgentApiAdapter(http);
    vi.mocked(http.get).mockResolvedValue({ items: [] });
    vi.mocked(http.post).mockResolvedValue({ ok: true });
  });

  it('lists pending conversations and reads a thread with the query as strings', async () => {
    await adapter.listPending({ limit: 10 });
    expect(http.get).toHaveBeenCalledWith(BASE, { limit: '10' });
    await adapter.listMessages('lid:abc@lid', { limit: 30, before: '12-3' });
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/lid%3Aabc%40lid/messages`, { limit: '30', before: '12-3' });
  });

  it('replies and holds with the bodies of the contract', async () => {
    await adapter.sendReply(KEY, { text: 'Oi', clientMessageId: 'c1' });
    expect(http.post).toHaveBeenCalledWith(`${BASE}/${KEY}/reply`, { text: 'Oi', clientMessageId: 'c1' });
    await adapter.hold(KEY, 'mandou áudio');
    expect(http.post).toHaveBeenLastCalledWith(`${BASE}/${KEY}/hold`, { reason: 'mandou áudio' });
  });

  it('finds purchases by phone, or by the e-mail the contact gave', async () => {
    await adapter.findPurchases(KEY);
    expect(http.get).toHaveBeenCalledWith(`${BASE}/${KEY}/purchases`, undefined);
    await adapter.findPurchases(KEY, 'ana@example.com');
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/${KEY}/purchases`, { email: 'ana@example.com' });
  });

  it('acts on one purchase of the conversation', async () => {
    await adapter.resendDelivery(KEY, 'p1');
    await adapter.createRecoveryLink(KEY, 'p1');
    await adapter.listOffers(KEY, 'p1');
    await adapter.createOfferLink(KEY, 'p1', 'ups-1');
    expect(vi.mocked(http.post).mock.calls).toEqual([
      [`${BASE}/${KEY}/purchases/p1/resend`],
      [`${BASE}/${KEY}/purchases/p1/recovery-link`],
      [`${BASE}/${KEY}/purchases/p1/offer-link`, { offerId: 'ups-1' }],
    ]);
    expect(http.get).toHaveBeenCalledWith(`${BASE}/${KEY}/purchases/p1/offers`);
  });

  it.each([
    ['AGENT_HELD', new ApiError(409, 'Conversa assumida (AGENT_HELD)')],
    ['AGENT_CONTACT_EXITED', new ApiError(409, 'Contato pediu para sair (AGENT_CONTACT_EXITED; detail)')],
    ['AGENT_REPLY_CAP', new RateLimitError('Teto atingido (AGENT_REPLY_CAP). Retry after 3600 seconds.')],
    ['AGENT_ALREADY_OFFERED', new ApiError(409, 'Oferta já feita (AGENT_ALREADY_OFFERED)')],
    ['AGENT_UPSELL_NOT_OFFERED', new ApiError(409, 'Downsell antes do upsell (AGENT_UPSELL_NOT_OFFERED)')],
    ['AGENT_KEY_REFUSED', new AuthenticationError('Chave inválida')],
  ])('turns %s into a refusal that tells the model to stop', async (code, error) => {
    vi.mocked(http.post).mockRejectedValue(error);
    const failure = await adapter.sendReply(KEY, { text: 'Oi', clientMessageId: 'c1' }).catch((e) => e);
    expect(failure).toBeInstanceOf(WhatsAppAgentRefusalError);
    expect(failure.code).toBe(code);
    expect(failure.message).toContain(`(${code})`);
  });

  it('keeps an ordinary rate limit and other API errors as they are', async () => {
    const limited = new RateLimitError('Muitas requisições. Retry after 30 seconds.');
    vi.mocked(http.get).mockRejectedValue(limited);
    await expect(adapter.listPending({})).rejects.toBe(limited);
    const notYours = new ApiError(404, 'Compra não encontrada');
    vi.mocked(http.post).mockRejectedValue(notYours);
    await expect(adapter.resendDelivery(KEY, 'p1')).rejects.toBe(notYours);
  });

  it('reads a route this deployment does not have as not available yet', async () => {
    vi.mocked(http.get).mockRejectedValue(new ApiError(404, 'Request failed with status 404'));
    await expect(adapter.listPending({})).rejects.toBeInstanceOf(FeatureUnavailableError);
  });
});
