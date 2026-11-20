import { ChevronRight, Clock, MessageCircle, Power, PowerOff, Trash2, Workflow } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import '../chips/chips.css';
import './whatsapp-funnels.css';
import type { Host, HostSnapshot } from '../host';
import { BackButton } from '../lib/BackButton';
import { ConfirmPanel } from '../lib/ConfirmPanel';
import { messageOf } from '../lib/messageOf';
import { summarizeOperations } from '../operations/model';
import {
  TRIGGER_LABEL, applyStoreStyle, messageParts, sendWindowLabel, stepsLabel, summarizeFunnel, summarizeFunnels, toggleWords, triggerTakenBy, waitLabel,
  type FunnelDetail, type FunnelRow,
} from './model';

/** Operation names by id, read once; null until read (or when the read failed). */
type OperationNames = Readonly<Record<string, string>> | null;

/** The "Operação" column: a manual funnel names its operation, an automatic one goes by each product's. */
function operationLabel(funnel: FunnelRow, operations: OperationNames): string {
  if (funnel.trigger !== 'manual') return 'Pela operação do produto';
  if (!operations) return 'Operação não carregada';
  return (funnel.sessionId && operations[funnel.sessionId]) || 'Operação indisponível';
}

function State({ funnel }: { funnel: FunnelRow }) {
  return (
    <span className="ch-status" data-tone={funnel.isEnabled ? 'success' : undefined}>
      <span className="ch-dot" aria-hidden />{toggleWords(funnel).state}
    </span>
  );
}

/** A message as the customer reads it: the store's signature and coupon in, the event variables marked. */
function Bubble({ message }: { message: string }) {
  return (
    <p className="wf-bubble">
      {messageParts(message).map((part, i) => (part.isVariable ? <span key={i} className="wf-var">{part.text}</span> : part.text))}
    </p>
  );
}

