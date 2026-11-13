import { describe, expect, it } from 'vitest';
import { explainTracking } from './guide.js';
import {
  diagnoseTracking, duplicatePixelRules, errorRules, paymentRules, referenceRules, sortFindings, tokenRules, topSubjects,
} from './diagnose.js';
import type {
  ChannelErrors, DiagnosisContext, TrackingChannel, TrackingPayment, TrackingToken,
} from '../types/tracking.js';

const health = { hasSucceeded: true, consecutiveFailures: 0, disabledReason: null, disabledAt: null, lastError: null };

function token(over: Partial<TrackingToken> = {}): TrackingToken {
  return {
    id: 't1', title: 'Pixel loja', type: 'facebook_ads', channel: 'facebook', trackingMode: 'both',
    status: 'active', pixelId: '111122223333', health, ...over,
  };
}

function payment(over: Partial<TrackingPayment> = {}): TrackingPayment {
  return {
    id: 'pay1', status: 'paid', createdAt: '2026-11-10T10:00:00Z', funnelId: null,
    utms: { utm_source: 'facebook', utm_campaign: 'black' },
    clickIds: { fbc: true, fbp: true, ttclid: false, ttp: false },
    dispatch: {
      facebook: { ok: true, sent: 1, failed: 0, total: 1, event: 'Purchase', time: null, details: [] },
    },
    dispatchAt: null, dispatchSuccess: true,
    flags: { created: true, paid: true, refunded: null, chargedback: null },
    ...over,
  };
}

const noErrors = (): Record<TrackingChannel, ChannelErrors | null> => ({
  facebook: { channel: 'facebook', hours: 24, rows: [] },
  tiktok: { channel: 'tiktok', hours: 24, rows: [] },
  google: { channel: 'google', hours: 24, rows: [] },
  utmify: { channel: 'utmify', hours: 24, rows: [] },
});

// Tool names, raw token types and internal field names: none is for the seller's eyes.
const JARGON = /_tracking|update_checkout|list_checkouts|insert_token|\w+_ads\b|trackProps|utmify\.params|consecutiveFailures|lastError|disabledReason|metrics_\w+_dispatched|metricToken|event_?id|eventId|sessionStorage|localStorage|settings\.utmify|latest\.js|pixel\.js|gtag|SHA256|webhook de pago/i;

const codes = (findings: { code: string }[]) => findings.map((f) => f.code);

describe('referenceRules', () => {
  it('warns about a checkout without any metric token', () => {
    const findings = referenceRules([{ id: 'c1', title: 'Curso', metricTokenIds: [] }], null, [token()]);
    expect(findings).toMatchObject([{ severity: 'warning', code: 'checkout_no_metric_token' }]);
    expect(findings[0].detail).toContain('Curso');
  });

  it('is critical when the token a checkout points to is not in the vault', () => {
    const findings = referenceRules([{ id: 'c1', title: 'Curso', metricTokenIds: ['gone'] }], null, [token()]);
    expect(findings).toMatchObject([{ severity: 'critical', code: 'token_missing' }]);
    expect(findings[0].detail).toContain('gone');
  });

  it('checks the funnel token ids too', () => {
    const findings = referenceRules([], { id: 'f1', title: 'Quiz', tokenIds: { tiktok: 'gone' }, utmifyPixelId: null }, []);
    expect(codes(findings)).toEqual(['token_missing']);
  });

  it('cannot tell a missing token when the tokens route is not there', () => {
    expect(referenceRules([{ id: 'c1', title: 'Curso', metricTokenIds: ['x'] }], null, null)).toEqual([]);
  });
});

