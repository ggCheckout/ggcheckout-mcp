import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerProductTools } from './product.tools.js';
import { ProductService } from '../../../core/services/product.service.js';
import type { ProductPort } from '../../../core/ports/product.port.js';
import { ValidationError } from '../../../shared/errors.js';
import { createServer } from 'node:http';
import { ProductApiAdapter } from '../../outbound/product.api.js';
import { HttpClient } from '../../outbound/http-client.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

describe('downsell routing through MCP', () => {
  let client: Client;
  let server: McpServer;
  let service: ProductService;
  let port: ProductPort;
  const chainWarning = "Este upsell está em 'Continuar sequência': recusar ele segue direto para o próximo upsell, então este downsell não vai aparecer.";
  const caveat = "o funil só o respeita se o painel do vendedor já mostrar o campo 'Ligado ao upsell'";
  const stored = {
    uid: 'd', downsellProductId: 'down', downsellProductIds: ['down'], order: 1,
    productOverrides: { down: { price: 1200, triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells', displayMode: 'external' } },
  };
  const create = { productId: 'parent', downsellId: 'd', downsellProductId: 'down', title: 'Offer', price: 1200, triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells' };
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError, body: result.isError ? text : JSON.parse(text) };
  };

  beforeEach(async () => {
    port = {
      listUpsells: vi.fn().mockResolvedValue([{ uid: 'u', upsellProductIds: ['up', 'up2'], status: 'active', title: 'Premium', chainBehavior: 'stop_on_decline' }]),
      listDownsells: vi.fn().mockResolvedValue({ downsells: [stored], count: 1 }),
      createDownsell: vi.fn().mockImplementation(async (_p, _d, doc) => doc),
      saveOffer: vi.fn().mockImplementation(async (_p, _kind, _id, doc) => doc),
    } as unknown as ProductPort;
    service = new ProductService(port, 'https://app.test');
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerProductTools(server, service);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(ct);
  });

  afterEach(async () => { await client.close(); await server.close(); });

  it('accepts schema fields and persists them beside price on create', async () => {
    const { error, body } = await call('create_downsell', create);
    expect(error).toBeFalsy();
    expect(body.success).toBe(true);
    expect(body.downsell.productOverrides.down).toEqual({ price: 1200, triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells' });
    expect(body.downsell).not.toHaveProperty('triggerUpsellProductId');
    expect(body.warning).toContain(caveat);
    expect(body.warning).not.toContain('Continuar sequência');
    expect(port.listUpsells).toHaveBeenCalledWith('parent');
  });

  it.each(['afterDownsell', 'triggerUpsellProductId'])('rejects an invalid %s in the tool schema', async (field) => {
    const { error } = await call('create_downsell', { ...create, [field]: field === 'afterDownsell' ? 'invalid' : '' });
    expect(error).toBe(true);
    expect(port.createDownsell).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'inactive'])('rejects a product outside active upsells: %s, listing valid ids and names', async (trigger) => {
    vi.mocked(port.listUpsells).mockResolvedValue([
      { upsellProductIds: ['up', 'up2'], status: 'active', title: 'Premium' },
      { upsellProductId: 'inactive', status: 'inactive', title: 'Disabled' },
    ] as any);
    await expect(service.createDownsell('parent', 'd', { ...create, triggerUpsellProductId: trigger } as any))
      .rejects.toThrow(ValidationError);
    await expect(service.updateDownsell('parent', 'd', { triggerUpsellProductId: trigger } as any))
      .rejects.toThrow(/up.*Premium.*up2/);
    expect(port.createDownsell).not.toHaveBeenCalled();
    expect(port.saveOffer).not.toHaveBeenCalled();
  });

  it('accepts a singular upsell product id and any product of a multi-product upsell', async () => {
    expect((await call('create_downsell', { ...create, triggerUpsellProductId: 'up2' })).error).toBeFalsy();
    vi.mocked(port.listUpsells).mockResolvedValue([{ upsellProductId: 'single', status: 'active' }] as any);
    expect((await call('create_downsell', { ...create, triggerUpsellProductId: 'single' })).error).toBeFalsy();
  });

  it('treats an upsell without status as active, like the saas funnel', async () => {
    vi.mocked(port.listUpsells).mockResolvedValue([{ upsellProductIds: ['nostatus'] }] as any);
    expect((await call('create_downsell', { ...create, triggerUpsellProductId: 'nostatus' })).error).toBeFalsy();
  });

  it.each(['create_downsell', 'update_downsell'])('returns D3 warning alongside success and downsell for %s', async (tool) => {
    vi.mocked(port.listUpsells).mockResolvedValue([{ upsellProductId: 'up', status: 'active', chainBehavior: 'continue' }] as any);
    const args = tool === 'create_downsell' ? create : { productId: 'parent', downsellId: 'd', afterDownsell: 'continue_upsells' };
    const { body } = await call(tool, args);
    expect(body).toMatchObject({ success: true, downsell: { uid: 'd' } });
    expect(body.warning).toContain(chainWarning);
    expect(body.warning).toContain(caveat);
    expect(body.downsell).not.toHaveProperty('warning');
    const written = tool === 'create_downsell' ? vi.mocked(port.createDownsell).mock.calls[0][2] : vi.mocked(port.saveOffer).mock.calls[0][3];
    expect(written).not.toHaveProperty('warning');
  });

  it('updates routing alone and clears defaults through the update schema', async () => {
    const args = { productId: 'parent', downsellId: 'd' };
    const updated = await call('update_downsell', { ...args, afterDownsell: 'continue_upsells' });
    expect(updated.body.downsell.productOverrides).toEqual(stored.productOverrides);
    const cleared = await call('update_downsell', { ...args, triggerUpsellProductId: null, afterDownsell: 'end' });
    expect(cleared.body.downsell.productOverrides.down).toEqual({ price: 1200, displayMode: 'external' });
  });

  it('allows an omitted orphaned link on update but refuses a new one when no active upsells exist', async () => {
    vi.mocked(port.listUpsells).mockResolvedValue([]);
    const { body, error } = await call('update_downsell', { productId: 'parent', downsellId: 'd', title: 'Changed' });
    expect(error).toBeFalsy();
    expect(body.downsell.productOverrides.down.triggerUpsellProductId).toBe('up');
    await expect(service.createDownsell('parent', 'd', create as any)).rejects.toThrow(/none/i);
  });

  it.each([
    ['trigger link', { triggerUpsellProductId: 'up' }, true],
    ['continue_upsells', { afterDownsell: 'continue_upsells' }, true],
    ['clearing with null and end', { triggerUpsellProductId: null, afterDownsell: 'end' }, false],
    ['an unrelated field', { title: 'Changed' }, false],
  ])('update_downsell carries the panel caveat only when it writes routing: %s', async (_name, input, expected) => {
    const { body } = await call('update_downsell', { productId: 'parent', downsellId: 'd', ...input });
    if (expected) expect(body.warning).toContain(caveat);
    else expect(body).not.toHaveProperty('warning');
  });

  it('create_downsell without routing has no warning', async () => {
    const { body } = await call('create_downsell', { productId: 'parent', downsellId: 'd', downsellProductId: 'down', title: 'Offer', price: 1200 });
    expect(body).not.toHaveProperty('warning');
  });

  it('create_downsell with triggerUpsellProductId null against an unknown upsell is not validated', async () => {
    vi.mocked(port.listUpsells).mockResolvedValue([]);
    const { error, body } = await call('create_downsell', { productId: 'parent', downsellId: 'd', downsellProductId: 'down', title: 'Offer', price: 1200, triggerUpsellProductId: null });
    expect(error).toBeFalsy();
    expect(body.downsell.productOverrides.down).toEqual({ price: 1200 });
    expect(body).not.toHaveProperty('warning');
  });

  it('lists a downsell without the legacy upsellId field', async () => {
    expect(stored).not.toHaveProperty('upsellId');
    const { body } = await call('list_downsells', { productId: 'parent' });
    expect(body.downsells[0]).not.toHaveProperty('upsellId');
    expect(body.downsells[0].triggerUpsellProductId).toBe('up');
  });

  it('keeps the link on the first offered product of a multi-product downsell', async () => {
    vi.mocked(port.listDownsells).mockResolvedValue({ downsells: [{ uid: 'm', downsellProductIds: ['a', 'b'], order: 1, productOverrides: { a: { price: 100, triggerUpsellProductId: 'up' }, b: { price: 200, triggerUpsellProductId: 'up2' } } }], count: 1 } as any);
    const { body } = await call('list_downsells', { productId: 'parent' });
    expect(body.downsells[0].triggerUpsellProductId).toBe('up');
  });

  it('lists routing fields from the offered product override', async () => {
    const { body } = await call('list_downsells', { productId: 'parent' });
    expect(body.downsells[0]).toMatchObject({ triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells', effectivePriceCents: 1200 });
  });
});

it('round-trips routing through the real HTTP adapter against a localhost API fixture', async () => {
  let stored: any;
  const api = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url === '/api/product-delivery/parent/upsells/list') {
      res.end(JSON.stringify({ upsells: [{ upsellProductId: 'up', status: 'active', chainBehavior: 'continue' }] }));
    } else if (req.method === 'GET' && req.url === '/api/product-delivery/parent/downsells/list') {
      res.end(JSON.stringify({ downsells: stored ? [stored] : [], count: stored ? 1 : 0 }));
    } else if (req.method === 'POST' && req.url === '/api/product-delivery/parent/downsells/d') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      stored = JSON.parse(Buffer.concat(chunks).toString()).downsell;
      res.end(JSON.stringify({ downsell: stored }));
    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  });
  await new Promise<void>((resolve, reject) => { api.once('error', reject); api.listen(0, '127.0.0.1', resolve); });
  try {
    const address = api.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const service = new ProductService(new ProductApiAdapter(new HttpClient(url, 'local-fixture-only', '0.6.0'), {
      getMyBusinessId: async () => 'local-fixture',
    }), url);
    const created = await service.createDownsell('parent', 'd', {
      downsellProductId: 'down', title: 'Fixture', price: 1200, triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells',
    });
    expect(created.warning).toContain('Continuar sequência');
    expect(created.warning).toContain("'Ligado ao upsell'");
    expect(stored.productOverrides.down).toEqual({ price: 1200, triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells' });
    expect(stored).not.toHaveProperty('warning');
    expect(stored).not.toHaveProperty('triggerUpsellProductId');
    expect((await service.listDownsells('parent')).downsells[0]).toMatchObject({ triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells' });
    await service.updateDownsell('parent', 'd', { afterDownsell: 'end' });
    expect(stored.productOverrides.down).toEqual({ price: 1200, triggerUpsellProductId: 'up' });
    await service.updateDownsell('parent', 'd', { triggerUpsellProductId: null });
    expect(stored.productOverrides.down).toEqual({ price: 1200 });
  } finally {
    await new Promise<void>((resolve, reject) => api.close((error) => error ? reject(error) : resolve()));
  }
});
