import { describe, expect, it } from 'vitest';
import { domainStatus, recordsHint, summarizeDomain, summarizeDomainList, summarizeVerify, usageLabel } from './model';

// The shapes QA answered on 2026-11-10.
const instructions = {
  type: 'subdomain',
  txt: { name: '', value: '', type: 'TXT' },
  pointer: { name: 'checkout.exemplo.com.br', value: 'pay.ggcheckout.app', type: 'CNAME' },
  notes: [
    '✅ Configure apenas o registro CNAME abaixo',
    'Se você usa Cloudflare como DNS, deixe com Proxy desligado (DNS only — nuvem cinza)',
  ],
};
const pending = {
  id: '86e17ef1', domain: 'checkout.exemplo.com.br', status: 'pending', provider: 'cloudflare', type: 'subdomain',
  cfStatus: 'pending', createdAt: '2026-11-10T03:41:42.805639+00:00', dnsInstructions: instructions,
};

describe('summarizeDomain', () => {
  it('keeps the CNAME and drops the empty TXT', () => {
    const domain = summarizeDomain({ domain: pending })!;
    expect(domain.records).toEqual([{ type: 'CNAME', name: 'checkout.exemplo.com.br', value: 'pay.ggcheckout.app' }]);
    expect(domain.notes).toEqual(['Se você usa Cloudflare como DNS, deixe com Proxy desligado (DNS only — nuvem cinza)']);
  });

  it('reads the answer of add_custom_domain too', () => {
    const added = { id: 'd2', domain: 'pay.loja.com', status: 'pending', dnsInstructions: instructions, createdAt: '2026-11-10T10:00:00Z' };
    expect(summarizeDomain({ success: true, domain: added })).toMatchObject({ id: 'd2', domain: 'pay.loja.com', status: 'pending' });
  });

  it('keeps a legacy TXT record that has a value', () => {
    const legacy = { ...pending, dnsInstructions: { ...instructions, txt: { name: '_vercel', value: 'vc-domain-verify=x', type: 'TXT' } } };
    expect(summarizeDomain({ domain: legacy })!.records.map((r) => r.type)).toEqual(['CNAME', 'TXT']);
  });

  it('ignores other payloads', () => {
    expect(summarizeDomain({ domain: 'x' })).toBeNull();
    expect(summarizeDomain({ invoice: {} })).toBeNull();
  });
});

describe('summarizeDomainList', () => {
  it('counts the domains against the cap', () => {
    const list = summarizeDomainList({ domains: [pending, { ...pending, id: 'v', status: 'verified' }], total: 2, limit: 5 })!;
    expect(list.domains.map((d) => d.status)).toEqual(['pending', 'verified']);
    expect(usageLabel(list)).toBe('2 de 5 domínios utilizados');
    expect(list.domains[0].records).toEqual([{ type: 'CNAME', name: 'checkout.exemplo.com.br', value: 'pay.ggcheckout.app' }]);
  });
});

describe('summarizeVerify', () => {
  it('says which step is still missing', () => {
    const base = { success: true, status: 'pending', checks: { txt: { valid: true }, pointer: { valid: false } } };
    expect(summarizeVerify({ ...base, cloudflare: { hostnameActive: false, sslActive: false } })!.detail).toMatch(/CNAME ainda não foi detectado/);
    expect(summarizeVerify({ ...base, cloudflare: { hostnameActive: true, sslActive: false } })!.detail).toMatch(/certificado SSL/);
  });

  it('reports verified and failed', () => {
    expect(summarizeVerify({ success: true, status: 'verified', checks: {} })!.title).toBe('Domínio verificado!');
    expect(summarizeVerify({ success: false, status: 'failed', checks: {}, error: 'Domínio com inconsistência' })).toMatchObject({ status: 'failed', detail: 'Domínio com inconsistência' });
  });

  it('ignores other payloads', () => {
    expect(summarizeVerify({ status: 'active', isDelinquent: false })).toBeNull();
  });
});

describe('domainStatus', () => {
  it('labels each status as the settings do', () => {
    expect(domainStatus('verified')).toEqual({ label: 'Verificado', tone: 'success' });
    expect(domainStatus('weird')).toEqual({ label: 'weird', tone: 'muted' });
  });
});

describe('recordsHint', () => {
  const cname = { type: 'CNAME', name: 'a.loja.com', value: 'pay.ggcheckout.app' };
  const txt = { type: 'TXT', name: '_vercel.loja.com', value: 'vc-domain-verify=x' };

  it('words the sentence from the records present', () => {
    expect(recordsHint([cname])).toBe('Configure o registro CNAME abaixo.');
    expect(recordsHint([cname, txt])).toBe('Configure os registros CNAME e TXT abaixo.');
  });
});
