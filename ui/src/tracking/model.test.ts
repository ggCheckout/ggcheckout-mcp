import { describe, expect, it } from 'vitest';
import { countsLabel, summarizeDiagnosis, summarizeGuide } from './model';

const guide = {
  topic: null,
  sections: [{ id: 'paths', title: 'Caminhos', summary: 'Resumo', items: [{ title: 'Modo', body: 'Texto' }, { title: '', body: '' }] }],
  problems: [{ symptom: 'Sem UTMs', causes: ['link', ' '], fixes: ['testar'] }],
};

describe('summarizeGuide', () => {
  it('reads sections and problems', () => {
    const model = summarizeGuide(guide)!;
    expect(model.topic).toBeNull();
    expect(model.sections[0]).toMatchObject({ id: 'paths', title: 'Caminhos' });
    expect(model.problems[0]).toEqual({ symptom: 'Sem UTMs', causes: ['link'], fixes: ['testar'] });
  });

  it('keeps the topic', () => {
    expect(summarizeGuide({ ...guide, topic: 'utms' })!.topic).toBe('utms');
  });

  it('ignores other payloads', () => {
    expect(summarizeGuide({ findings: [], scope: {} })).toBeNull();
    expect(summarizeGuide({ sections: [] })).toBeNull();
    expect(summarizeGuide(null)).toBeNull();
  });
});

const finding = (severity: string, code: string) => ({ severity, code, title: code, detail: 'd', fix: 'f' });

const diagnosis = {
  scope: { kind: 'checkout', checkoutId: 'c1', title: 'Curso X' },
  findings: [finding('ok', 'a'), finding('info', 'b'), finding('critical', 'c'), finding('warning', 'd'), finding('critical', 'e'), finding('bogus', 'z')],
  tokens: [
    { id: 't1', title: 'Pixel', channel: 'facebook', trackingMode: 'pixel', status: 'active', pixelId: '1234…9012', health: { consecutiveFailures: 2, lastError: 'Invalid token', disabledReason: null } },
    { id: 't2', title: 'TikTok', channel: 'tiktok', trackingMode: 'both', status: 'disabled', pixelId: null, health: { consecutiveFailures: 3, disabledReason: 'expirado', lastError: null } },
    { id: 't3', title: 'UTMify', channel: 'utmify', trackingMode: null, status: 'active', pixelId: null, health: null },
    { id: 't4', title: 'Ok', channel: 'google', trackingMode: 'events_api', status: 'active', pixelId: null, health: { consecutiveFailures: 0 } },
  ],
  payment: {
    id: 'p1', status: 'paid', createdAt: '2026-11-10T13:00:00Z',
    utms: { utm_source: 'facebook' }, clickIds: { fbc: true, fbp: false, ttclid: false, ttp: false },
    dispatch: { facebook: { ok: false, event: 'Purchase', failed: 1, total: 1, details: [] } },
  },
  errors: {
    facebook: { available: true, hours: 24, total: 3, subjects: [{ title: 'Pixel', code: 'AB', count: 3, lastError: 'Invalid token' }] },
    tiktok: { available: false, hours: 24, total: 0, subjects: [] },
  },
};

describe('summarizeDiagnosis', () => {
  const model = summarizeDiagnosis(diagnosis)!;

  it('sorts findings critical to ok, stable inside a severity, and drops unknown severities', () => {
    expect(model.findings.map((f) => f.code)).toEqual(['c', 'e', 'd', 'b', 'a']);
    expect(model.findings[0].severityLabel).toBe('Crítico');
    expect(model.counts).toEqual({ critical: 2, warning: 1, info: 1, ok: 1 });
  });

  it('labels the scope', () => {
    expect(model.scopeLabel).toBe('Checkout Curso X');
    expect(summarizeDiagnosis({ ...diagnosis, scope: { kind: 'account' } })!.scopeLabel).toBe('Visão geral da conta');
  });

  it('reads token mode and health', () => {
    expect(model.tokens.map((t) => t.health.tone)).toEqual(['warning', 'critical', 'unknown', 'ok']);
    expect(model.tokens[0]).toMatchObject({ channelLabel: 'Meta', modeLabel: 'Só navegador (pixel)' });
    expect(model.tokens[0].health).toMatchObject({ label: '2 falhas seguidas', detail: 'Invalid token' });
    expect(model.tokens[1]).toMatchObject({ statusLabel: 'Desativado', health: { label: 'Desativado', detail: 'expirado' } });
  });

  it('shows the text the server sends for a disabled reason, the code when absent', () => {
    const coded = summarizeDiagnosis({ ...diagnosis, tokens: [{ id: 'x', title: 'X', channel: 'tiktok', status: 'disabled', health: { consecutiveFailures: 3, disabledReason: 'repeated_failures', disabledReasonText: 'falhas seguidas no envio' } }] })!;
    expect(coded.tokens[0].health.detail).toBe('falhas seguidas no envio');
    const bare = summarizeDiagnosis({ ...diagnosis, tokens: [{ id: 'x', title: 'X', channel: 'tiktok', status: 'disabled', health: { consecutiveFailures: 3, disabledReason: 'repeated_failures' } }] })!;
    expect(bare.tokens[0].health.detail).toBe('repeated_failures');
  });

  it('reads the payment attribution and dispatch', () => {
    expect(model.payment!.utms).toEqual([['utm_source', 'facebook']]);
    expect(model.payment!.clickIds.find((c) => c.label.startsWith('fbc'))!.present).toBe(true);
    expect(model.payment!.dispatch[0]).toMatchObject({ channelLabel: 'Meta', ok: false, event: 'Purchase' });
  });

  it('reads the errors per channel, with an unavailable one', () => {
    expect(model.errors[0]).toMatchObject({ channelLabel: 'Meta', total: 3, subjects: [{ name: 'Pixel', count: 3 }] });
    expect(model.errors[1]).toMatchObject({ channelLabel: 'TikTok', available: false });
  });

  it('has no payment when the answer carries none', () => {
    expect(summarizeDiagnosis({ ...diagnosis, payment: undefined })!.payment).toBeNull();
  });

  it('ignores other payloads', () => {
    expect(summarizeDiagnosis(guide)).toBeNull();
    expect(summarizeDiagnosis({ findings: [] })).toBeNull();
  });
});

describe('countsLabel', () => {
  it('says what was found', () => {
    expect(countsLabel({ critical: 2, warning: 1, info: 0, ok: 3 })).toBe('2 críticos, 1 atenção');
    expect(countsLabel({ critical: 0, warning: 0, info: 1, ok: 1 })).toBe('1 informação');
    expect(countsLabel({ critical: 0, warning: 0, info: 0, ok: 1 })).toBe('Nenhum problema encontrado');
  });
});
