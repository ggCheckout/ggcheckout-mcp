import { ChevronDown, CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import '../styles/dashboard.css';
import './tracking.css';
import type { Host, HostSnapshot } from '../host';
import { ViewHeader } from '../dashboard/parts';
import { Field } from '../lib/Field';
import {
  countsLabel, summarizeDiagnosis, summarizeGuide,
  type DiagnosisModel, type ErrorsModel, type FindingModel, type GuideModel, type PaymentModel, type Severity, type TokenModel,
} from './model';

const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  critical: OctagonAlert,
  warning: TriangleAlert,
  info: Info,
  ok: CircleCheck,
};

/** Icon and word together: the tone is never the only signal. */
function SeverityBadge({ severity, label }: { severity: Severity; label: string }) {
  const Icon = SEVERITY_ICON[severity];
  return <span className="trk-badge" data-tone={severity}><Icon size={14} aria-hidden />{label}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface trk-card">
      <h2 className="trk-h2">{title}</h2>
      {children}
    </section>
  );
}

/** The guide: one card per section, its items expandable. A single topic opens them all. */
function Guide({ guide }: { guide: GuideModel }) {
  const openAll = guide.topic !== null;
  return (
    <>
      {guide.sections.map((section) => (
        <Section key={section.id} title={section.title}>
          <p className="trk-summary">{section.summary}</p>
          <div className="trk-list">
            {section.items.map((item) => (
              <details key={item.title} className="trk-item" open={openAll}>
                <summary><span>{item.title}</span><ChevronDown size={16} aria-hidden /></summary>
                <p>{item.body}</p>
              </details>
            ))}
          </div>
        </Section>
      ))}
      {guide.problems.length > 0 && (
        <Section title="Problemas comuns">
          <div className="trk-list">
            {guide.problems.map((problem) => (
              <details key={problem.symptom} className="trk-item" open={openAll}>
                <summary><span>{problem.symptom}</span><ChevronDown size={16} aria-hidden /></summary>
                <div className="trk-problem">
                  <p className="trk-label">Causas possíveis</p>
                  <ul>{problem.causes.map((c) => <li key={c}>{c}</li>)}</ul>
                  <p className="trk-label">O que fazer</p>
                  <ul>{problem.fixes.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              </details>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** A finding: critical and warning start open, since they are what the seller came for. */
function Finding({ finding }: { finding: FindingModel }) {
  const open = finding.severity === 'critical' || finding.severity === 'warning';
  const hasBody = Boolean(finding.detail || finding.fix);
  return (
    <li className="trk-finding" data-tone={finding.severity}>
      <details open={open}>
        <summary>
          <SeverityBadge severity={finding.severity} label={finding.severityLabel} />
          <span className="trk-finding-title">{finding.title}</span>
          {hasBody && <ChevronDown size={16} aria-hidden />}
        </summary>
        {finding.detail && <p className="trk-detail">{finding.detail}</p>}
        {finding.fix && (
          <div className="trk-fix">
            <p className="trk-label">O que fazer</p>
            <p className="trk-fix-text">{finding.fix}</p>
          </div>
        )}
      </details>
    </li>
  );
}

function Tokens({ tokens }: { tokens: TokenModel[] }) {
  return (
    <Section title="Tokens de rastreio">
      <div className="trk-table-wrap">
        <table className="trk-table">
          <caption className="trk-sr">Tokens de rastreio, com modo e saúde</caption>
          <thead>
            <tr><th scope="col">Token</th><th scope="col">Canal</th><th scope="col">Modo</th><th scope="col">Pixel</th><th scope="col">Saúde</th></tr>
          </thead>
          <tbody>
            {tokens.map((token) => {
              const tone: Severity = token.health.tone === 'unknown' ? 'info' : token.health.tone;
              return (
                <tr key={token.id}>
                  <th scope="row">{token.title}</th>
                  <td>{token.channelLabel}</td>
                  <td>{token.modeLabel}</td>
                  <td className="mono">{token.pixelId ?? '-'}</td>
                  <td>
                    <SeverityBadge severity={tone} label={token.health.label} />
                    {token.health.detail && <span className="trk-note">{token.health.detail}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Payment({ payment }: { payment: PaymentModel }) {
  return (
    <Section title="Venda">
      <dl className="trk-facts">
        <Field label="Pagamento"><span className="mono">{payment.id}</span></Field>
        <Field label="Status">{payment.statusLabel}</Field>
        <Field label="Data">{payment.createdAt}</Field>
      </dl>
      <h3 className="trk-h3">UTMs</h3>
      {payment.utms.length ? (
        <div className="trk-table-wrap">
          <table className="trk-table">
            <caption className="trk-sr">UTMs guardadas na venda</caption>
            <thead><tr><th scope="col">Parâmetro</th><th scope="col">Valor</th></tr></thead>
            <tbody>
              {payment.utms.map(([key, value]) => <tr key={key}><th scope="row" className="mono">{key}</th><td>{value}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <p className="trk-empty">A venda não guardou nenhuma UTM.</p>}
      <h3 className="trk-h3">Identificadores de clique</h3>
      <ul className="trk-chips">
        {payment.clickIds.map((c) => (
          <li key={c.label} className="trk-chip" data-present={c.present}>{`${c.label}: ${c.present ? 'capturado' : 'ausente'}`}</li>
        ))}
      </ul>
      {payment.dispatch.length > 0 && (
        <>
          <h3 className="trk-h3">Envio dos eventos</h3>
          <ul className="trk-dispatch">
            {payment.dispatch.map((d) => (
              <li key={d.channelLabel}>
                <SeverityBadge severity={d.ok === false ? 'critical' : d.ok ? 'ok' : 'info'} label={d.ok === false ? 'Falhou' : d.ok ? 'Enviado' : 'Sem resultado'} />
                <span>{`${d.channelLabel}${d.event ? `, ${d.event}` : ''}${d.ok === false && d.total ? ` (${d.failed ?? '?'} de ${d.total})` : ''}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function Errors({ errors }: { errors: ErrorsModel[] }) {
  return (
    <Section title="Erros das últimas 24 horas">
      <ul className="trk-errors">
        {errors.map((e) => (
          <li key={e.channelLabel}>
            {!e.available
              ? <><SeverityBadge severity="info" label="Não disponível ainda" /><span>{e.channelLabel}</span></>
              : e.total === 0
                ? <><SeverityBadge severity="ok" label="Sem erros" /><span>{e.channelLabel}</span></>
                : (
                  <>
                    <SeverityBadge severity="warning" label={`${e.total} ${e.total === 1 ? 'erro' : 'erros'}`} />
                    <span>{`${e.channelLabel}: ${e.subjects.map((s) => `${s.name} (${s.count})`).join(', ')}`}</span>
                  </>
                )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Diagnosis({ diagnosis }: { diagnosis: DiagnosisModel }) {
  const { counts } = diagnosis;
  return (
    <>
      <p className="trk-scope">{diagnosis.scopeLabel}</p>
      <section className="surface trk-card" aria-label="Resultado">
        <p className="trk-counts" role="status">{countsLabel(counts)}</p>
        <ol className="trk-findings">
          {diagnosis.findings.map((finding) => <Finding key={finding.code} finding={finding} />)}
        </ol>
      </section>
      {diagnosis.tokens.length > 0 && <Tokens tokens={diagnosis.tokens} />}
      {diagnosis.payment && <Payment payment={diagnosis.payment} />}
      {diagnosis.errors.length > 0 && <Errors errors={diagnosis.errors} />}
    </>
  );
}

/** Tracking view for explain_tracking (the guide) and diagnose_tracking (the findings). */
export function TrackingView({ host, state }: { host: Host; state: HostSnapshot }) {
  const diagnosis = summarizeDiagnosis(state.payload);
  const guide = diagnosis ? null : summarizeGuide(state.payload);

  useEffect(() => {
    if (diagnosis) host.tellModel(`Diagnóstico de rastreamento (${diagnosis.scopeLabel}) aberto na tela do chat: ${countsLabel(diagnosis.counts)}.`);
    else if (guide) host.tellModel('Guia de rastreamento de métricas aberto na tela do chat.');
  }, [host, state.payload]);

  if (!diagnosis && !guide) return <p className="state" data-tone="error">A resposta não trouxe dados de rastreamento.</p>;
  return (
    <div className="dashboard tracking">
      <ViewHeader title={diagnosis ? 'Diagnóstico de rastreamento' : 'Como as métricas chegam'} />
      {diagnosis ? <Diagnosis diagnosis={diagnosis} /> : <Guide guide={guide!} />}
    </div>
  );
}