describe('tokenRules', () => {
  it('is critical for a disabled token a checkout uses, with the reason', () => {
    const disabled = token({ status: 'disabled', health: { ...health, consecutiveFailures: 3, disabledReason: 'Token expirado' } });
    const findings = tokenRules([disabled], new Set(['t1']));
    expect(findings[0]).toMatchObject({ severity: 'critical', code: 'token_disabled' });
    expect(findings[0].detail).toContain('Token expirado');
  });

  it('says the disabled reason in words, not as the API code', () => {
    const disabled = token({ status: 'disabled', health: { ...health, disabledReason: 'invalid_credential' } });
    const detail = tokenRules([disabled], new Set(['t1']))[0].detail;
    expect(detail).toContain('credencial inválida');
    expect(detail).not.toContain('invalid_credential');
    expect(tokenRules([{ ...disabled, health: { ...health, disabledReason: 'repeated_failures' } }], new Set())[0].detail).toContain('falhas seguidas');
  });

  it('only names MCP tools that do the action: no insert_token for pixel tokens', () => {
    const ctx = [
      ...referenceRules([{ id: 'c', title: 'C', metricTokenIds: [] }, { id: 'd', title: 'D', metricTokenIds: ['gone'] }], null, []),
      ...tokenRules([token({ trackingMode: 'pixel', status: 'disabled', health: { ...health, disabledReason: 'x' } }), token({ id: 't2', health: { ...health, consecutiveFailures: 1 } })], new Set(['t1', 't2'])),
    ];
    expect(ctx.map((f) => f.fix).join('\n')).not.toContain('insert_token');
    expect(ctx.find((f) => f.code === 'checkout_no_metric_token')!.fix).toContain('Pixels & Rastreio');
  });

  it('keeps tool names and raw token types out of the text the seller reads', () => {
    const ctx: DiagnosisContext = {
      scope: { kind: 'account' },
      tokens: [
        token({ trackingMode: 'pixel', status: 'disabled', health: { ...health, disabledReason: 'x', consecutiveFailures: 3 } }),
        token({ id: 't2', channel: 'tiktok', type: 'tiktok_ads', health: { ...health, consecutiveFailures: 1 }, pixelId: '111122223333' }),
        token({ id: 't3', pixelId: '111122223333' }),
      ],
      checkouts: [{ id: 'c', title: 'C', metricTokenIds: [] }, { id: 'd', title: 'D', metricTokenIds: ['gone'] }],
      missingCheckoutId: 'zzz',
      funnel: null,
      payment: payment({ utms: {}, dispatch: { tiktok: { ok: false, sent: 0, failed: 1, total: 1, event: 'Purchase', time: null, details: [] } } }),
      errors: { facebook: { channel: 'facebook', hours: 24, rows: [{ channel: 'facebook', paymentId: 'p', event: 'Purchase', subjectTitle: 'P', subjectCode: 'A', errorCode: '1', errorMessage: 'x', createdAt: '2026-11-10T10:00:00Z' }] }, tiktok: null, google: null, utmify: null },
    };
    const out = diagnoseTracking(ctx).map((f) => `${f.title}\n${f.detail}\n${f.fix}`).join('\n');
    expect(out).not.toMatch(JARGON);
    expect(JSON.stringify(explainTracking())).not.toMatch(JARGON);
  });

  it('is only a warning when nothing uses the disabled token', () => {
    const disabled = token({ status: 'disabled', health: { ...health, disabledReason: 'permanent' } });
    expect(tokenRules([disabled], new Set())[0].severity).toBe('warning');
  });

  it('warns about consecutive failures with the last error', () => {
    const failing = token({ health: { ...health, consecutiveFailures: 2, lastError: 'Invalid OAuth access token' } });
    const findings = tokenRules([failing], new Set(['t1']));
    expect(findings[0]).toMatchObject({ severity: 'warning', code: 'token_failures' });
    expect(findings[0].detail).toContain('Invalid OAuth access token');
  });

  it('clips and scrubs the provider error', () => {
    const long = `falhou para pessoa@exemplo.com ${'x'.repeat(500)}`;
    const failing = token({ health: { ...health, consecutiveFailures: 1, lastError: long } });
    const detail = tokenRules([failing], new Set(['t1']))[0].detail;
    expect(detail).not.toContain('pessoa@exemplo.com');
    expect(detail.length).toBeLessThan(500);
  });

  it('says tokens are healthy when none has a problem', () => {
    expect(codes(tokenRules([token()], new Set(['t1'])))).toEqual(['tokens_healthy']);
  });

  it('reports that health is not available when no token carries it', () => {
    expect(codes(tokenRules([token({ health: null })], new Set(['t1'])))).toEqual(['token_health_unavailable']);
  });

  it('warns that the pixel mode loses the Purchase when the tab closes, and suggests both', () => {
    const findings = tokenRules([token({ trackingMode: 'pixel' })], new Set(['t1']));
    const mode = findings.find((f) => f.code === 'token_mode_pixel');
    expect(mode).toMatchObject({ severity: 'warning' });
    expect(mode?.fix).toContain('Ambos (Recomendado)');
  });

  it('notes that events_api alone has no browser InitiateCheckout', () => {
    const findings = tokenRules([token({ trackingMode: 'events_api' })], new Set(['t1']));
    expect(findings.find((f) => f.code === 'token_mode_events_api')).toMatchObject({ severity: 'info' });
  });

  it('does not flag the default events_api of Google Ads, nor a token nothing uses', () => {
    const google = token({ id: 'g', channel: 'google', type: 'google_ads', trackingMode: 'events_api', pixelId: 'AW-1' });
    expect(codes(tokenRules([google], new Set(['g'])))).toEqual(['tokens_healthy']);
    expect(codes(tokenRules([token({ trackingMode: 'pixel' })], new Set()))).toEqual(['tokens_healthy']);
  });
});

