import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppFunnelApiAdapter } from './whatsapp-funnel.api.js';
import type { HttpClient } from './http-client.js';
import {
  ApiError, FeatureUnavailableError, InboxAccessDisabledError, InboxTermsRequiredError,
} from '../../shared/errors.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

const ID = '2f9d6c3e-4b1a-4c55-9a7e-0a1b2c3d4e5f';

describe('WhatsAppFunnelApiAdapter', () => {
  let adapter: WhatsAppFunnelApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new WhatsAppFunnelApiAdapter(http);
  });

  it('lists with the page size and the cursor as query parameters', async () => {
    vi.mocked(http.get).mockResolvedValue({ items: [], nextAfter: null });
    await adapter.list({ limit: 20, after: `1_${ID}` });
    expect(http.get).toHaveBeenCalledWith('/api/whatsapp/funnels', { limit: '20', after: `1_${ID}` });
    await adapter.list({});
    expect(http.get).toHaveBeenLastCalledWith('/api/whatsapp/funnels', {});
  });

  it('gets, replaces and deletes by the funnel id', async () => {
    vi.mocked(http.get).mockResolvedValue({ id: ID });
    vi.mocked(http.put).mockResolvedValue({ id: ID });
    vi.mocked(http.delete).mockResolvedValue({ ok: true });
    const body = { name: 'Funil' } as any;
    await adapter.get(ID);
    await adapter.replace(ID, body);
    await adapter.delete(ID);
    expect(http.get).toHaveBeenCalledWith(`/api/whatsapp/funnels/${ID}`);
    expect(http.put).toHaveBeenCalledWith(`/api/whatsapp/funnels/${ID}`, body);
    expect(http.delete).toHaveBeenCalledWith(`/api/whatsapp/funnels/${ID}`);
  });

  it('creates with the whole funnel as the body', async () => {
    vi.mocked(http.post).mockResolvedValue({ id: ID });
    const body = { name: 'Funil', trigger: 'manual' } as any;
    await adapter.create(body);
    expect(http.post).toHaveBeenCalledWith('/api/whatsapp/funnels', body);
  });

  it('toggles with only `enabled`', async () => {
    vi.mocked(http.post).mockResolvedValue({ id: ID, isEnabled: true });
    await adapter.toggle(ID, true);
    expect(http.post).toHaveBeenCalledWith(`/api/whatsapp/funnels/${ID}/toggle`, { enabled: true });
  });

  it('imports the contacts to the run import route', async () => {
    vi.mocked(http.post).mockResolvedValue({ started: 1, skippedOptOut: 0, skippedInvalid: 0, skippedActive: 0 });
    const contacts = [{ phone: '5531999998888', name: 'Ana' }];
    await adapter.importContacts(ID, contacts);
    expect(http.post).toHaveBeenCalledWith(`/api/whatsapp/funnels/${ID}/runs/import`, { contacts });
  });

  it('answers a route this deployment does not have as unavailable, never as a crash', async () => {
    vi.mocked(http.get).mockRejectedValue(new ApiError(404, 'Request failed with status 404'));
    await expect(adapter.list({})).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it('keeps the API\'s own 404 (it names what is missing) as it is', async () => {
    const notFound = new ApiError(404, 'Funil não encontrado.');
    vi.mocked(http.get).mockRejectedValue(notFound);
    await expect(adapter.get(ID)).rejects.toBe(notFound);
  });

  it('names the switch when the import is refused for it', async () => {
    vi.mocked(http.post).mockRejectedValue(new ApiError(403, 'Ative "Permitir acesso pelo MCP" (INBOX_API_ACCESS_DISABLED)'));
    const error = await adapter.importContacts(ID, [{ phone: '5531999998888' }]).catch((e) => e);
    expect(error).toBeInstanceOf(InboxAccessDisabledError);
    expect(error.message).toContain('Permitir acesso pelo MCP');
  });

  it('names the term when the core wants it accepted', async () => {
    vi.mocked(http.post).mockRejectedValue(new ApiError(403, 'Aceite o termo (INBOX_TERMS_REQUIRED)'));
    await expect(adapter.importContacts(ID, [{ phone: '5531999998888' }])).rejects.toBeInstanceOf(InboxTermsRequiredError);
  });

  it('leaves any other refusal alone', async () => {
    const conflict = new ApiError(409, 'Já existe um funil ligado para este gatilho (FUNNEL_TRIGGER_TAKEN)');
    vi.mocked(http.post).mockRejectedValue(conflict);
    await expect(adapter.toggle(ID, true)).rejects.toBe(conflict);
  });
});
