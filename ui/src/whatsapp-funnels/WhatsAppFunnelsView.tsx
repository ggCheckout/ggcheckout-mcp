import { ChevronRight, MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import '../chips/chips.css';
import './whatsapp-funnels.css';
import type { Host, HostSnapshot } from '../host';
import { summarizeOperations, type Operation } from '../operations/model';
import { ENABLE_FAILED, createFunnel, listAllFunnels, readFunnel } from './funnelCalls';
import { modelInput, newDraft, type FunnelModel } from './editor';
import { FunnelEditor, type EditorStart } from './FunnelEditor';
import { FunnelStarter, modelTaken } from './FunnelStarter';
import { TRIGGER_LABEL, stepsLabel, summarizeFunnel, summarizeFunnels, toggleWords, type FunnelDetail, type FunnelRow } from './model';

/** Operation names by id, read once; null until read (or when the read failed). */
type OperationNames = Readonly<Record<string, string>> | null;

/** What the funnels view shows on top of the list. */
type Screen = { kind: 'list' } | { kind: 'starter' } | { kind: 'editor'; start: EditorStart };

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

/** FunnelsSection, as rows: name and messages, when it starts, the operation and the state. */
function FunnelsList({ funnels, operations, canOpen, busyId, onOpen, hasMore, loadingMore, onMore, refreshing, onRefresh, onCreate }: {
  funnels: FunnelRow[]; operations: OperationNames; canOpen: boolean; busyId: string | null; onOpen: (funnel: FunnelRow) => void;
  hasMore: boolean; loadingMore: boolean; onMore: () => void; refreshing: boolean; onRefresh: () => void; onCreate: () => void;
}) {
  return (
    <section className="surface ch-card">
      <header className="ch-list-head fe-list-head">
        <div>
          <h2 className="card-title">Seus funis</h2>
          <p className="card-sub">Com funil ligado para um evento, só ele manda mensagem nesse evento; a régua antiga do mesmo evento fica parada.</p>
        </div>
        {canOpen && (
          <div className="fe-actions">
            <button type="button" className="ch-ghost" onClick={onRefresh} disabled={refreshing || loadingMore}>
              <RefreshCw size={14} aria-hidden className={refreshing ? 'fe-spin' : undefined} />{refreshing ? 'Atualizando…' : 'Atualizar'}
            </button>
            <button type="button" className="cta compact" onClick={onCreate}><Plus size={15} aria-hidden />Novo funil</button>
          </div>
        )}
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
          <p className="ch-hint">Crie o primeiro para recuperar vendas com mensagens que param quando o cliente compra ou responde.</p>
        </div>
      )}
      {hasMore && canOpen && (
        <button type="button" className="ch-ghost wf-more" onClick={onMore} disabled={loadingMore || refreshing}>{loadingMore ? 'Carregando…' : 'Carregar mais funis'}</button>
      )}
    </section>
  );
}

