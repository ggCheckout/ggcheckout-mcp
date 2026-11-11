import { describe, expect, it, vi } from 'vitest';
import { TrackingLinkService } from './tracking-link.service.js';

const origin = 'https://ggcheckout.app';
const domains = [
  { id: 'd1', domain: 'pay.example.com', status: 'verified', createdAt: 'x' },
  { id: 'd2', domain: 'wait.example.com', status: 'pending', createdAt: 'x' },
];

function make(over: Record<string, any> = {}) {
  const reads = {
    checkouts: { getById: vi.fn().mockResolvedValue({ uid: 'uid1', title: 'Curso', uuidOwner: 'b', price: 1, published: true }) },
    funnels: { getById: vi.fn().mockResolvedValue({ id: 'f1', slug: 'quiz', title: 'Quiz', published: true, deleted: false, settings: {} }) },
    stores: { getStore: vi.fn().mockResolvedValue({ id: 's1', published: true, settings: { title: 'Loja' } }) },
    domains: { list: vi.fn().mockResolvedValue({ domains, total: 2, limit: 5 }) },
    ...over,
  };
  return { reads, service: new TrackingLinkService(reads as any, origin) };
}

describe('TrackingLinkService', () => {
  it('requires exactly one target', async () => {
    const { service } = make();
    await expect(service.build({})).rejects.toThrow(/exactly one/);
    await expect(service.build({ checkoutId: 'a', funnelId: 'b' })).rejects.toThrow(/exactly one/);
    await expect(service.build({ productId: 'p' })).rejects.toThrow(/exactly one/);
  });

  it('productId needs a store', async () => {
    const { service } = make();
    await expect(service.build({ checkoutId: 'a', productId: 'p' })).rejects.toThrow(/storeId/);
  });

  it('checkout on the app origin uses publicId when present, else uid, and never lists domains', async () => {
    const { service, reads } = make();
    expect((await service.build({ checkoutId: 'asked', utm_source: 'x' })).destination.url).toBe(`${origin}/checkout/uid1`);
    reads.checkouts.getById.mockResolvedValue({ uid: 'uid1', publicId: 'PUB', title: 'Curso', uuidOwner: 'b', price: 1 });
    expect((await service.build({ checkoutId: 'asked', utm_source: 'x' })).destination.url).toBe(`${origin}/checkout/PUB`);
    expect(reads.domains.list).not.toHaveBeenCalled();
  });

  it('checkout on a verified custom domain, and on the origin with a note when the domain is pending', async () => {
    const { service, reads } = make();
    reads.checkouts.getById.mockResolvedValue({ uid: 'u', publicId: 'PUB', customDomain: 'pay.example.com', title: 't', uuidOwner: 'b', price: 1 });
    expect((await service.build({ checkoutId: 'c', platform: 'meta' })).destination.url).toBe('https://pay.example.com/checkout/PUB');
    reads.checkouts.getById.mockResolvedValue({ uid: 'u', publicId: 'PUB', customDomain: 'wait.example.com', title: 't', uuidOwner: 'b', price: 1 });
    const link = await service.build({ checkoutId: 'c', platform: 'meta' });
    expect(link.destination.url).toBe(`${origin}/checkout/PUB`);
    expect(link.notes.join(' ')).toContain('ainda não está verificado');
  });

  it('funnel: customDomainId resolved through the list; unpublished or deleted adds the note', async () => {
    const { service, reads } = make();
    reads.funnels.getById.mockResolvedValue({ id: 'f', slug: 'quiz', title: 'Q', published: false, deleted: false, settings: { customDomainId: 'd1' } });
    const link = await service.build({ funnelId: 'f', platform: 'tiktok' });
    expect(link.destination).toMatchObject({ kind: 'funnel', url: 'https://pay.example.com/', customDomain: true, title: 'Q' });
    expect(link.notes.join(' ')).toContain('despublicado');
    reads.funnels.getById.mockResolvedValue({ id: 'f', slug: 'quiz', published: true, deleted: true, settings: {} });
    expect((await service.build({ funnelId: 'f', platform: 'tiktok' })).notes.join(' ')).toContain('despublicado');
  });

  it('funnel without a domain: origin /quiz/{slug}', async () => {
    const { service } = make();
    expect((await service.build({ funnelId: 'f', platform: 'google' })).destination.url).toBe(`${origin}/quiz/quiz`);
  });

  it('store and product: verified domain only', async () => {
    const { service, reads } = make();
    expect((await service.build({ storeId: 's1', productId: 'p1', utm_source: 'a' })).destination.url).toBe(`${origin}/s/s1/product/p1`);
    reads.stores.getStore.mockResolvedValue({ id: 's1', published: true, customDomainId: 'd1' });
    expect((await service.build({ storeId: 's1', productId: 'p1', utm_source: 'a' })).destination.url).toBe('https://pay.example.com/product/p1');
    reads.stores.getStore.mockResolvedValue({ id: 's1', published: true, customDomainId: 'd2' });
    const link = await service.build({ storeId: 's1', utm_source: 'a' });
    expect(link.destination.url).toBe(`${origin}/s/s1`);
    expect(link.notes.join(' ')).toContain('wait.example.com');
  });

  it('raw url merges its own query and reads nothing', async () => {
    const { service, reads } = make();
    const link = await service.build({ url: 'https://example.com/lp?a=1', platform: 'manual', utm_source: 'x' });
    expect(link.finalUrl).toBe('https://example.com/lp?a=1&utm_source=x');
    expect(link.destination).toMatchObject({ kind: 'url', customDomain: false });
    expect(reads.checkouts.getById).not.toHaveBeenCalled();
  });

  it('defaults to a manual link', async () => {
    const { service } = make();
    expect((await service.build({ url: 'https://example.com', utm_medium: 'bio' })).platform).toBe('manual');
  });

  describe('publicUrl from the saas', () => {
    it('checkout, funnel and store use it, skip the domain list, and carry no built-by-MCP note', async () => {
      const { service, reads } = make();
      reads.checkouts.getById.mockResolvedValue({ uid: 'u', publicUrl: 'https://pay.example.com/checkout/PUB', customDomain: 'wait.example.com' });
      const checkout = await service.build({ checkoutId: 'c', platform: 'meta' });
      expect(checkout.destination).toMatchObject({ url: 'https://pay.example.com/checkout/PUB', customDomain: true });
      expect(checkout.notes.join(' ')).not.toContain('montado pelo MCP');
      reads.funnels.getById.mockResolvedValue({ slug: 'q', publicUrl: `${origin}/quiz/q`, published: true, settings: {} });
      expect((await service.build({ funnelId: 'f', platform: 'meta' })).destination).toMatchObject({ url: `${origin}/quiz/q`, customDomain: false });
      reads.stores.getStore.mockResolvedValue({ publicUrl: 'https://loja.example.com/', published: true });
      expect((await service.build({ storeId: 's', productId: 'p1', utm_source: 'a' })).destination.url).toBe('https://loja.example.com/product/p1');
      expect(reads.domains.list).not.toHaveBeenCalled();
    });

    it('a non-https publicUrl is ignored and the built link says so', async () => {
      const { service, reads } = make();
      reads.checkouts.getById.mockResolvedValue({ uid: 'u', publicId: 'PUB', publicUrl: 'http://evil.example.com/x' });
      const link = await service.build({ checkoutId: 'c', platform: 'meta' });
      expect(link.destination.url).toBe(`${origin}/checkout/PUB`);
      expect(link.notes).toContain('Link montado pelo MCP; confira no painel.');
    });

    it('without publicUrl the fallback carries the note', async () => {
      const { service } = make();
      expect((await service.build({ funnelId: 'f', platform: 'meta' })).notes).toContain('Link montado pelo MCP; confira no painel.');
    });
  });
});
