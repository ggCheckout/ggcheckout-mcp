// Turns explain_tracking and diagnose_tracking answers into what the tracking view draws. Pure.
// The answers come from src/core/tracking: the guide in pt-BR, the findings already sorted by the
// server; this keeps the order stable and adds labels, so a host that reorders never changes it.

import { count, finite, isPayload, text, type Payload } from '../lib/payload';
import { formatDateTime } from '../lib/format';

export type Severity = 'critical' | 'warning' | 'info' | 'ok';

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítico',
  warning: 'Atenção',
  info: 'Informação',
  ok: 'Tudo certo',
};

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, ok: 3 };

export const CHANNEL_LABEL: Record<string, string> = {
  facebook: 'Meta',
  tiktok: 'TikTok',
  google: 'Google Ads',
  utmify: 'UTMify',
};

const MODE_LABEL: Record<string, string> = {
  pixel: 'Só navegador (pixel)',
  events_api: 'Só servidor (API de eventos)',
  both: 'Navegador e servidor',
};

const PAYMENT_STATUS: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhou', cancelled: 'Cancelado', expired: 'Expirado',
  refunded: 'Reembolsado', chargeback: 'Chargeback',
};

export interface GuideModel {
  topic: string | null;
  sections: Array<{ id: string; title: string; summary: string; items: Array<{ title: string; body: string }> }>;
  problems: Array<{ symptom: string; causes: string[]; fixes: string[] }>;
}

export interface FindingModel {
  severity: Severity;
  severityLabel: string;
  code: string;
  title: string;
  detail: string;
  fix: string;
}

export interface TokenModel {
  id: string;
  title: string;
  channelLabel: string;
  modeLabel: string;
  statusLabel: string;
  pixelId: string | null;
  health: { tone: 'ok' | 'warning' | 'critical' | 'unknown'; label: string; detail: string | null };
}

export interface PaymentModel {
  id: string;
  statusLabel: string;
  createdAt: string;
  utms: Array<[string, string]>;
  clickIds: Array<{ label: string; present: boolean }>;
  dispatch: Array<{ channelLabel: string; ok: boolean | null; event: string | null; failed: number | null; total: number | null }>;
}

export interface ErrorsModel {
  channelLabel: string;
  available: boolean;
  total: number;
  hours: number;
  subjects: Array<{ name: string; count: number; lastError: string | null }>;
}

export interface DiagnosisModel {
  scopeLabel: string;
  findings: FindingModel[];
  counts: Record<Severity, number>;
  tokens: TokenModel[];
  payment: PaymentModel | null;
  errors: ErrorsModel[];
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter((s): s is string => s !== null) : []);

/** An explain_tracking answer; null for anything else. */
export function summarizeGuide(data: unknown): GuideModel | null {
  if (!isPayload(data) || !Array.isArray(data.sections) || !Array.isArray(data.problems)) return null;
  return {
    topic: text(data.topic),
    sections: data.sections.filter(isPayload).map((s) => ({
      id: text(s.id) ?? '',
      title: text(s.title) ?? '',
      summary: text(s.summary) ?? '',
      items: (Array.isArray(s.items) ? s.items : []).filter(isPayload).map((i) => ({ title: text(i.title) ?? '', body: text(i.body) ?? '' })),
    })),
    problems: data.problems.filter(isPayload).map((p) => ({ symptom: text(p.symptom) ?? '', causes: strings(p.causes), fixes: strings(p.fixes) })),
  };
}

const isSeverity = (value: unknown): value is Severity => typeof value === 'string' && value in RANK;

function scopeLabel(scope: Payload): string {
  const title = text(scope.title);
  switch (scope.kind) {
    case 'checkout': return title ? `Checkout ${title}` : 'Checkout';
    case 'funnel': return title ? `Funil ${title}` : 'Funil';
    case 'payment': return 'Pagamento';
    default: return 'Visão geral da conta';
  }
}

