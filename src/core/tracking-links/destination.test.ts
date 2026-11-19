import { describe, expect, it } from 'vitest';
import {
  BUILT_BY_MCP_NOTE, publicUrlOf, appOriginOf, checkoutDestination, cleanHost, funnelDestination, pickDomain, storeDestination, urlDestination,
} from './destination.js';
import type { CustomDomain } from '../types/custom-domain.js';

const domain = (over: Partial<CustomDomain>): CustomDomain => ({
  id: 'd1', domain: 'pay.example.com', status: 'verified', createdAt: '2026-11-01T00:00:00Z', ...over,
});
const none = { host: null };
const origin = 'https://ggcheckout.app';

describe('appOriginOf', () => {
  it('keeps scheme, host and port, drops the path', () => {
    expect(appOriginOf('https://ggcheckout.app')).toBe('https://ggcheckout.app');
    expect(appOriginOf('https://qa.ggcheckout.app/api/v1')).toBe('https://qa.ggcheckout.app');
    expect(appOriginOf('http://localhost:3000/')).toBe('http://localhost:3000');
  });
  it('refuses a broken URL', () => expect(() => appOriginOf('nope')).toThrow());
});

describe('cleanHost', () => {
  it('accepts hostnames and tolerates a scheme', () => {
    expect(cleanHost('Pay.Example.com')).toBe('pay.example.com');
    expect(cleanHost('https://pay.example.com/')).toBe('pay.example.com');
  });
  it('rejects what is not a hostname', () => {
    for (const bad of [null, undefined, '', 'localhost', 'a b.com', 'evil.com@x', '-a.com']) expect(cleanHost(bad)).toBeNull();
  });
});

describe('pickDomain', () => {
  it('uses a verified domain found by id', () => {
    expect(pickDomain({ id: 'd1' }, [domain({})])).toEqual({ host: 'pay.example.com' });
  });
  it('only verified domains: pending, failed and disabled fall back with a note', () => {
    for (const status of ['pending', 'failed', 'disabled'] as const) {
      const pick = pickDomain({ id: 'd1' }, [domain({ status })]);
      expect(pick.host).toBeNull();
      expect(pick.note).toContain(status);
    }
  });
  it('an id that matches nothing falls back with a note', () => {
    expect(pickDomain({ id: 'gone' }, [domain({})])).toMatchObject({ host: null, note: expect.stringContaining('não foi encontrado') });
  });
  it('a hostname by name is checked against the list, case-insensitive', () => {
    expect(pickDomain({ name: 'PAY.example.com' }, [domain({ status: 'pending' })]).host).toBeNull();
    expect(pickDomain({ name: 'PAY.example.com' }, [domain({})]).host).toBe('pay.example.com');
  });
  it('a hostname the document reports is trusted when the list lacks it', () => {
    expect(pickDomain({ name: 'x.example.com' }, [])).toEqual({ host: 'x.example.com' });
  });
  it('nothing to resolve', () => expect(pickDomain({ id: null, name: '' }, null)).toEqual(none));
  it('an invalid hostname is ignored', () => expect(pickDomain({ name: 'not a host' }, [])).toEqual(none));
});

describe('checkoutDestination', () => {
  it('app origin: /checkout/{id}, url-encoded', () => {
    expect(checkoutDestination({ origin, id: 'AbC 1', domain: none })).toMatchObject({
      kind: 'checkout', url: 'https://ggcheckout.app/checkout/AbC%201', customDomain: false,
    });
  });
  it('custom domain: https://{host}/checkout/{id}', () => {
    expect(checkoutDestination({ origin, id: 'pub1', domain: { host: 'pay.example.com' } })).toMatchObject({
      url: 'https://pay.example.com/checkout/pub1', customDomain: true,
    });
  });
  it('unpublished adds a note; the domain note is kept', () => {
    const d = checkoutDestination({ origin, id: 'a', published: false, domain: { host: null, note: 'dom' } });
    expect(d.notes).toEqual(['dom', BUILT_BY_MCP_NOTE, 'O checkout está despublicado: o link só funciona depois de publicar.']);
  });
});

describe('funnelDestination', () => {
  it('app origin: /quiz/{slug}', () => {
    expect(funnelDestination({ origin, slug: 'meu-quiz', domain: none }).url).toBe('https://ggcheckout.app/quiz/meu-quiz');
  });
  it('custom domain: the root', () => {
    expect(funnelDestination({ origin, slug: 'meu-quiz', domain: { host: 'quiz.example.com' } }).url).toBe('https://quiz.example.com/');
  });
  it('unpublished funnel warns', () => {
    expect(funnelDestination({ origin, slug: 'q', published: false, domain: none }).notes.join(' ')).toContain('despublicado');
    expect(funnelDestination({ origin, slug: 'q', published: true, domain: none }).notes.join(' ')).not.toContain('despublicado');
  });
});

describe('storeDestination', () => {
  it('app origin store and product', () => {
    expect(storeDestination({ origin, storeId: 's1', domain: none })).toMatchObject({ kind: 'store', url: 'https://ggcheckout.app/s/s1' });
    expect(storeDestination({ origin, storeId: 's1', productId: 'p9', domain: none })).toMatchObject({
      kind: 'product', url: 'https://ggcheckout.app/s/s1/product/p9',
    });
  });
  it('custom domain store and product', () => {
    expect(storeDestination({ origin, storeId: 's1', domain: { host: 'loja.example.com' } }).url).toBe('https://loja.example.com/');
    expect(storeDestination({ origin, storeId: 's1', productId: 'p9', domain: { host: 'loja.example.com' } }).url)
      .toBe('https://loja.example.com/product/p9');
  });
});

describe('urlDestination', () => {
  it('accepts https and keeps the query', () => {
    expect(urlDestination(' https://example.com/a?b=1 ').url).toBe('https://example.com/a?b=1');
  });
  it('refuses http, credentials, other schemes and garbage', () => {
    for (const bad of ['http://example.com', 'https://u:p@example.com', 'javascript:alert(1)', 'example.com']) {
      expect(() => urlDestination(bad)).toThrow();
    }
  });
});

describe('publicUrl from the saas', () => {
  it('publicUrlOf accepts plain https only', () => {
    expect(publicUrlOf(' https://pay.example.com/checkout/x ')).toBe('https://pay.example.com/checkout/x');
    for (const bad of [undefined, 42, 'http://a.com', 'https://u:p@a.com', 'nope', 'javascript:1']) expect(publicUrlOf(bad)).toBeNull();
  });
  it('is used as is, with no built-by-MCP note, and flags a custom domain by origin', () => {
    const own = checkoutDestination({ origin, id: 'a', domain: none, publicUrl: 'https://pay.example.com/checkout/PUB' });
    expect(own).toMatchObject({ url: 'https://pay.example.com/checkout/PUB', customDomain: true, notes: [] });
    expect(checkoutDestination({ origin, id: 'a', domain: none, publicUrl: `${origin}/checkout/PUB` }).customDomain).toBe(false);
  });
  it('store: a product appends /product/{id} to the store link', () => {
    expect(storeDestination({ origin, storeId: 's', productId: 'p', domain: none, publicUrl: 'https://loja.example.com/' }).url)
      .toBe('https://loja.example.com/product/p');
    expect(storeDestination({ origin, storeId: 's', domain: none, publicUrl: `${origin}/s/s1` }).url).toBe(`${origin}/s/s1`);
  });
});
