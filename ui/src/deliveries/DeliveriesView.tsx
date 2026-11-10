import { Ban, Check, CheckCheck, Clock, Eye, Send, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import './deliveries.css';
import type { Host, HostSnapshot } from '../host';
import { parseDate } from '../lib/format';
import { statusBadge, summarizeDeliveries, summarizeResend, type Deliveries, type Delivery } from './model';

/** formatBrazilDateTime: dd/mm/yyyy hh:mm:ss in São Paulo. */
function brazilDateTime(iso: string | null): string {
  const date = parseDate(iso);
  return date ? date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(',', '') : '-';
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  pending: Clock, queued: Clock, sending: Send, sent: Check, delivered: CheckCheck, read: Eye, failed: X, permanent_failure: Ban,
};

function StatusBadge({ delivery }: { delivery: Delivery }) {
  const { tone, label, hint } = statusBadge(delivery);
  const Icon = STATUS_ICONS[delivery.status];
  return (
    <span className="dlv-badge" data-tone={tone} title={hint}>
      {Icon && <Icon size={12} aria-hidden />}
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="dlv-field">
      <span>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}

/** DeliveryCard, without the Sync button (that route has no tool). */
function DeliveryCard({ delivery }: { delivery: Delivery }) {
  return (
    <li className="dlv-card">
      <div className="dlv-card-head">
        <span className="dlv-type">{delivery.label}</span>
        <span className="dlv-provider">{delivery.provider === 'meta' ? 'API oficial' : 'Número conectado'}</span>
      </div>
      <div className="dlv-field">
        <span>Status:</span>
        <StatusBadge delivery={delivery} />
      </div>
      {delivery.unconfirmed && <p className="dlv-note">Enviado ao servidor, mas ainda não confirmado no dispositivo</p>}
      {delivery.phone && <Field label="Telefone:" value={delivery.phone} />}
      {delivery.sentAt && <Field label="Enviado:" value={brazilDateTime(delivery.sentAt)} />}
      {delivery.deliveredAt && <Field label="Entregue:" value={brazilDateTime(delivery.deliveredAt)} />}
      {delivery.readAt && <Field label="Lido:" value={brazilDateTime(delivery.readAt)} />}
      {delivery.retryCount > 0 && <Field label="Tentativas:" value={String(delivery.retryCount)} />}
      {delivery.error && (
        <div className="dlv-error">
          <p className="dlv-error-title">Erro:</p>
          <p>{delivery.error}</p>
        </div>
      )}
    </li>
  );
}

function SummaryRow({ label, mark, n, tone }: { label: string; mark: string; n: number; tone: string }) {
  if (n <= 0) return null;
  return (
    <div className="dlv-sum-row">
      <span>{label}</span>
      <span className="num" data-tone={tone}>{`${mark} ${n}`}</span>
    </div>
  );
}

/** "Dados do WhatsApp": the summary card and a card per message, with the resend behind a confirmation. */
function DeliveriesPanel({ host, data, canCallTools, notice }: { host: Host; data: Deliveries; canCallTools: boolean; notice?: string | null }) {
  const [state, setState] = useState(data);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(notice ? { ok: true, text: notice } : null);
  const { summary, deliveries } = state;
  const sentBefore = deliveries.length > 0;

  async function resend() {
    if (!state.paymentId || busy) return;
    setBusy(true);
    try {
      const result = summarizeResend(await host.callTool('resend_delivery', { paymentId: state.paymentId }));
      setMessage({ ok: result?.ok ?? true, text: result?.message ?? 'Mensagem WhatsApp reenviada com sucesso!' });
      const fresh = summarizeDeliveries(await host.callTool('get_delivery_status', { paymentId: state.paymentId }));
      if (fresh) setState(fresh);
      host.tellModel(`O vendedor reenviou pelo chat o WhatsApp do pagamento ${state.paymentId}.`);
    } catch (e) {
      const text = e instanceof Error ? e.message : '';
      setMessage({ ok: false, text: text || 'Não foi possível reenviar a mensagem WhatsApp.' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section className="surface dlv-panel">
      <h2 className="card-title">Dados do WhatsApp</h2>
      {deliveries.length ? (
        <>
          <div className="dlv-summary">
            <div className="dlv-sum-head">
              <span>Resumo WhatsApp:</span>
              <span className="mono">{`${summary.total} ${summary.total === 1 ? 'mensagem' : 'mensagens'}`}</span>
            </div>
            <div className="dlv-sum-grid">
              <SummaryRow label="Enviadas:" mark="✓" n={summary.sent} tone="green" />
              <SummaryRow label="Entregues:" mark="✓✓" n={summary.delivered} tone="green" />
              <SummaryRow label="Lidas:" mark="✓✓" n={summary.read} tone="blue" />
              <SummaryRow label="Pendentes:" mark="•" n={summary.pending} tone="yellow" />
              <SummaryRow label="Falharam:" mark="✗" n={summary.failed} tone="red" />
            </div>
          </div>
          <ul className="dlv-list">{deliveries.map((d) => <DeliveryCard key={d.id} delivery={d} />)}</ul>
        </>
      ) : (
        <div className="dlv-empty">
          <div className="dlv-field"><span>Status:</span><span>Não enviado</span></div>
          <p>Nenhuma mensagem WhatsApp foi enviada para este pagamento.</p>
        </div>
      )}
      {message && <p className="dlv-message" data-tone={message.ok ? 'ok' : 'error'} role="status">{message.text}</p>}
      {canCallTools && state.paymentId && (
        confirming ? (
          <div className="dlv-confirm">
            <p className="dlv-confirm-title">{sentBefore ? 'Confirmar Reenvio do WhatsApp' : 'Confirmar Envio do WhatsApp'}</p>
            <p>{sentBefore ? 'A mensagem com o produto já foi enviada anteriormente. Tem certeza que deseja reenviar via WhatsApp?' : 'Enviar produto via WhatsApp?'}</p>
            <div className="dlv-confirm-actions">
              <button type="button" className="dlv-cancel" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</button>
              <button type="button" className="cta" onClick={resend} disabled={busy}>{busy ? 'Reenviando...' : 'Confirmar'}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="cta dlv-resend" onClick={() => setConfirming(true)}>
            {sentBefore ? 'Reenviar WhatsApp do entregável' : 'Enviar WhatsApp do entregável'}
          </button>
        )
      )}
    </section>
  );
}

/** Deliveries view: get_delivery_status, and resend_delivery (the list is read again after it). */
export function DeliveriesView({ host, state }: { host: Host; state: HostSnapshot }) {
  const data = useMemo(() => summarizeDeliveries(state.payload), [state.payload]);
  const resent = useMemo(() => (data ? null : summarizeResend(state.payload)), [data, state.payload]);
  const paymentId = typeof state.args.paymentId === 'string' ? state.args.paymentId : null;
  const [after, setAfter] = useState<Deliveries | null>(null);

  useEffect(() => {
    if (data) host.tellModel(`Entregas do WhatsApp do pagamento ${data.paymentId ?? paymentId ?? ''} abertas na tela do chat.`.trim());
  }, [host, data, paymentId]);

  useEffect(() => {
    if (!resent || !paymentId || !state.canCallTools) return;
    host.callTool('get_delivery_status', { paymentId }).then((d) => setAfter(summarizeDeliveries(d))).catch(() => {});
  }, [host, resent, paymentId, state.canCallTools]);

  if (data) return <div className="dashboard deliveries"><DeliveriesPanel host={host} data={{ ...data, paymentId: data.paymentId ?? paymentId }} canCallTools={state.canCallTools} /></div>;
  if (resent) {
    return (
      <div className="dashboard deliveries">
        {after
          ? <DeliveriesPanel key="after" host={host} data={{ ...after, paymentId: after.paymentId ?? paymentId }} canCallTools={state.canCallTools} notice={resent.message} />
          : <section className="surface dlv-panel"><p className="dlv-message" data-tone={resent.ok ? 'ok' : 'error'}>{resent.message}</p></section>}
      </div>
    );
  }
  return <p className="state" data-tone="error">A resposta não trouxe entregas do WhatsApp.</p>;
}