describe('duplicatePixelRules', () => {
  it('warns when two tokens of a channel share a pixel id', () => {
    const findings = duplicatePixelRules([token(), token({ id: 't2', title: 'Pixel cópia' })]);
    expect(findings).toMatchObject([{ severity: 'warning', code: 'pixel_duplicate' }]);
    expect(findings[0].detail).toContain('Pixel cópia');
  });

  it('lets the same id on different channels be', () => {
    expect(duplicatePixelRules([token(), token({ id: 't2', channel: 'tiktok', type: 'tiktok_ads' })])).toEqual([]);
  });
});

describe('paymentRules', () => {
  it('warns about a payment without UTMs and lists what to check', () => {
    const [finding] = paymentRules(payment({ utms: {} }), false);
    expect(finding).toMatchObject({ severity: 'warning', code: 'payment_no_utms' });
    expect(finding.fix).toContain('redirecionamento');
    expect(finding.fix).toContain('reabriu o checkout');
  });

  it('flags utm_source=organic and mentions the UTMify fallback on a funnel sale', () => {
    const findings = paymentRules(payment({ utms: { utm_source: 'organic' } }), true);
    expect(findings.find((f) => f.code === 'payment_utm_organic')?.detail).toContain('script da UTMify');
  });

  it('is critical for a channel whose dispatch failed, with the cut error', () => {
    const failed = payment({
      dispatch: {
        tiktok: {
          ok: false, sent: 0, failed: 1, total: 1, event: 'Purchase', time: null,
          details: [{ title: 'Pixel TikTok', code: 'AB12…YZ89', ok: false, error: 'Access token is invalid' }],
        },
      },
    });
    const findings = paymentRules(failed, false);
    expect(findings[0]).toMatchObject({ severity: 'critical', code: 'dispatch_failed_tiktok' });
    expect(findings[0].detail).toContain('Access token is invalid');
    expect(findings[0].detail).toContain('AB12…YZ89');
  });

  it('warns about a paid payment whose paid dispatch flag is false', () => {
    const findings = paymentRules(payment({ flags: { created: true, paid: false, refunded: null, chargedback: null } }), false);
    expect(codes(findings)).toContain('paid_not_dispatched');
  });

  it('warns about a paid payment with no dispatch record at all', () => {
    const findings = paymentRules(payment({ dispatch: {}, flags: { created: null, paid: null, refunded: null, chargedback: null } }), false);
    expect(codes(findings)).toContain('paid_not_dispatched');
  });

  it('does not warn about a pending payment with no dispatch', () => {
    const findings = paymentRules(payment({ status: 'pending', dispatch: {}, flags: { created: null, paid: null, refunded: null, chargedback: null } }), false);
    expect(codes(findings)).not.toContain('paid_not_dispatched');
  });

  it('degrades to info when the row carries no dispatch', () => {
    const findings = paymentRules(payment({ dispatch: null }), false);
    expect(findings).toMatchObject([{ severity: 'info', code: 'dispatch_unavailable' }]);
    expect(findings[0].title).toContain('não disponível ainda');
  });

  it('confirms a clean dispatch', () => {
    expect(codes(paymentRules(payment(), false))).toEqual(['dispatch_ok']);
  });
});

