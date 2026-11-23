import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerWhatsAppFunnelTools } from './whatsapp-funnel.tools.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const ID = '2f9d6c3e-4b1a-4c55-9a7e-0a1b2c3d4e5f';
const step = { waitMinutes: 30, text: 'Oi', markSeen: true, showTyping: true };
const funnel = {
  name: 'Carrinho', trigger: 'abandoned_cart', stopOnReply: true, sendWindow: null, signature: '', coupon: '', useEmoji: false, steps: [step],
};

describe('WhatsApp funnel tools', () => {
  let client: Client;
  const service = {
    list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggle: vi.fn(), importContacts: vi.fn(),
  } as any;

  beforeAll(async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerWhatsAppFunnelTools(server, service);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
  });

  beforeEach(() => {
    for (const fn of Object.values(service) as ReturnType<typeof vi.fn>[]) fn.mockReset().mockResolvedValue({ ok: true });
  });

  const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });

  it('registers the seven funnel tools: the two reads draw the funnels view, none is app-only', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_whatsapp_funnel', 'delete_whatsapp_funnel', 'get_whatsapp_funnel', 'import_whatsapp_funnel_contacts',
      'list_whatsapp_funnels', 'toggle_whatsapp_funnel', 'update_whatsapp_funnel',
    ]);
    const ui = (name: string) => (tools.find((t) => t.name === name)?._meta as any)?.ui;
    for (const name of ['list_whatsapp_funnels', 'get_whatsapp_funnel']) expect(ui(name)).toEqual({ resourceUri: 'ui://ggcheckout/app.html' });
    for (const tool of tools.filter((t) => !['list_whatsapp_funnels', 'get_whatsapp_funnel'].includes(t.name))) expect(ui(tool.name)).toBeUndefined();
  });

  it('creates a funnel from the whole body', async () => {
    const result = await call('create_whatsapp_funnel', funnel);
    expect(result.isError).toBeFalsy();
    expect(service.create).toHaveBeenCalledWith(funnel);
  });

  it.each([
    ['six steps', { steps: Array.from({ length: 6 }, () => step) }],
    ['no step', { steps: [] }],
    ['a wait under 15 minutes', { steps: [{ ...step, waitMinutes: 14 }] }],
    ['a wait over two days', { steps: [{ ...step, waitMinutes: 2881 }] }],
    ['a blank step text', { steps: [{ ...step, text: '   ' }] }],
    ['a step text over 4096 characters', { steps: [{ ...step, text: 'a'.repeat(4097) }] }],
    ['a name over 80 characters', { name: 'a'.repeat(81) }],
    ['a blank name', { name: '   ' }],
    ['a signature over 60 characters', { signature: 'a'.repeat(61) }],
    ['a coupon over 30 characters', { coupon: 'a'.repeat(31) }],
    ['a window that ends before it starts', { sendWindow: { start: 20, end: 8 } }],
    ['an unknown trigger', { trigger: 'whenever' }],
    ['a layout key the board does not have', { layout: { 'message-6': { x: 0, y: 0 } } }],
  ])('refuses %s before it reaches the service', async (_label, patch) => {
    const result = await call('create_whatsapp_funnel', { ...funnel, ...patch });
    expect(result.isError).toBe(true);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('never forwards a field the core does not know (it refuses extra keys)', async () => {
    await call('create_whatsapp_funnel', { ...funnel, surprise: true });
    expect(service.create).toHaveBeenCalledWith(funnel);
    service.create.mockClear();
    expect((await call('create_whatsapp_funnel', { ...funnel, steps: [{ ...step, extra: 1 }] })).isError).toBe(true);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('counts text in code points, as the core does: 4096 emoji fit, 4097 do not', async () => {
    const emoji = '😀';
    expect((await call('create_whatsapp_funnel', { ...funnel, steps: [{ ...step, text: emoji.repeat(4096) }] })).isError).toBeFalsy();
    expect((await call('create_whatsapp_funnel', { ...funnel, steps: [{ ...step, text: emoji.repeat(4097) }] })).isError).toBe(true);
  });

  it('lists with its paging', async () => {
    await call('list_whatsapp_funnels', { limit: 10, after: `1760000000000000_${ID}` });
    expect(service.list).toHaveBeenCalledWith({ limit: 10, after: `1760000000000000_${ID}` });
    expect((await call('list_whatsapp_funnels', { limit: 51 })).isError).toBe(true);
    expect((await call('list_whatsapp_funnels', { after: 'not-a-cursor' })).isError).toBe(true);
  });

  it('updates with the fields it was given and the id apart', async () => {
    await call('update_whatsapp_funnel', { funnelId: ID, coupon: 'VOLTA10' });
    expect(service.update).toHaveBeenCalledWith(ID, { coupon: 'VOLTA10' });
  });

  it('refuses an id that is not a guid', async () => {
    expect((await call('get_whatsapp_funnel', { funnelId: 'abc' })).isError).toBe(true);
    expect(service.get).not.toHaveBeenCalled();
  });

  it('toggles and deletes', async () => {
    await call('toggle_whatsapp_funnel', { funnelId: ID, enabled: false });
    await call('delete_whatsapp_funnel', { funnelId: ID });
    expect(service.toggle).toHaveBeenCalledWith(ID, false);
    expect(service.delete).toHaveBeenCalledWith(ID);
  });

  describe('import_whatsapp_funnel_contacts', () => {
    const contact = (i: number) => ({ phone: `55319${String(10000000 + i)}` });

    it('takes a batch of up to 500 contacts', async () => {
      const contacts = Array.from({ length: 500 }, (_, i) => contact(i));
      expect((await call('import_whatsapp_funnel_contacts', { funnelId: ID, contacts })).isError).toBeFalsy();
      expect(service.importContacts).toHaveBeenCalledWith(ID, contacts);
    });

    it('refuses 501 contacts, none and a phone that is not digits with a country code', async () => {
      const over = Array.from({ length: 501 }, (_, i) => contact(i));
      expect((await call('import_whatsapp_funnel_contacts', { funnelId: ID, contacts: over })).isError).toBe(true);
      expect((await call('import_whatsapp_funnel_contacts', { funnelId: ID, contacts: [] })).isError).toBe(true);
      expect((await call('import_whatsapp_funnel_contacts', { funnelId: ID, contacts: [{ phone: '+55 31 99999-8888' }] })).isError).toBe(true);
      expect(service.importContacts).not.toHaveBeenCalled();
    });
  });
});
