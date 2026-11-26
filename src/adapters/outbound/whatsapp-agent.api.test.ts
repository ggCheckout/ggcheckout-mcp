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
const TASK = '0192a000-0000-4000-8000-000000000020';
const TURN = { bubbles: ['Oi', 'Achei sua compra'], clientMessageId: 'c1', category: 'support' as const, privateNote: null };

describe('WhatsAppAgentApiAdapter', () => {
  let adapter: WhatsAppAgentApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new WhatsAppAgentApiAdapter(http);
    vi.mocked(http.get).mockResolvedValue({ items: [] });
    vi.mocked(http.post).mockResolvedValue({ ok: true });
  });

  it('reads a thread with the query as strings', async () => {
    await adapter.listMessages('lid:abc@lid', { limit: 30, before: '12-3' });
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/lid%3Aabc%40lid/messages`, { limit: '30', before: '12-3' });
  });

  it('reads the state, replies, writes a task and escalates with the bodies of the contract', async () => {
    await adapter.readState(KEY);
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/${KEY}/state`);
    await adapter.sendReply(KEY, TURN);
    expect(http.post).toHaveBeenLastCalledWith(`${BASE}/${KEY}/reply`, TURN);
    await adapter.sendTaskReply(TASK, { bubbles: ['Oi, Ana!'], clientMessageId: 't1', privateNote: null });
    expect(http.post).toHaveBeenLastCalledWith(`/api/whatsapp/agent/tasks/${TASK}/messages`, { bubbles: ['Oi, Ana!'], clientMessageId: 't1', privateNote: null });
    await adapter.escalate(KEY, { code: 'unreadable_media', summary: 'mandou áudio' });
    expect(http.post).toHaveBeenLastCalledWith(`${BASE}/${KEY}/escalate`, { code: 'unreadable_media', summary: 'mandou áudio' });
  });

  it('gets the access of a purchase and the catalog of the conversation', async () => {
    await adapter.sendPurchaseAccess(KEY, 'p1');
    expect(http.post).toHaveBeenLastCalledWith(`${BASE}/${KEY}/purchases/p1/access`);
    await adapter.listCatalog(KEY);
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/${KEY}/catalog`);
    await adapter.createCatalogLink(KEY, 'prod/../x');
    expect(http.post).toHaveBeenLastCalledWith(`${BASE}/${KEY}/catalog/prod%2F..%2Fx/link`);
  });

  it('finds purchases by the conversation phone alone: no query', async () => {
    await adapter.findPurchases(KEY);
    expect(http.get).toHaveBeenCalledWith(`${BASE}/${KEY}/purchases`);
  });

  it('resends by e-mail through its own route, with the e-mail in the body', async () => {
    await adapter.resendDeliveryByEmail(KEY, 'ana@example.com');
    expect(http.post).toHaveBeenCalledWith(`${BASE}/${KEY}/resend-by-email`, { email: 'ana@example.com' });
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

  it.each(['resend-by-email', 'purchases/p1/resend', 'purchases/p1/recovery-link', 'purchases/p1/offer-link'])(
    'a route that refuses with AGENT_HELD on %s stops the model',
    async (route) => {
      vi.mocked(http.post).mockRejectedValue(new ApiError(409, 'Conversa assumida (AGENT_HELD)'));
      const call = route === 'resend-by-email' ? adapter.resendDeliveryByEmail(KEY, 'a@b.co')
        : route.endsWith('/resend') ? adapter.resendDelivery(KEY, 'p1')
          : route.endsWith('recovery-link') ? adapter.createRecoveryLink(KEY, 'p1') : adapter.createOfferLink(KEY, 'p1', 'o');
      const failure = await call.catch((e) => e);
      expect(failure).toBeInstanceOf(WhatsAppAgentRefusalError);
      expect(failure.code).toBe('AGENT_HELD');
    },
  );

  it.each([
    ['AGENT_HELD', new ApiError(409, 'Conversa assumida (AGENT_HELD)')],
    ['AGENT_CONTACT_EXITED', new ApiError(409, 'Contato pediu para sair (AGENT_CONTACT_EXITED; detail)')],
    ['AGENT_OPTED_OUT', new ApiError(409, 'Contato saiu da lista (AGENT_OPTED_OUT)')],
    ['AGENT_CONVERSATION_NOT_FOUND', new ApiError(404, 'Conversa não encontrada (AGENT_CONVERSATION_NOT_FOUND)')],
    ['AGENT_GLOBAL_CAP', new RateLimitError('Teto atingido (AGENT_GLOBAL_CAP). Retry after 3600 seconds.')],
    ['AGENT_CATEGORY_CAP', new RateLimitError('Teto da categoria (AGENT_CATEGORY_CAP; sale)')],
    ['AGENT_OPEN_PROBLEM', new ApiError(409, 'Problema aberto (AGENT_OPEN_PROBLEM)')],
    ['AGENT_REVIEW_FALSE_URGENCY', new ApiError(422, 'Revisão recusou (AGENT_REVIEW_FALSE_URGENCY)')],
    ['AGENT_TASK_EXPIRED', new ApiError(409, 'Tarefa vencida (AGENT_TASK_EXPIRED)')],
    ['AGENT_ALREADY_OFFERED', new ApiError(409, 'Oferta já feita (AGENT_ALREADY_OFFERED)')],
    ['AGENT_UPSELL_NOT_OFFERED', new ApiError(409, 'Downsell antes do upsell (AGENT_UPSELL_NOT_OFFERED)')],
    // The saas answer outside the QA (saas-checkout#2586): 404 with a body, which is not a missing route.
    ['AGENT_UNAVAILABLE', new ApiError(404, 'O assistente não está disponível. (AGENT_UNAVAILABLE)')],
    ['AGENT_KEY_REFUSED', new AuthenticationError('Chave inválida')],
  ])('turns %s into a refusal that tells the model to stop', async (code, error) => {
    vi.mocked(http.post).mockRejectedValue(error);
    const failure = await adapter.sendReply(KEY, TURN).catch((e) => e);
    expect(failure).toBeInstanceOf(WhatsAppAgentRefusalError);
    expect(failure.code).toBe(code);
    expect(failure.message).toContain(`(${code})`);
  });

  it.each([
    ['AGENT_ALREADY_ESCALATED', 409],
    ['AGENT_RETENTION_GATE', 409],
    ['AGENT_ASK_EMAIL_FIRST', 409],
  ])('an escalation refused with %s tells the model what to do instead', async (code, status) => {
    vi.mocked(http.post).mockRejectedValue(new ApiError(status, `Recusado (${code})`));
    const failure = await adapter.escalate(KEY, { code: 'refund', summary: 'pediu reembolso' }).catch((e) => e);
    expect(failure).toBeInstanceOf(WhatsAppAgentRefusalError);
    expect(failure.code).toBe(code);
  });

  it('a review refusal gives the model every check that failed, each with its instruction', async () => {
    vi.mocked(http.post).mockRejectedValue(new ApiError(422,
      'A revisão recusou a resposta. (AGENT_REVIEW_FALSE_URGENCY; AGENT_REVIEW_FALSE_URGENCY, AGENT_REVIEW_PRICE_ANCHOR)'));
    const failure = await adapter.sendReply(KEY, TURN).catch((e) => e);
    expect(failure).toBeInstanceOf(WhatsAppAgentRefusalError);
    expect(failure.code).toBe('AGENT_REVIEW_FALSE_URGENCY');
    expect(failure.message).toContain('(AGENT_REVIEW_FALSE_URGENCY)');
    expect(failure.message).toContain('(AGENT_REVIEW_PRICE_ANCHOR)');
    expect(failure.message).not.toContain('(AGENT_REVIEW_SHAPE)');
  });

  it('keeps an ordinary rate limit and other API errors as they are', async () => {
    const limited = new RateLimitError('Muitas requisições. Retry after 30 seconds.');
    vi.mocked(http.get).mockRejectedValue(limited);
    await expect(adapter.listMessages(KEY, {})).rejects.toBe(limited);
    const notYours = new ApiError(404, 'Compra não encontrada');
    vi.mocked(http.post).mockRejectedValue(notYours);
    await expect(adapter.resendDelivery(KEY, 'p1')).rejects.toBe(notYours);
  });

  it('reads a route this deployment does not have as not available yet', async () => {
    vi.mocked(http.get).mockRejectedValue(new ApiError(404, 'Request failed with status 404'));
    const failure = await adapter.listMessages(KEY, {}).catch((e) => e);
    expect(failure).toBeInstanceOf(FeatureUnavailableError);
    expect(failure.message).toMatch(/assistente de WhatsApp/);
    expect(failure.message).not.toMatch(/funil|caixa de entrada/);
    expect(failure.message).toMatch(/Pare e não tente outras ferramentas/);
  });
});