describe('errorRules', () => {
  const row = (over = {}) => ({
    channel: 'facebook' as const, paymentId: 'p', event: 'Purchase', subjectTitle: 'Pixel loja', subjectCode: 'AB12…YZ89',
    errorCode: '190', errorMessage: 'Invalid token', createdAt: '2026-11-10T10:00:00Z', ...over,
  });

  it('warns per channel with the top subjects', () => {
    const errors = noErrors();
    errors.facebook = { channel: 'facebook', hours: 24, rows: [row(), row(), row({ subjectTitle: 'Outro', subjectCode: 'Z' })] };
    const findings = errorRules(errors);
    expect(findings).toMatchObject([{ severity: 'warning', code: 'channel_errors_facebook' }]);
    expect(findings[0].detail).toContain('Pixel loja (2)');
  });

  it('says the route is not available yet when every channel answered 404', () => {
    const none = { facebook: null, tiktok: null, google: null, utmify: null };
    expect(errorRules(none)).toMatchObject([{ severity: 'info', code: 'errors_unavailable' }]);
  });

  it('is ok when every channel is clean', () => {
    expect(codes(errorRules(noErrors()))).toEqual(['no_recent_errors']);
  });

  it('ranks subjects by count', () => {
    const subjects = topSubjects([row({ subjectCode: 'A', subjectTitle: 'A' }), row({ subjectCode: 'B', subjectTitle: 'B' }), row({ subjectCode: 'B', subjectTitle: 'B' })]);
    expect(subjects.map((s) => s.title)).toEqual(['B', 'A']);
  });
});

describe('diagnoseTracking', () => {
  const base = (): DiagnosisContext => ({
    scope: { kind: 'account' }, tokens: [token()], checkouts: [{ id: 'c1', title: 'Curso', metricTokenIds: ['t1'] }],
    funnel: null, payment: null, errors: noErrors(),
  });

  it('is all clear for a healthy account', () => {
    const findings = diagnoseTracking(base());
    expect(findings.every((f) => f.severity === 'ok')).toBe(true);
    expect(codes(findings)).toContain('all_clear');
  });

  it('sorts mixed findings critical, warning, info, ok', () => {
    const ctx = base();
    ctx.tokens = [token({ trackingMode: 'pixel' }), token({ id: 't2', channel: 'tiktok', type: 'tiktok_ads', status: 'disabled', health: { ...health, disabledReason: 'x' } })];
    ctx.checkouts = [{ id: 'c1', title: 'Curso', metricTokenIds: ['t1', 't2'] }, { id: 'c2', title: 'Sem token', metricTokenIds: [] }];
    ctx.payment = payment({ dispatch: null });
    const severities = diagnoseTracking(ctx).map((f) => f.severity);
    expect(severities).toEqual([...severities].sort((a, b) => ['critical', 'warning', 'info', 'ok'].indexOf(a) - ['critical', 'warning', 'info', 'ok'].indexOf(b)));
    expect(severities[0]).toBe('critical');
    expect(severities).toContain('info');
  });

  it('degrades every missing route to an info finding, never an error', () => {
    const ctx = base();
    ctx.tokens = null;
    ctx.errors = { facebook: null, tiktok: null, google: null, utmify: null };
    const findings = diagnoseTracking(ctx);
    expect(codes(findings)).toEqual(expect.arrayContaining(['tokens_unavailable', 'errors_unavailable']));
    expect(findings.filter((f) => f.severity === 'info').every((f) => f.title.includes('não disponível ainda'))).toBe(true);
  });

  it('scopes the token rules to the ones the checkout uses', () => {
    const ctx = base();
    ctx.scope = { kind: 'checkout', checkoutId: 'c1' };
    ctx.tokens = [token(), token({ id: 'other', title: 'Outro', status: 'disabled', health: { ...health, disabledReason: 'x' } })];
    expect(codes(diagnoseTracking(ctx))).not.toContain('token_disabled');
  });

  it('reports a checkout that is not in the list', () => {
    const ctx = base();
    ctx.checkouts = [];
    ctx.missingCheckoutId = 'nope';
    expect(diagnoseTracking(ctx)[0]).toMatchObject({ severity: 'critical', code: 'checkout_not_found' });
  });

  it('adds the funnel notes for a funnel scope', () => {
    const ctx = base();
    ctx.scope = { kind: 'funnel', funnelId: 'f1' };
    ctx.checkouts = [];
    ctx.funnel = { id: 'f1', title: 'Quiz', tokenIds: { facebook: 't1' }, utmifyPixelId: null };
    expect(codes(diagnoseTracking(ctx))).toEqual(expect.arrayContaining(['funnel_events_by_design', 'funnel_utmify_missing']));
  });
});

describe('sortFindings', () => {
  it('is stable inside a severity', () => {
    const f = (code: string, severity: 'info' | 'ok') => ({ severity, code, title: code, detail: '', fix: '' });
    expect(sortFindings([f('a', 'ok'), f('b', 'info'), f('c', 'info')]).map((x) => x.code)).toEqual(['b', 'c', 'a']);
  });
});
