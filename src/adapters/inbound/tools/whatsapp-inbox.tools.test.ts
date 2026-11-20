import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerWhatsAppInboxTools } from './whatsapp-inbox.tools.js';
import { registerAppViews, APP_MIME_TYPE, APP_URI } from '../apps/apps.js';
import { FeatureUnavailableError, InboxAccessDisabledError, InboxTermsRequiredError } from '../../../shared/errors.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const KEY = '553199998888';
const FUNNEL = '2f9d6c3e-4b1a-4c55-9a7e-0a1b2c3d4e5f';
const APP_ONLY = [
  'list_whatsapp_conversations', 'list_whatsapp_messages', 'send_whatsapp_reply', 'mark_whatsapp_conversation_read',
  'get_whatsapp_conversation_funnel', 'start_whatsapp_conversation_funnel', 'stop_whatsapp_conversation_funnel',
  'set_whatsapp_conversation_opt_out',
];

const service = {
  summarize: vi.fn(), listConversations: vi.fn(), listMessages: vi.fn(), sendReply: vi.fn(), markRead: vi.fn(),
  getContactRun: vi.fn(), startRun: vi.fn(), stopRun: vi.fn(), setOptOut: vi.fn(),
} as any;

async function connect(drawsViews: boolean, { withAppViews = false } = {}) {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  // As in index.ts, other tools are registered before the connection: that is what declares the tools capability.
  server.registerTool('always_there', { description: 'Always registered' }, async () => ({ content: [] }));
  registerWhatsAppInboxTools(server, service);
  if (withAppViews) registerAppViews(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const capabilities = drawsViews ? { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [APP_MIME_TYPE] } } } : {};
  const client = new Client({ name: 'c', version: '0' }, { capabilities });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

beforeEach(() => {
  for (const fn of Object.values(service) as ReturnType<typeof vi.fn>[]) fn.mockReset().mockResolvedValue({});
});

describe('WhatsApp inbox tools registration', () => {
  it('registers none of them for a client without MCP Apps support', async () => {
    const client = await connect(false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['always_there']);
  });

  it('registers none of them when the client announces other extensions only', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    server.registerTool('always_there', { description: 'Always registered' }, async () => ({ content: [] }));
    registerWhatsAppInboxTools(server, service);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'c', version: '0' }, { capabilities: { extensions: { 'io.example/other': {} } } });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(['always_there']);
  });

  it('registers the entry point and the eight app-only tools for a client that draws Apps', async () => {
    const client = await connect(true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['always_there', 'open_whatsapp_inbox', ...APP_ONLY].sort());
  });

  it('marks every tool but the entry point app-only, and all of them with the app view', async () => {
    const client = await connect(true);
    const { tools } = await client.listTools();
    for (const tool of tools.filter((t) => t.name !== 'always_there')) {
      const ui = (tool._meta as any)?.ui;
      expect(ui.resourceUri).toBe(APP_URI);
      if (tool.name === 'open_whatsapp_inbox') expect(ui.visibility).toBeUndefined();
      else expect(ui.visibility).toEqual(['app']);
    }
  });

  it('also registers when the app views were registered after it', async () => {
    const client = await connect(true, { withAppViews: true });
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('open_whatsapp_inbox');
  });
});

describe('open_whatsapp_inbox', () => {
  const open = async (summary: object, state: string) => {
    service.summarize.mockResolvedValue({ summary, state });
    const client = await connect(true);
    return client.callTool({ name: 'open_whatsapp_inbox', arguments: {} });
  };
  const allText = (result: any) => JSON.stringify([result.content, result.structuredContent]);

  it('gives the model five fields, in text and in structured content, and nothing else', async () => {
    const result = await open({ available: true, enabled: true, conversations: 3, unread: 5, truncated: false }, 'ready');
    expect(result.structuredContent).toEqual({ available: true, enabled: true, conversations: 3, unread: 5, truncated: false });
    expect(JSON.parse((result.content as any)[0].text)).toEqual({ available: true, enabled: true, conversations: 3, unread: 5, truncated: false });
  });

  it('carries no name, phone or message text even if the service returned them', async () => {
    const result = await open({
      available: true, enabled: true, conversations: 1, unread: 1, truncated: false,
      items: [{ contactKey: KEY, name: 'Ana Souza', lastText: 'meu pedido atrasou' }],
      name: 'Ana Souza', phone: KEY, text: 'meu pedido atrasou',
    }, 'ready');
    const text = allText(result);
    for (const leaked of ['Ana', KEY, 'atrasou', 'items', 'contactKey']) expect(text).not.toContain(leaked);
    expect(Object.keys(result.structuredContent as object).sort()).toEqual(['available', 'conversations', 'enabled', 'truncated', 'unread']);
  });

  it('does not call the conversation tools: counts come from the service summary alone', async () => {
    await open({ available: true, enabled: true, conversations: 0, unread: 0 }, 'ready');
    expect(service.listConversations).not.toHaveBeenCalled();
    expect(service.listMessages).not.toHaveBeenCalled();
  });

  it('off: tells the seller to turn on "Permitir acesso pelo MCP" in the panel inbox settings', async () => {
    const result = await open({ available: true, enabled: false, conversations: 0, unread: 0 }, 'off');
    const text = allText(result);
    expect(text).toContain('Permitir acesso pelo MCP');
    expect(text).toMatch(/configurações da\s+caixa de entrada, no painel/);
    expect((result.structuredContent as any).enabled).toBe(false);
  });

  it('a 404 on the routes: available false and "ainda não disponível nesta conta"', async () => {
    const result = await open({ available: false, enabled: false, conversations: 0, unread: 0 }, 'unavailable');
    expect((result.structuredContent as any).available).toBe(false);
    expect(allText(result)).toContain('ainda não está disponível nesta conta');
  });

  it('terms missing: tells the seller to accept the term in the panel', async () => {
    const result = await open({ available: true, enabled: true, conversations: 0, unread: 0 }, 'terms_required');
    expect(allText(result)).toMatch(/aceitar o termo .* no painel/);
  });

  it('a failure is an error result, not a crash', async () => {
    service.summarize.mockRejectedValue(new Error('boom'));
    const client = await connect(true);
    const result = await client.callTool({ name: 'open_whatsapp_inbox', arguments: {} });
    expect(result.isError).toBe(true);
  });
});