function toToken(raw: Payload): TokenModel {
  const health = isPayload(raw.health) ? raw.health : null;
  const failures = health ? count(health.consecutiveFailures) : 0;
  const disabled = raw.status === 'disabled' || Boolean(health && text(health.disabledReason));
  let tone: TokenModel['health']['tone'] = 'unknown';
  let label = 'Saúde não informada';
  let detail: string | null = null;
  if (health) {
    detail = text(health.disabledReasonText) ?? text(health.disabledReason) ?? text(health.lastError);
    if (disabled) { tone = 'critical'; label = 'Desativado'; }
    else if (failures > 0) { tone = 'warning'; label = `${failures} ${failures === 1 ? 'falha seguida' : 'falhas seguidas'}`; }
    else { tone = 'ok'; label = 'Sem falhas'; }
  }
  const channel = text(raw.channel) ?? '';
  const mode = text(raw.trackingMode);
  return {
    id: text(raw.id) ?? '',
    title: text(raw.title) ?? text(raw.id) ?? 'Token',
    channelLabel: CHANNEL_LABEL[channel] ?? channel,
    modeLabel: mode ? MODE_LABEL[mode] ?? mode : '-',
    statusLabel: disabled ? 'Desativado' : raw.status === 'active' ? 'Ativo' : text(raw.status) ?? '-',
    pixelId: text(raw.pixelId),
    health: { tone, label, detail },
  };
}

function toPayment(raw: Payload): PaymentModel {
  const click = isPayload(raw.clickIds) ? raw.clickIds : {};
  const dispatch = isPayload(raw.dispatch) ? raw.dispatch : {};
  return {
    id: text(raw.id) ?? '',
    statusLabel: PAYMENT_STATUS[text(raw.status) ?? ''] ?? text(raw.status) ?? '-',
    createdAt: formatDateTime(text(raw.createdAt)),
    utms: Object.entries(isPayload(raw.utms) ? raw.utms : {}).filter((e): e is [string, string] => typeof e[1] === 'string'),
    clickIds: [['fbc', 'fbc (Meta)'], ['fbp', 'fbp (Meta)'], ['ttclid', 'ttclid (TikTok)'], ['ttp', 'ttp (TikTok)']]
      .map(([key, label]) => ({ label, present: click[key] === true })),
    dispatch: Object.entries(dispatch).filter(([, v]) => isPayload(v)).map(([channel, v]) => ({
      channelLabel: CHANNEL_LABEL[channel] ?? channel,
      ok: typeof v.ok === 'boolean' ? v.ok : null,
      event: text(v.event),
      failed: finite(v.failed),
      total: finite(v.total),
    })),
  };
}

function toErrors(channel: string, raw: Payload): ErrorsModel {
  return {
    channelLabel: CHANNEL_LABEL[channel] ?? channel,
    available: raw.available === true,
    total: count(raw.total),
    hours: count(raw.hours) || 24,
    subjects: (Array.isArray(raw.subjects) ? raw.subjects : []).filter(isPayload).map((s) => ({
      name: text(s.title) ?? text(s.code) ?? 'Sem nome',
      count: count(s.count),
      lastError: text(s.lastError),
    })),
  };
}

/** A diagnose_tracking answer; null for anything else. */
export function summarizeDiagnosis(data: unknown): DiagnosisModel | null {
  if (!isPayload(data) || !Array.isArray(data.findings) || !isPayload(data.scope)) return null;
  const findings = data.findings
    .filter(isPayload)
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => isSeverity(f.severity))
    .sort((a, b) => RANK[a.f.severity as Severity] - RANK[b.f.severity as Severity] || a.index - b.index)
    .map(({ f }): FindingModel => ({
      severity: f.severity as Severity,
      severityLabel: SEVERITY_LABEL[f.severity as Severity],
      code: text(f.code) ?? '',
      title: text(f.title) ?? '',
      detail: text(f.detail) ?? '',
      fix: text(f.fix) ?? '',
    }));
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0, ok: 0 };
  findings.forEach((f) => { counts[f.severity] += 1; });
  return {
    scopeLabel: scopeLabel(data.scope),
    findings,
    counts,
    tokens: (Array.isArray(data.tokens) ? data.tokens : []).filter(isPayload).map(toToken),
    payment: isPayload(data.payment) ? toPayment(data.payment) : null,
    errors: isPayload(data.errors)
      ? Object.entries(data.errors).filter((e): e is [string, Payload] => isPayload(e[1])).map(([c, v]) => toErrors(c, v))
      : [],
  };
}

/** "2 críticos, 1 atenção": what the header says before the list. */
export function countsLabel(counts: Record<Severity, number>): string {
  const parts: string[] = [];
  if (counts.critical) parts.push(`${counts.critical} ${counts.critical === 1 ? 'crítico' : 'críticos'}`);
  if (counts.warning) parts.push(`${counts.warning} ${counts.warning === 1 ? 'atenção' : 'atenções'}`);
  if (counts.info) parts.push(`${counts.info} ${counts.info === 1 ? 'informação' : 'informações'}`);
  return parts.length ? parts.join(', ') : 'Nenhum problema encontrado';
}