/** FunnelDetailPage, read-only: the funnel's settings, its messages in order, on/off and delete behind a confirmation. */
function FunnelDetailCard({ host, first, operations, siblings, canCallTools, onBack, onChange, onDeleted }: {
  host: Host; first: FunnelDetail; operations: OperationNames; siblings: readonly FunnelRow[] | null; canCallTools: boolean;
  onBack?: () => void; onChange?: (funnel: FunnelDetail) => void; onDeleted?: (id: string) => void;
}) {
  const [funnel, setFunnelState] = useState(first);
  const setFunnel = useCallback((next: FunnelDetail) => {
    setFunnelState(next);
    onChange?.(next);
  }, [onChange]);
  const [confirming, setConfirming] = useState<'toggle' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleted, setDeleted] = useState(false);
  const taken = siblings ? triggerTakenBy(funnel, siblings) : null;
  const words = toggleWords(funnel);

  async function toggle() {
    const enabled = !funnel.isEnabled;
    setBusy(true);
    setError(null);
    try {
      const answer = await host.callTool('toggle_whatsapp_funnel', { funnelId: funnel.id, enabled });
      setFunnel(summarizeFunnel(answer) ?? { ...funnel, isEnabled: enabled });
      host.tellModel(`Na tela do chat, o funil ${funnel.name} foi ${enabled ? 'ligado' : 'desligado'}.`);
    } catch (e) {
      // ApiError says "API Error (409): …" when another funnel already holds the trigger.
      setError(/\(409\)/.test(messageOf(e))
        ? `Já há outro funil ligado para ${TRIGGER_LABEL[funnel.trigger]}. Desligue aquele primeiro.`
        : 'Não foi possível mudar o funil. Tente de novo em alguns segundos.');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await host.callTool('delete_whatsapp_funnel', { funnelId: funnel.id });
      host.tellModel(`Na tela do chat, o funil ${funnel.name} foi excluído.`);
      setDeleted(true);
      onDeleted?.(funnel.id);
    } catch {
      setError('Não foi possível excluir o funil. Tente de novo em alguns segundos.');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  if (isDeleted) {
    return (
      <section className="surface ch-card">
        {onBack && <BackButton onBack={onBack} label="Voltar aos funis" />}
        <p className="ch-note">Funil {funnel.name} excluído.</p>
      </section>
    );
  }

  const toggleMessage = funnel.isEnabled
    ? (funnel.trigger === 'manual'
      ? 'O funil sai da lista da caixa de entrada. Quem já está nele para de receber as próximas mensagens.'
      : 'Quem estava no funil para de receber mensagens, e o evento deixa de abrir o funil.')
    : (funnel.trigger === 'manual'
      ? 'O funil passa a aparecer na caixa de entrada, para rodar numa conversa.'
      : `O funil começa a enviar sozinho no próximo evento: ${TRIGGER_LABEL[funnel.trigger].toLowerCase()}.`);
  return (
    <div className="ch-detail">
      {onBack && <BackButton onBack={onBack} label="Voltar aos funis" />}
      <section className="surface ch-card">
        <header className="ch-head">
          <span className="ch-icon big" aria-hidden><Workflow size={20} /></span>
          <div className="ch-head-main">
            <h2 className="ch-name">{funnel.name}</h2>
            <p className="ch-sub"><span>{TRIGGER_LABEL[funnel.trigger]}</span><State funnel={funnel} /></p>
          </div>
          {canCallTools && !confirming && (
            <div className="ch-actions">
              <button type="button" className="ch-ghost" onClick={() => setConfirming('toggle')} disabled={busy || Boolean(taken)}>
                {funnel.isEnabled ? <PowerOff size={14} aria-hidden /> : <Power size={14} aria-hidden />}{words.action}
              </button>
              <button type="button" className="ch-ghost wf-danger" onClick={() => setConfirming('delete')} disabled={busy}>
                <Trash2 size={14} aria-hidden />Excluir
              </button>
            </div>
          )}
        </header>
        {taken && (
          <p className="ch-note">Já há um funil ligado para {TRIGGER_LABEL[funnel.trigger]}: {taken.name}. Desligue aquele para ligar este.</p>
        )}
        {confirming === 'toggle' && (
          <ConfirmPanel label={words.action} tone={funnel.isEnabled ? 'warning' : undefined} message={toggleMessage}
            confirmLabel={words.action} busyLabel="Salvando…" busy={busy} onConfirm={toggle} onCancel={() => setConfirming(null)} />
        )}
        {confirming === 'delete' && (
          <ConfirmPanel label="Excluir funil?" tone="warning" title="Excluir funil?"
            message="Os clientes que estão no funil param de receber as próximas mensagens. Não dá para desfazer."
            confirmLabel="Excluir funil" busyLabel="Excluindo…" busy={busy} onConfirm={remove} onCancel={() => setConfirming(null)} />
        )}
        {error && <p className="ch-alert" role="alert">{error}</p>}
        <ul className="ch-uses wf-facts">
          <li><span>Quando começa</span><span>{TRIGGER_LABEL[funnel.trigger]}</span></li>
          <li><span>Operação</span><span>{operationLabel(funnel, operations)}</span></li>
          <li><span>Horário</span><span>{sendWindowLabel(funnel.sendWindow)}</span></li>
          <li><span>Quando o cliente responde</span><span>{funnel.stopOnReply ? 'Para o funil' : 'Continua o funil'}</span></li>
          {funnel.style.signature.trim() && <li><span>Assinatura</span><span>{funnel.style.signature.trim()}</span></li>}
          {funnel.style.coupon.trim() && <li><span>Cupom</span><span className="mono">{funnel.style.coupon.trim()}</span></li>}
        </ul>
        <section className="ch-panel">
          <h3 className="ch-panel-title">Mensagens</h3>
          <p className="ch-hint">Na ordem em que saem. O funil para quando o cliente compra{funnel.stopOnReply ? ' ou responde' : ''}.</p>
          <ol className="wf-steps">
            {funnel.steps.map((step, i) => (
              <li key={i} className="wf-step">
                <span className="wf-wait"><Clock size={13} aria-hidden />{waitLabel(step, i, funnel.trigger)}</span>
                <Bubble message={applyStoreStyle(step.text, funnel.style)} />
              </li>
            ))}
          </ol>
        </section>
        <p className="ch-hint">Para mudar as mensagens, peça aqui no chat ou edite no painel, em WhatsApp &gt; Funis.</p>
      </section>
    </div>
  );
}

/** FunnelsSection, as rows: name and messages, when it starts, the operation and the state. */
function FunnelsList({ funnels, operations, canOpen, busyId, onOpen, hasMore, loadingMore, onMore }: {
  funnels: FunnelRow[]; operations: OperationNames; canOpen: boolean; busyId: string | null; onOpen: (funnel: FunnelRow) => void;
  hasMore: boolean; loadingMore: boolean; onMore: () => void;
}) {
  return (
    <section className="surface ch-card">
      <header className="ch-list-head">
        <h2 className="card-title">Seus funis</h2>
        <p className="card-sub">Com funil ligado para um evento, só ele manda mensagem nesse evento; a régua antiga do mesmo evento fica parada.</p>
      </header>
      {funnels.length ? (
        <ul className="ch-rows">
          {funnels.map((f) => {
            const body = (
              <>
                <span className="ch-icon" aria-hidden><MessageCircle size={16} /></span>
                <span className="ch-row-main">
                  <span className="ch-row-name">{f.name}</span>
                  <span className="ch-sub"><span>{TRIGGER_LABEL[f.trigger]}</span><span>{stepsLabel(f.stepCount)}</span></span>
                </span>
                <span className="ch-row-side">
                  <State funnel={f} />
                  <span className="ch-count">{operationLabel(f, operations)}</span>
                </span>
                {canOpen && <ChevronRight size={16} className="ch-chevron" aria-hidden />}
              </>
            );
            return (
              <li key={f.id} className="ch-row" aria-busy={busyId === f.id || undefined}>
                {canOpen
                  ? <button type="button" className="ch-row-btn" onClick={() => onOpen(f)} aria-label={`Abrir o funil ${f.name}`}>{body}</button>
                  : <div className="ch-row-btn">{body}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="wf-empty">
          <MessageCircle size={22} aria-hidden />
          <p className="wf-empty-title">Nenhum funil criado</p>
          <p className="ch-hint">Crie o primeiro para recuperar vendas com mensagens que param quando o cliente compra ou responde. Peça aqui no chat ou crie no painel.</p>
        </div>
      )}
      {hasMore && canOpen && (
        <button type="button" className="ch-ghost wf-more" onClick={onMore} disabled={loadingMore}>{loadingMore ? 'Carregando…' : 'Carregar mais funis'}</button>
      )}
    </section>
  );
}

/** WhatsApp funnels view: list_whatsapp_funnels and get_whatsapp_funnel. */
export function WhatsAppFunnelsView({ host, state }: { host: Host; state: HostSnapshot }) {
  const parts = useMemo(() => {
    const funnel = summarizeFunnel(state.payload);
    return { funnel, page: funnel ? null : summarizeFunnels(state.payload) };
  }, [state.payload]);
  const [operations, setOperations] = useState<OperationNames>(null);
  const [list, setList] = useState<FunnelRow[] | null>(null);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<FunnelDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setList(parts.page?.funnels ?? null);
    setNextAfter(parts.page?.nextAfter ?? null);
  }, [parts.page]);

  // Operation names for the "Operação" column; a detail alone also reads the first page of funnels,
  // so it can say which funnel already holds its trigger.
  useEffect(() => {
    if (!state.canCallTools) return;
    host.callTool('list_whatsapp_sessions', {})
      .then((data) => setOperations(Object.fromEntries((summarizeOperations(data) ?? []).map((o) => [o.id, o.name]))))
      .catch(() => setOperations(null));
    if (parts.funnel) {
      host.callTool('list_whatsapp_funnels', {}).then((data) => setList(summarizeFunnels(data)?.funnels ?? null)).catch(() => setList(null));
    }
  }, [host, state.canCallTools, parts.funnel]);

  useEffect(() => {
    if (parts.funnel) host.tellModel(`Funil ${parts.funnel.name} aberto na tela do chat.`);
    else if (parts.page) host.tellModel('Lista de funis do WhatsApp aberta na tela do chat.');
  }, [host, parts]);

  async function openFunnel(row: FunnelRow) {
    setBusyId(row.id);
    setLoadError(null);
    try {
      const full = summarizeFunnel(await host.callTool('get_whatsapp_funnel', { funnelId: row.id }));
      if (!full) throw new Error('no funnel');
      setOpen(full);
    } catch {
      setLoadError('Não foi possível carregar o funil. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    if (!nextAfter) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = summarizeFunnels(await host.callTool('list_whatsapp_funnels', { after: nextAfter }));
      if (!page) throw new Error('no page');
      setList((cur) => [...(cur ?? []), ...page.funnels.filter((f) => !(cur ?? []).some((c) => c.id === f.id))]);
      setNextAfter(page.nextAfter);
    } catch {
      setLoadError('Não foi possível carregar mais funis. Tente novamente.');
    } finally {
      setLoadingMore(false);
    }
  }

  /** A funnel changed in the detail replaces its row, so "Voltar" shows it as it is now. */
  const replace = useCallback((next: FunnelDetail) => {
    setList((cur) => cur && cur.map((f) => (f.id === next.id ? { ...f, isEnabled: next.isEnabled, name: next.name } : f)));
  }, []);
  const drop = useCallback((id: string) => setList((cur) => cur && cur.filter((f) => f.id !== id)), []);

  if (!parts.funnel && !parts.page) return <p className="state" data-tone="error">A resposta não trouxe funis do WhatsApp.</p>;
  return (
    <div className="dashboard chips">
      {loadError && <p className="ch-alert" role="alert">{loadError}</p>}
      {parts.funnel && (
        <FunnelDetailCard host={host} first={parts.funnel} operations={operations} siblings={list} canCallTools={state.canCallTools}
          onChange={replace} onDeleted={drop} />
      )}
      {parts.page && (
        <>
          {open && (
            <FunnelDetailCard key={open.id} host={host} first={open} operations={operations} siblings={list} canCallTools={state.canCallTools}
              onBack={() => setOpen(null)} onChange={replace} onDeleted={drop} />
          )}
          <div hidden={Boolean(open)}>
            <FunnelsList funnels={list ?? parts.page.funnels} operations={operations} canOpen={state.canCallTools} busyId={busyId}
              onOpen={openFunnel} hasMore={Boolean(nextAfter)} loadingMore={loadingMore} onMore={loadMore} />
          </div>
        </>
      )}
    </div>
  );
}