describe('app-only inbox tools', () => {
  const call = async (name: string, args: Record<string, unknown>) => (await connect(true)).callTool({ name, arguments: args });

  it('send_whatsapp_reply passes the text, the client id and the key apart', async () => {
    service.sendReply.mockResolvedValue({ messageId: 'm1', duplicate: false });
    const result = await call('send_whatsapp_reply', { contactKey: KEY, text: 'Oi', clientMessageId: 'abc-123' });
    expect(service.sendReply).toHaveBeenCalledWith(KEY, { text: 'Oi', clientMessageId: 'abc-123' });
    expect(result.structuredContent).toEqual({ message: { messageId: 'm1', duplicate: false } });
  });

  it.each([
    ['a blank text', { text: '   ' }],
    ['a text over 4096 characters', { text: 'a'.repeat(4097) }],
    ['a client id with a space', { clientMessageId: 'a b' }],
    ['a client id over 64 characters', { clientMessageId: 'a'.repeat(65) }],
    ['a key that is not a phone or a lid', { contactKey: 'ana' }],
    ['a Brazilian mobile with the ninth digit (not canonical)', { contactKey: '5531999998888' }],
  ])('refuses a reply with %s', async (_label, patch) => {
    const result = await call('send_whatsapp_reply', { contactKey: KEY, text: 'Oi', clientMessageId: 'abc-123', ...patch });
    expect(result.isError).toBe(true);
    expect(service.sendReply).not.toHaveBeenCalled();
  });

  it('accepts a lid key and counts emoji as one character each', async () => {
    await call('send_whatsapp_reply', { contactKey: 'lid:abc123@lid', text: '😀'.repeat(4096), clientMessageId: 'x' });
    expect(service.sendReply).toHaveBeenCalledTimes(1);
  });

  it('lists conversations and messages with their paging', async () => {
    await call('list_whatsapp_conversations', { limit: 50, includeAutomatic: true });
    await call('list_whatsapp_messages', { contactKey: KEY, limit: 100, before: '1-2' });
    expect(service.listConversations).toHaveBeenCalledWith({ limit: 50, includeAutomatic: true });
    expect(service.listMessages).toHaveBeenCalledWith(KEY, { limit: 100, before: '1-2' });
    expect((await call('list_whatsapp_conversations', { limit: 51 })).isError).toBe(true);
    expect((await call('list_whatsapp_messages', { contactKey: KEY, limit: 101 })).isError).toBe(true);
  });

  it('runs and stops a funnel, reads its run and toggles the opt-out', async () => {
    await call('start_whatsapp_conversation_funnel', { contactKey: KEY, funnelId: FUNNEL, variables: { customer_name: 'Ana' } });
    await call('stop_whatsapp_conversation_funnel', { contactKey: KEY });
    await call('get_whatsapp_conversation_funnel', { contactKey: KEY });
    await call('set_whatsapp_conversation_opt_out', { contactKey: KEY, optedOut: true });
    await call('mark_whatsapp_conversation_read', { contactKey: KEY });
    expect(service.startRun).toHaveBeenCalledWith(KEY, FUNNEL, { customer_name: 'Ana' });
    expect(service.stopRun).toHaveBeenCalledWith(KEY);
    expect(service.getContactRun).toHaveBeenCalledWith(KEY);
    expect(service.setOptOut).toHaveBeenCalledWith(KEY, true);
    expect(service.markRead).toHaveBeenCalledWith(KEY);
  });

  it('refuses a variable name the funnel cannot use', async () => {
    const result = await call('start_whatsapp_conversation_funnel', { contactKey: KEY, funnelId: FUNNEL, variables: { 'Customer Name': 'Ana' } });
    expect(result.isError).toBe(true);
    expect(service.startRun).not.toHaveBeenCalled();
  });

  it.each([
    ['the switch is off', new InboxAccessDisabledError(), /Permitir acesso pelo MCP/],
    ['the term is missing', new InboxTermsRequiredError(), /termo/],
    ['the route is not there', new FeatureUnavailableError(), /Ainda não disponível nesta conta/],
  ])('says why when %s', async (_label, error, pattern) => {
    service.listConversations.mockRejectedValue(error);
    const result = await call('list_whatsapp_conversations', {});
    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toMatch(pattern);
  });
});
