import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppInboxApiAdapter } from './whatsapp-inbox.api.js';
import type { HttpClient } from './http-client.js';
import {
  ApiError, FeatureUnavailableError, InboxAccessDisabledError, InboxTermsRequiredError,
} from '../../shared/errors.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

const KEY = '5531999998888';
const FUNNEL = '2f9d6c3e-4b1a-4c55-9a7e-0a1b2c3d4e5f';

describe('WhatsAppInboxApiAdapter', () => {
  let adapter: WhatsAppInboxApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new WhatsAppInboxApiAdapter(http);
  });

  it('reads the settings', async () => {
    vi.mocked(http.get).mockResolvedValue({ autoSwitchChip: true, apiAccessEnabled: true, updatedAt: null });
    expect(await adapter.getSettings()).toMatchObject({ apiAccessEnabled: true });
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/inbox/settings');
  });

  it('lists conversations with the query as strings', async () => {
    vi.mocked(http.get).mockResolvedValue({ items: [], nextBefore: null });
    await adapter.listConversations({ limit: 20, before: `5:${KEY}`, includeAutomatic: false });
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/inbox/conversations', { limit: '20', before: `5:${KEY}`, includeAutomatic: 'false' });
    await adapter.listConversations({});
    expect(http.get).toHaveBeenLastCalledWith('/api/whatsapp/inbox/conversations', {});
  });

  it('lists messages of one conversation, encoding a lid key', async () => {
    vi.mocked(http.get).mockResolvedValue({ items: [], nextBefore: null });
    await adapter.listMessages('lid:abc@lid', { limit: 100, before: '12-3' });
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/inbox/conversations/lid%3Aabc%40lid/messages', { limit: '100', before: '12-3' });
  });

  it('sends a reply with the client id and unwraps the message', async () => {
    vi.mocked(http.post).mockResolvedValue({ message: { messageId: 'm1', duplicate: false } });
    const message = await adapter.sendReply(KEY, { text: 'Oi', clientMessageId: 'abc-123' });
    expect(http.post).toHaveBeenCalledWith(`/api/whatsapp/inbox/conversations/${KEY}/messages`, { text: 'Oi', clientMessageId: 'abc-123' });
    expect(message).toMatchObject({ messageId: 'm1' });
    await adapter.sendReply(KEY, { text: 'Oi', clientMessageId: 'abc-123', chipId: FUNNEL });
    expect(http.post).toHaveBeenLastCalledWith(expect.any(String), { text: 'Oi', clientMessageId: 'abc-123', chipId: FUNNEL });
  });

  it('marks read with a POST and no body', async () => {
    vi.mocked(http.post).mockResolvedValue({});
    await adapter.markRead(KEY);
    expect(http.post).toHaveBeenCalledWith(`/api/whatsapp/inbox/conversations/${KEY}/read`);
  });

  it('reads, starts and stops the funnel of a conversation', async () => {
    vi.mocked(http.get).mockResolvedValue({ run: null });
    expect(await adapter.getContactRun(KEY)).toBeNull();
    expect(http.get).toHaveBeenCalledWith(`/api/whatsapp/inbox/conversations/${KEY}/funnel`);

    vi.mocked(http.post).mockResolvedValue({ started: true });
    await adapter.startRun(KEY, FUNNEL);
    expect(http.post).toHaveBeenCalledWith(`/api/whatsapp/inbox/conversations/${KEY}/funnel`, { funnelId: FUNNEL });
    await adapter.startRun(KEY, FUNNEL, { customer_name: 'Ana' });
    expect(http.post).toHaveBeenLastCalledWith(expect.any(String), { funnelId: FUNNEL, variables: { customer_name: 'Ana' } });

    vi.mocked(http.delete).mockResolvedValue({ stoppedRunId: 'r1' });
    await adapter.stopRun(KEY);
    expect(http.delete).toHaveBeenCalledWith(`/api/whatsapp/inbox/conversations/${KEY}/funnel`);
  });

  it('opts out with POST and back in with DELETE', async () => {
    vi.mocked(http.post).mockResolvedValue({ optedOut: true, stoppedRuns: 1 });
    vi.mocked(http.delete).mockResolvedValue({ optedOut: false, stoppedRuns: 0 });
    await adapter.setOptOut(KEY, true);
    await adapter.setOptOut(KEY, false);
    expect(http.post).toHaveBeenCalledWith(`/api/whatsapp/inbox/conversations/${KEY}/opt-out`);
    expect(http.delete).toHaveBeenCalledWith(`/api/whatsapp/inbox/conversations/${KEY}/opt-out`);
  });

  it('never calls a session-only route (terms, test message, settings PUT)', async () => {
    vi.mocked(http.get).mockResolvedValue({});
    vi.mocked(http.post).mockResolvedValue({});
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.getSettings();
    await adapter.markRead(KEY);
    await adapter.setOptOut(KEY, true);
    const urls = [http.get, http.post, http.delete].flatMap((fn) => vi.mocked(fn).mock.calls.map((c) => String(c[0])));
    expect(urls.some((u) => /terms|test-message/.test(u))).toBe(false);
    expect(http.put).not.toHaveBeenCalled();
  });

  describe('refusals', () => {
    it('a route this deployment does not have is unavailable, on every verb', async () => {
      const missing = new ApiError(404, 'Request failed with status 404');
      vi.mocked(http.get).mockRejectedValue(missing);
      vi.mocked(http.post).mockRejectedValue(missing);
      vi.mocked(http.delete).mockRejectedValue(missing);
      await expect(adapter.getSettings()).rejects.toBeInstanceOf(FeatureUnavailableError);
      await expect(adapter.listConversations({})).rejects.toBeInstanceOf(FeatureUnavailableError);
      await expect(adapter.sendReply(KEY, { text: 'x', clientMessageId: 'a' })).rejects.toBeInstanceOf(FeatureUnavailableError);
      await expect(adapter.setOptOut(KEY, false)).rejects.toBeInstanceOf(FeatureUnavailableError);
    });

    it('"no funnel running" is the API\'s own 404 and stays an ordinary error', async () => {
      const none = new ApiError(404, 'Funil não encontrado.');
      vi.mocked(http.delete).mockRejectedValue(none);
      await expect(adapter.stopRun(KEY)).rejects.toBe(none);
    });

    it('403 INBOX_API_ACCESS_DISABLED names the switch to turn on', async () => {
      vi.mocked(http.get).mockRejectedValue(new ApiError(403, 'Ative "Permitir acesso pelo MCP" nas configurações da caixa de entrada para usar a caixa pelo MCP. (INBOX_API_ACCESS_DISABLED)'));
      const error = await adapter.listConversations({}).catch((e) => e);
      expect(error).toBeInstanceOf(InboxAccessDisabledError);
      expect(error.code).toBe('INBOX_API_ACCESS_DISABLED');
      expect(error.message).toContain('Permitir acesso pelo MCP');
    });

    it('403 INBOX_TERMS_REQUIRED says the term is accepted in the panel', async () => {
      vi.mocked(http.get).mockRejectedValue(new ApiError(403, 'Aceite o termo para abrir a caixa de entrada. (INBOX_TERMS_REQUIRED)'));
      const error = await adapter.listMessages(KEY, {}).catch((e) => e);
      expect(error).toBeInstanceOf(InboxTermsRequiredError);
      expect(error.message).toMatch(/painel/);
    });

    it('any other 403 (an API key refused on a session-only route) passes through', async () => {
      const refused = new ApiError(403, 'Esta ação não está disponível para chaves de API');
      vi.mocked(http.get).mockRejectedValue(refused);
      await expect(adapter.getSettings()).rejects.toBe(refused);
    });

    it('a reply the core refused keeps its message for the seller', async () => {
      const refused = new ApiError(422, 'O chip desta conversa caiu e a troca automática está desligada: escolha outro chip. (INBOX_REPLY_REFUSED)');
      vi.mocked(http.post).mockRejectedValue(refused);
      await expect(adapter.sendReply(KEY, { text: 'x', clientMessageId: 'a' })).rejects.toBe(refused);
    });
  });
});
