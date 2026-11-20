import { ArrowDown, ArrowUp, ChevronRight, Layers, Package, Plus, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import '../chips/chips.css';
import './operations.css';
import type { Host, HostSnapshot } from '../host';
import { BackButton } from '../lib/BackButton';
import { ConfirmPanel } from '../lib/ConfirmPanel';
import { plural } from '../lib/format';
import { Status } from '../chips/ChipsView';
import { phoneLabel, summarizeChips, type Chip } from '../chips/model';
import {
  HEALTH_LABEL, HEALTH_TONE, MAX_CHIPS, chipOrder, moveChip, operationHealth, slotLabel, summarizeOperation, summarizeOperations, summarizeProducts, unchangedSince,
  type Operation, type ProductOption,
} from './model';

type ChipsById = ReadonlyMap<string, Chip>;

/** A chip the account no longer has (or that could not be read) still holds its slot. */
const chipName = (chips: ChipsById | null, id: string): string => chips?.get(id)?.name ?? 'Chip indisponível';

/** SessionHealthStatus: the operation's state in the dashboard's words; nothing while the chips are unknown. */
function Health({ op, chips }: { op: Operation; chips: ChipsById | null }) {
  if (!chips) return null;
  const health = operationHealth(op, chips);
  return <span className="ch-status" data-tone={HEALTH_TONE[health]}><span className="ch-dot" aria-hidden />{HEALTH_LABEL[health]}</span>;
}

/** A write waiting for its "yes": what it sends, what it says, and the operation it should leave. */
interface Pending {
  label: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  tone?: 'warning';
  tool: 'update_whatsapp_session' | 'add_whatsapp_session_number' | 'remove_whatsapp_session_number' | 'set_whatsapp_session_products';
  args: Record<string, unknown>;
  expected: Operation;
  /** What the model is told once it is done. */
  done: string;
  failed: string;
}

/** ChipSlots: the chips in the order they send, moved with arrows (a drag is awkward inside the chat). */
function ChipSlots({ op, chips, canEdit, busy, onMove, onRemove, onAdd }: {
  op: Operation; chips: ChipsById | null; canEdit: boolean; busy: boolean;
  onMove: (index: number, delta: -1 | 1) => void; onRemove: (index: number) => void; onAdd: () => void;
}) {
  const full = op.chipIds.length >= MAX_CHIPS;
  return (
    <section className="ch-panel">
      <h3 className="ch-panel-title">Chips da operação</h3>
      <p className="ch-hint">O principal envia; as reservas assumem se ele cair, na ordem abaixo.</p>
      <ol className="op-slots">
        {op.chipIds.map((id, index) => {
          const chip = chips?.get(id);
          const name = chipName(chips, id);
          return (
            <li key={`${id}-${index}`} className="op-slot">
              <span className="op-slot-tag" data-primary={index === 0 || undefined}>{slotLabel(index)}</span>
              <span className="op-slot-main">
                <span className="op-slot-name">{name}</span>
                {chip && <span className="ch-sub"><span className="num">{phoneLabel(chip.phone)}</span><Status chip={chip} /></span>}
              </span>
              {canEdit && (
                <span className="op-slot-actions">
                  <button type="button" className="op-icon" onClick={() => onMove(index, -1)} disabled={busy || index === 0}
                    aria-label={index === 1 ? `Promover ${name} a principal` : `Subir ${name}`} title={index === 1 ? 'Promover a principal' : 'Subir'}>
                    <ArrowUp size={15} aria-hidden />
                  </button>
                  <button type="button" className="op-icon" onClick={() => onMove(index, 1)} disabled={busy || index === op.chipIds.length - 1}
                    aria-label={`Descer ${name}`} title="Descer">
                    <ArrowDown size={15} aria-hidden />
                  </button>
                  <button type="button" className="op-icon" data-danger onClick={() => onRemove(index)} disabled={busy || op.chipIds.length === 1}
                    aria-label={`Remover ${name} da operação`} title={op.chipIds.length === 1 ? 'A operação precisa de pelo menos o chip principal' : 'Remover'}>
                    <Trash2 size={15} aria-hidden />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {canEdit && (full
        ? <p className="ch-hint">Limite de {MAX_CHIPS} chips por operação.</p>
        : <button type="button" className="cta op-add" onClick={onAdd} disabled={busy}><Plus size={15} aria-hidden />Adicionar chip</button>)}
      {op.chipIds.length === 1 && <p className="ch-hint">A operação precisa de pelo menos o chip principal.</p>}
    </section>
  );
}

/** The chips that can join: every chip of the account not already in the operation. */
function ChipPicker({ op, chips, chipsFailed, onPick, onCancel }: {
  op: Operation; chips: ChipsById | null; chipsFailed: boolean; onPick: (chip: Chip) => void; onCancel: () => void;
}) {
  // A chip marked for removal is out of every choice, as in the dashboard.
  const free = chips ? [...chips.values()].filter((c) => !op.chipIds.includes(c.id) && !c.removalAt) : null;
  return (
    <section className="ch-panel">
      <h3 className="ch-panel-title">Escolha um chip</h3>
      <p className="ch-hint">Ele entra como {slotLabel(op.chipIds.length)}.</p>
      {free === null && (chipsFailed
        ? <p className="ch-alert" role="alert">Não foi possível carregar os chips. Tente novamente.</p>
        : <p className="ch-hint" role="status">Carregando os chips…</p>)}
      {free?.length === 0 && <p className="ch-note">Todos os seus chips já estão nesta operação.</p>}
      {free && free.length > 0 && (
        <ul className="ch-rows">
          {free.map((c) => (
            <li key={c.id} className="ch-row">
              <button type="button" className="ch-row-btn" onClick={() => onPick(c)} aria-label={`Adicionar o chip ${c.name}`}>
                <span className="ch-icon" aria-hidden><Smartphone size={16} /></span>
                <span className="ch-row-main">
                  <span className="ch-row-name">{c.name}</span>
                  <span className="ch-sub"><span className="num">{phoneLabel(c.phone)}</span><Status chip={c} /></span>
                </span>
                <Plus size={16} className="ch-chevron" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ch-ghost op-cancel" onClick={onCancel}>Cancelar</button>
    </section>
  );
}

/** ProductPickerDialog, in place: the products not in the operation yet, with a search. */
function ProductPicker({ products, assigned, onSave, onCancel }: {
  /** undefined while list_products is read, null when it failed. */
  products: ProductOption[] | null | undefined; assigned: readonly string[]; onSave: (ids: string[]) => void; onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const free = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    return (products ?? []).filter((p) => !assigned.includes(p.id) && (!q || p.title.toLocaleLowerCase('pt-BR').includes(q)));
  }, [products, assigned, query]);
  const toggle = (id: string) => setPicked((cur) => {
    const next = new Set(cur);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  return (
    <section className="ch-panel">
      <h3 className="ch-panel-title">Adicionar produtos</h3>
      {products === undefined && <p className="ch-hint" role="status">Carregando os produtos…</p>}
      {products === null && <p className="ch-alert" role="alert">Não foi possível carregar os produtos.</p>}
      {products && (
          <>
            <input className="ch-input" type="search" placeholder="Buscar produto…" aria-label="Buscar produto" value={query} onChange={(e) => setQuery(e.target.value)} />
            {free.length === 0
              ? <p className="ch-note">Nenhum produto encontrado.</p>
              : (
                <ul className="op-picks">
                  {free.map((p) => (
                    <li key={p.id}>
                      <label className="op-pick">
                        <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                        <span>{p.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
          </>
        )}
      <div className="op-picker-actions">
        <button type="button" className="ch-ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="cta" disabled={picked.size === 0} onClick={() => onSave([...picked])}>
          {picked.size ? `Adicionar ${plural(picked.size, 'produto', 'produtos')}` : 'Adicionar'}
        </button>
      </div>
    </section>
  );
}

/** "Produtos atendidos": the products whose messages leave through this operation. */
function Products({ op, titleOf, canEdit, busy, onRemove, onAdd }: {
  op: Operation; titleOf: (id: string) => string; canEdit: boolean; busy: boolean; onRemove: (id: string) => void; onAdd: () => void;
}) {
  return (
    <section className="ch-panel">
      <div className="op-panel-head">
        <h3 className="ch-panel-title">Produtos atendidos</h3>
        {canEdit && <button type="button" className="cta op-add-sm" onClick={onAdd} disabled={busy}><Plus size={14} aria-hidden />Adicionar</button>}
      </div>
      <p className="ch-hint">As mensagens destes produtos saem por esta operação. Estes produtos recebem os funis automáticos por estes chips.</p>
      {op.productIds.length === 0 ? (
        <div className="op-empty">
          <Package size={22} aria-hidden />
          <p className="op-empty-title">Nenhum produto atribuído</p>
          <p className="ch-hint">Adicione os produtos cujas mensagens devem sair por esta operação.</p>
        </div>
      ) : (
        <ul className="op-products">
          {op.productIds.map((id) => (
            <li key={id}>
              <span className="op-product-name">{titleOf(id)}</span>
              {canEdit && (
                <button type="button" className="op-icon" data-danger onClick={() => onRemove(id)} disabled={busy} aria-label={`Remover produto ${titleOf(id)}`} title="Remover">
                  <Trash2 size={15} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** SessionDetailPage: the chips in order and the products, every write behind a confirmation. */
function OperationDetail({ host, first, chips, chipsFailed, canCallTools, onBack, onChange }: {
  host: Host; first: Operation; chips: ChipsById | null; chipsFailed: boolean; canCallTools: boolean; onBack?: () => void; onChange?: (op: Operation) => void;
}) {
  const [op, setOpState] = useState(first);
  const setOp = useCallback((next: Operation) => {
    setOpState(next);
    onChange?.(next);
  }, [onChange]);
  const [products, setProducts] = useState<ProductOption[] | null | undefined>(undefined);
  const [picking, setPicking] = useState<'chip' | 'products' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The product titles: the operation stores only ids, as the dashboard's useUserProducts reads them.
  useEffect(() => {
    if (!canCallTools) return;
    host.callTool('list_products', {}).then((data) => setProducts(summarizeProducts(data))).catch(() => setProducts(null));
  }, [host, canCallTools]);

  const nameOf = (id: string) => chipName(chips, id);
  const titleOf = (id: string) => products?.find((p) => p.id === id)?.title ?? id;

  function askMove(index: number, delta: -1 | 1) {
    const next = moveChip(op.chipIds, index, delta);
    const order = next && chipOrder(next);
    if (!next || !order) return;
    const moved = op.chipIds[index];
    const other = op.chipIds[index + delta];
    const promotes = index + delta === 0 || index === 0;
    setPicking(null);
    setPending({
      label: 'Alterar a ordem dos chips',
      message: `${nameOf(moved)} vira ${slotLabel(index + delta)} e ${nameOf(other)} vira ${slotLabel(index)}.${promotes ? ' O principal é o chip que envia; as reservas só assumem se ele cair.' : ''}`,
      confirmLabel: 'Salvar ordem',
      busyLabel: 'Salvando…',
      tool: 'update_whatsapp_session',
      args: { ...order },
      expected: { ...op, chipIds: next },
      done: `Na tela do chat, a ordem dos chips da operação ${op.name} mudou: ${next.map(nameOf).join(' > ')}.`,
      failed: 'Não foi possível salvar os chips.',
    });
  }

  function askAdd(chip: Chip) {
    setPicking(null);
    setPending({
      label: 'Adicionar chip',
      message: `${chip.name} entra como ${slotLabel(op.chipIds.length)}: assume os envios se os chips antes dele caírem.`,
      confirmLabel: 'Adicionar chip',
      busyLabel: 'Adicionando…',
      tool: 'add_whatsapp_session_number',
      args: { numberId: chip.id },
      expected: { ...op, chipIds: [...op.chipIds, chip.id] },
      done: `Na tela do chat, o chip ${chip.name} entrou na operação ${op.name} como ${slotLabel(op.chipIds.length)}.`,
      failed: 'Não foi possível adicionar o chip.',
    });
  }

  function askRemove(index: number) {
    const id = op.chipIds[index];
    const rest = op.chipIds.filter((_, i) => i !== index);
    setPicking(null);
    setPending({
      label: 'Remover chip',
      tone: 'warning',
      message: index === 0
        ? `${nameOf(id)} sai da operação e ${nameOf(rest[0])} passa a ser o principal.`
        : `${nameOf(id)} sai da operação e deixa de ser reserva.`,
      confirmLabel: 'Remover chip',
      busyLabel: 'Removendo…',
      tool: 'remove_whatsapp_session_number',
      args: { numberId: id },
      expected: { ...op, chipIds: rest },
      done: `Na tela do chat, o chip ${nameOf(id)} saiu da operação ${op.name}.`,
      failed: 'Não foi possível remover o chip.',
    });
  }

  /** `added` are the titles being added; `removed` the title being removed (one at a time, as the dashboard does). */
  function askProducts(productIds: string[], change: { added: string[] } | { removed: string }) {
    const adding = 'added' in change;
    const what = adding ? (change.added.length === 1 ? change.added[0] : plural(change.added.length, 'produto', 'produtos')) : change.removed;
    setPicking(null);
    setPending({
      label: adding ? 'Adicionar produtos' : 'Remover produto',
      tone: adding ? undefined : 'warning',
      message: adding
        ? `As mensagens de ${what} passam a sair por esta operação, com os funis automáticos por estes chips.`
        : `As mensagens de ${what} deixam de sair por esta operação.`,
      confirmLabel: adding ? 'Adicionar' : 'Remover produto',
      busyLabel: 'Salvando…',
      tool: 'set_whatsapp_session_products',
      args: { productIds },
      expected: { ...op, productIds },
      done: `Na tela do chat, os produtos da operação ${op.name} mudaram: agora ${plural(productIds.length, 'produto', 'produtos')}.`,
      failed: 'Não foi possível salvar os produtos.',
    });
  }

  /**
   * Sends the confirmed write; the answer is the operation as it is now, else the expected one. The
   * operation is read first: the write replaces the whole order or product list, so it is refused
   * when the operation changed since this card showed it.
   */
  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = summarizeOperation(await host.callTool('get_whatsapp_session', { sessionId: op.id }));
      if (!fresh) throw new Error('no operation');
      if (!unchangedSince(op, fresh)) {
        setOp(fresh);
        setError('Esta operação mudou desde que foi aberta (no painel ou pelo assistente). Ela foi recarregada: confira e repita a alteração.');
        return;
      }
      const answer = await host.callTool(pending.tool, { sessionId: op.id, ...pending.args });
      setOp(summarizeOperation(answer) ?? pending.expected);
      host.tellModel(pending.done);
    } catch {
      setError(`${pending.failed} Tente de novo em alguns segundos.`);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const canEdit = canCallTools && !pending;
  return (
    <div className="ch-detail">
      {onBack && <BackButton onBack={onBack} label="Voltar às operações" />}
      <section className="surface ch-card">
        <header className="ch-head">
          <span className="ch-icon big" aria-hidden><Layers size={20} /></span>
          <div className="ch-head-main">
            <h2 className="ch-name">{op.name}</h2>
            <p className="ch-sub"><Health op={op} chips={chips} />{!op.isActive && <span className="ch-tag">Pausada</span>}</p>
          </div>
        </header>
        {!op.isActive && <p className="ch-note">Esta operação está pausada e não envia por nenhum dos seus chips.</p>}
        {pending && (
          <ConfirmPanel label={pending.label} tone={pending.tone} message={pending.message} confirmLabel={pending.confirmLabel}
            busyLabel={pending.busyLabel} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)} />
        )}
        {error && <p className="ch-alert" role="alert">{error}</p>}
        {picking === 'chip'
          ? <ChipPicker op={op} chips={chips} chipsFailed={chipsFailed} onPick={askAdd} onCancel={() => setPicking(null)} />
          : <ChipSlots op={op} chips={chips} canEdit={canEdit} busy={busy} onMove={askMove} onRemove={askRemove} onAdd={() => setPicking('chip')} />}
        {picking === 'products'
          ? (
            <ProductPicker products={products} assigned={op.productIds}
              onSave={(ids) => askProducts([...op.productIds, ...ids], { added: ids.map(titleOf) })} onCancel={() => setPicking(null)} />
          )
          : (
            <Products op={op} titleOf={titleOf} canEdit={canEdit} busy={busy}
              onRemove={(id) => askProducts(op.productIds.filter((p) => p !== id), { removed: titleOf(id) })}
              onAdd={() => setPicking('products')} />
          )}
      </section>
    </div>
  );
}

/** SessionsSection, as rows: name, state, primary chip, fallbacks and products. */
function OperationsList({ ops, chips, canOpen, onOpen }: {
  ops: Operation[]; chips: ChipsById | null; canOpen: boolean; onOpen: (op: Operation) => void;
}) {
  return (
    <section className="surface ch-card">
      <header className="ch-list-head">
        <h2 className="card-title">Operações</h2>
        <p className="card-sub">Cada operação envia as mensagens dos seus produtos pelo chip principal; as reservas assumem se ele cair.</p>
      </header>
      {ops.length ? (
        <ul className="ch-rows">
          {ops.map((op) => {
            const fallbacks = op.chipIds.length - 1;
            const body = (
              <>
                <span className="ch-icon" aria-hidden><Layers size={16} /></span>
                <span className="ch-row-main">
                  <span className="ch-row-name">{op.name}</span>
                  <span className="ch-sub">
                    <span>Principal: {op.chipIds[0] ? chipName(chips, op.chipIds[0]) : 'Sem chip'}</span>
                    <span>{fallbacks > 0 ? plural(fallbacks, 'reserva', 'reservas') : 'Sem reserva'}</span>
                  </span>
                </span>
                <span className="ch-row-side">
                  <Health op={op} chips={chips} />
                  {!op.isActive && <span className="ch-tag">Pausada</span>}
                  <span className="ch-count num">{plural(op.productIds.length, 'produto', 'produtos')}</span>
                </span>
                {canOpen && <ChevronRight size={16} className="ch-chevron" aria-hidden />}
              </>
            );
            return (
              <li key={op.id} className="ch-row">
                {canOpen
                  ? <button type="button" className="ch-row-btn" onClick={() => onOpen(op)} aria-label={`Abrir a operação ${op.name}`}>{body}</button>
                  : <div className="ch-row-btn">{body}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">Nenhuma operação criada ainda. Crie a primeira no painel, em WhatsApp &gt; Operações.</p>
      )}
    </section>
  );
}

/** Operations view: list_whatsapp_sessions and get_whatsapp_session (the API's name for an operation). */
export function OperationsView({ host, state }: { host: Host; state: HostSnapshot }) {
  const parts = useMemo(() => {
    const op = summarizeOperation(state.payload);
    return { op, ops: op ? null : summarizeOperations(state.payload) };
  }, [state.payload]);
  const [chips, setChips] = useState<ChipsById | null>(null);
  const [chipsFailed, setChipsFailed] = useState(false);
  const [list, setList] = useState<Operation[] | null>(null);
  const [open, setOpen] = useState<Operation | null>(null);

  // Chip names and states: the operation stores only ids, and its health comes from its chips.
  useEffect(() => {
    if (!state.canCallTools) return;
    host.callTool('list_whatsapp_numbers', {})
      .then((data) => {
        const all = summarizeChips(data);
        if (!all) throw new Error('no chips');
        setChips(new Map(all.map((c) => [c.id, c])));
      })
      .catch(() => setChipsFailed(true));
  }, [host, state.canCallTools]);

  useEffect(() => {
    if (parts.op) host.tellModel(`Operação ${parts.op.name} aberta na tela do chat.`);
    else if (parts.ops) host.tellModel('Lista de operações do WhatsApp aberta na tela do chat.');
  }, [host, parts]);

  const ops = parts.ops && (list ?? parts.ops);
  /** An operation changed in the detail replaces its row, so "Voltar" does not show the old one. */
  const replace = useCallback((next: Operation) => {
    setList((cur) => (cur ?? parts.ops ?? []).map((o) => (o.id === next.id ? next : o)));
  }, [parts.ops]);

  if (!parts.op && !ops) return <p className="state" data-tone="error">A resposta não trouxe operações do WhatsApp.</p>;
  return (
    <div className="dashboard chips">
      {chipsFailed && <p className="ch-alert" role="alert">Não foi possível carregar os chips: os nomes e o estado das operações ficam de fora.</p>}
      {parts.op && <OperationDetail host={host} first={parts.op} chips={chips} chipsFailed={chipsFailed} canCallTools={state.canCallTools} />}
      {ops && (
        <>
          {open && <OperationDetail key={open.id} host={host} first={open} chips={chips} chipsFailed={chipsFailed} canCallTools={state.canCallTools} onBack={() => setOpen(null)} onChange={replace} />}
          <div hidden={Boolean(open)}>
            <OperationsList ops={ops} chips={chips} canOpen={state.canCallTools} onOpen={setOpen} />
          </div>
        </>
      )}
    </div>
  );
}