/** WhatsApp funnels view: list_whatsapp_funnels and get_whatsapp_funnel, with the editor and "Novo funil". */
export function WhatsAppFunnelsView({ host, state }: { host: Host; state: HostSnapshot }) {
  const parts = useMemo(() => {
    const funnel = summarizeFunnel(state.payload);
    return { funnel, page: funnel ? null : summarizeFunnels(state.payload) };
  }, [state.payload]);
  /** undefined while reading, null when the read failed. */
  const [operations, setOperations] = useState<Operation[] | null | undefined>(undefined);
  const [list, setList] = useState<FunnelRow[] | null>(null);
  /**
   * Every funnel (up to the saas page cap), to say which one holds a trigger: the list shows only the
   * pages loaded so far, and the funnel holding a trigger can sit on a later one.
   */
  const [occupants, setOccupants] = useState<FunnelRow[] | null>(null);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [starterError, setStarterError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setList(parts.page?.funnels ?? null);
    setNextAfter(parts.page?.nextAfter ?? null);
  }, [parts.page]);

  // The operations (names for the "Operação" column, choices of a manual funnel) and every funnel, so
  // the editor and the models can say which funnel already holds a trigger.
  useEffect(() => {
    if (!state.canCallTools) return;
    host.callTool('list_whatsapp_sessions', {}).then((data) => setOperations(summarizeOperations(data))).catch(() => setOperations(null));
    listAllFunnels(host).then((all) => setOccupants(all?.funnels ?? null)).catch(() => setOccupants(null));
  }, [host, state.canCallTools]);

  useEffect(() => {
    if (parts.funnel) host.tellModel(`Funil ${parts.funnel.name} aberto na tela do chat.`);
    else if (parts.page) host.tellModel('Lista de funis do WhatsApp aberta na tela do chat.');
  }, [host, parts]);

  const names: OperationNames = useMemo(() => (operations ? Object.fromEntries(operations.map((o) => [o.id, o.name])) : null), [operations]);
  const choices = useMemo(() => (operations ? operations.map((o) => [o.id, o.name] as const) : operations), [operations]);
  const firstOperation = operations?.[0]?.id ?? null;

  async function openFunnel(row: FunnelRow) {
    setBusyId(row.id);
    setLoadError(null);
    setNotice(null);
    try {
      setScreen({ kind: 'editor', start: { kind: 'stored', funnel: await readFunnel(host, row.id) } });
    } catch {
      setLoadError('Não foi possível carregar o funil. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  }

  // "Carregar mais" and "Atualizar" never run together: a late page would append to the list the other
  // one replaced and leave a cursor that no longer follows it.
  async function loadMore() {
    if (!nextAfter || loadingMore || refreshing) return;
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

  async function refresh() {
    if (loadingMore || refreshing) return;
    setRefreshing(true);
    setLoadError(null);
    try {
      const page = summarizeFunnels(await host.callTool('list_whatsapp_funnels', {}));
      if (!page) throw new Error('no page');
      setList(page.funnels);
      setNextAfter(page.nextAfter);
    } catch {
      setLoadError('Não foi possível ler seus funis agora. Isso não quer dizer que não existem.');
    } finally {
      setRefreshing(false);
    }
  }

  async function createFromModel(model: FunnelModel) {
    setCreating(true);
    setStarterError(null);
    try {
      const { funnel, enableFailed } = await createFunnel(host, modelInput(model, firstOperation), modelTaken(model, occupants ?? list));
      replace(funnel);
      setNotice(enableFailed ? ENABLE_FAILED : null);
      host.tellModel(`Na tela do chat, o funil ${funnel.name} foi criado do modelo${funnel.isEnabled ? ' e ligado' : ', desligado'}.`);
      setScreen({ kind: 'editor', start: { kind: 'stored', funnel } });
    } catch {
      setStarterError('Não foi possível criar o funil. Tente de novo em alguns segundos.');
    } finally {
      setCreating(false);
    }
  }

  /** A funnel created or changed in the editor takes its row (a new one goes on top), so "Voltar" shows it as it is now. */
  const replace = useCallback((next: FunnelDetail) => {
    const row: FunnelRow = { id: next.id, name: next.name, trigger: next.trigger, isEnabled: next.isEnabled, stepCount: next.steps.length, sessionId: next.sessionId };
    const put = (cur: FunnelRow[] | null): FunnelRow[] | null => (cur
      ? (cur.some((f) => f.id === next.id) ? cur.map((f) => (f.id === next.id ? row : f)) : [row, ...cur])
      : cur);
    setList(put);
    setOccupants(put);
  }, []);
  const drop = useCallback((id: string) => {
    const without = (cur: FunnelRow[] | null): FunnelRow[] | null => cur && cur.filter((f) => f.id !== id);
    setList(without);
    setOccupants(without);
  }, []);
  const toList = () => {
    setScreen({ kind: 'list' });
    setNotice(null);
  };

  if (!parts.funnel && !parts.page) return <p className="state" data-tone="error">A resposta não trouxe funis do WhatsApp.</p>;
  const editorProps = { host, operations: choices, siblings: occupants ?? list, canCallTools: state.canCallTools, onSaved: replace, onDeleted: drop };
  return (
    <div className="dashboard chips">
      {loadError && <p className="ch-alert" role="alert">{loadError}</p>}
      {notice && <p className="ch-alert" role="alert">{notice}</p>}
      {parts.funnel && <FunnelEditor {...editorProps} start={{ kind: 'stored', funnel: parts.funnel }} />}
      {parts.page && (
        <>
          {screen.kind === 'starter' && (
            <FunnelStarter siblings={occupants ?? list} operations={choices} busy={creating} error={starterError} onUseModel={createFromModel}
              onBlank={() => setScreen({ kind: 'editor', start: { kind: 'new', draft: newDraft(firstOperation) } })} onCancel={toList} />
          )}
          {screen.kind === 'editor' && (
            <FunnelEditor key={screen.start.kind === 'stored' ? screen.start.funnel.id : 'new'} {...editorProps} start={screen.start} onBack={toList} />
          )}
          <div hidden={screen.kind !== 'list'}>
            <FunnelsList funnels={list ?? parts.page.funnels} operations={names} canOpen={state.canCallTools} busyId={busyId}
              onOpen={openFunnel} hasMore={Boolean(nextAfter)} loadingMore={loadingMore} onMore={loadMore}
              refreshing={refreshing} onRefresh={refresh} onCreate={() => { setStarterError(null); setScreen({ kind: 'starter' }); }} />
          </div>
        </>
      )}
    </div>
  );
}
