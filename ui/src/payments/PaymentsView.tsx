import {
  Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, CreditCard, PackagePlus, Search, User, Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import '../styles/dashboard.css';
import './payments.css';
import receiptDark from '../art/receipt.avif';
import receiptLight from '../art/receipt-light.avif';
import salesIcon from '../art/icon-sales.avif';
import type { Host, HostSnapshot } from '../host';
import { formatCents, formatInt } from '../lib/format';
import { useCopy } from '../lib/useCopy';
import { gatewayLogo, gatewayName } from '../lib/gateways';
import {
  formatDetailDate, formatListDate, initials, methodName, pageWindow, statusLabel, statusVariant, summarizePayment,
  summarizePaymentsPage, type PaymentRow, type PaymentsPage,
} from './model';

/** Rows per page when list_payments hands over the whole list (the paginated tool's default). */
const LOCAL_PAGE_SIZE = 10;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, copy] = useCopy();
  return (
    <button type="button" className="pay-copy" aria-label={copied ? 'Copiado' : label} title={label} onClick={(e) => { e.stopPropagation(); copy(value); }}>
      {copied ? <Check size={14} className="pay-copied" aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}

function StatusBadge({ status, detail = false }: { status: string; detail?: boolean }) {
  return (
    <span className={`pay-status${detail ? ' detail' : ''}`} data-variant={statusVariant(status)}>
      <span className="pay-dot" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

function Avatar({ row }: { row: PaymentRow }) {
  return <span className="pay-avatar" aria-hidden>{initials(row.customerName, row.customerEmail)}</span>;
}

function GatewayMark({ id, size }: { id: string | null; size: number }) {
  const logo = gatewayLogo(id);
  if (logo) return <img className="pay-gw-logo" src={logo} width={size} height={size} alt="" />;
  return <span className="pay-gw-fallback" style={{ width: size, height: size }} aria-hidden>{gatewayName(id).charAt(0).toUpperCase()}</span>;
}

/** The order bump and affiliate chips of OfferCell. */
function OfferChips({ row }: { row: PaymentRow }) {
  const bumps = row.orderBumps.length;
  return (
    <>
      {bumps > 0 && (
        <span className="pay-chip bump" title={`Inclui ${bumps} order bump${bumps > 1 ? 's' : ''}`}><PackagePlus aria-hidden /></span>
      )}
      {row.affiliatePercent != null && (
        <span className="pay-chip affiliate" title={`Venda via afiliado (${row.affiliatePercent}% comissão)`}><Users aria-hidden /></span>
      )}
    </>
  );
}

const customerLabel = (row: PaymentRow) => row.customerEmail ?? row.customerName ?? 'Não informado';
const gatewayLine = (row: PaymentRow) => `${row.gateway ? gatewayName(row.gateway) : 'Não informado'} · ${methodName(row.method)}`;

/** The desktop grid (PaymentsGrid), trimmed to fit a chat card: the offer goes under the customer, as on
 *  the mobile card, and ID and phone live in the detail. */
function PaymentsTable({ rows, onOpen }: { rows: PaymentRow[]; onOpen: (row: PaymentRow) => void }) {
  return (
    <div className="pay-table-wrap">
      <table className="pay-table">
        <thead>
          <tr>
            <th>Cliente</th><th>Criado em:</th><th className="end">Valor</th><th>Status</th><th>Gateway/Método</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} tabIndex={0} onClick={() => onOpen(row)} onKeyDown={(e) => e.key === 'Enter' && onOpen(row)}>
              <td className="pay-who-cell">
                <div className="pay-customer">
                  <Avatar row={row} />
                  <span className="pay-card-who">
                    <span className="pay-email">{customerLabel(row)}</span>
                    <span className="pay-card-offer">
                      <span title={row.offer ?? undefined}>{row.offer ?? 'Não informado'}</span>
                      <OfferChips row={row} />
                    </span>
                  </span>
                </div>
              </td>
              <td className="num pay-date">{formatListDate(row.createdAt)}</td>
              <td className="num end pay-amount">{formatCents(row.amountCents)}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div className="pay-gw">
                  <GatewayMark id={row.gateway} size={24} />
                  <span className="pay-gw-text">
                    <span className="pay-gw-name">{row.gateway ? gatewayName(row.gateway) : 'Não informado'}</span>
                    <span className="pay-gw-method">{methodName(row.method)}</span>
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The mobile card list (PaymentsCardList), used below the grid's breakpoint. */
function PaymentsCards({ rows, onOpen }: { rows: PaymentRow[]; onOpen: (row: PaymentRow) => void }) {
  return (
    <ul className="pay-cards">
      {rows.map((row) => (
        <li key={row.id}>
          <button type="button" className="pay-card" onClick={() => onOpen(row)}>
            <span className="pay-card-top">
              <span className="pay-card-amount num">{formatCents(row.amountCents)}</span>
              <StatusBadge status={row.status} />
            </span>
            <span className="pay-customer">
              <Avatar row={row} />
              <span className="pay-card-who">
                <span className="pay-card-email">{customerLabel(row)}</span>
                <span className="pay-card-offer">
                  <span>{row.offer ?? 'Não informado'}</span>
                  <OfferChips row={row} />
                </span>
              </span>
            </span>
            <span className="pay-card-foot">
              <span className="pay-card-gw">{gatewayLine(row)}</span>
              <span className="num">{formatListDate(row.createdAt)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StepButton({ icon: Icon, label, onClick, hidden, className = '' }: {
  icon: LucideIcon; label: string; onClick: () => void; hidden: boolean; className?: string;
}) {
  // Unavailable steps keep their room and go invisible, so the numbers never jump (PaymentsPager).
  return (
    <button type="button" className={`pay-step ${className}`} aria-label={label} aria-disabled={hidden || undefined} data-hidden={hidden || undefined} onClick={() => !hidden && onClick()}>
      <Icon size={16} aria-hidden />
    </button>
  );
}

/** PaymentsPager. Numbers only when every page can be reached directly (the whole list is here); a
 *  cursor only walks forward, so the paginated tool gets the steps and the counter. */
function Pager({ page, totalPages, numbered, hasNext, busy, onGo }: {
  page: number; totalPages: number | null; numbered: boolean; hasNext: boolean; busy: boolean; onGo: (page: number) => void;
}) {
  const last = totalPages ?? page + (hasNext ? 1 : 0);
  if (last <= 1) return null;
  return (
    <nav className="pay-pager" aria-label="Paginação" aria-busy={busy || undefined}>
      <div className="pay-pager-row">
        {numbered && <StepButton icon={ChevronsLeft} label="Primeira" className="wide" hidden={page <= 1} onClick={() => onGo(1)} />}
        <StepButton icon={ChevronLeft} label="Anterior" className="mid" hidden={page <= 1} onClick={() => onGo(page - 1)} />
        {numbered && pageWindow(page, last).map((n, i) => n === null
          ? <span key={`gap-${i}`} className="pay-gap">…</span>
          : (
            <button key={n} type="button" className="pay-num num" aria-current={n === page ? 'page' : undefined} onClick={() => n !== page && onGo(n)}>
              {n}
            </button>
          ))}
        <StepButton icon={ChevronRight} label="Próxima" className="mid" hidden={!hasNext} onClick={() => onGo(page + 1)} />
        {numbered && <StepButton icon={ChevronsRight} label="Última" className="wide" hidden={page >= last} onClick={() => onGo(last)} />}
      </div>
      {totalPages != null && <p className="pay-count num" aria-live="polite">{`Página ${page} de ${formatInt(totalPages)}`}</p>}
    </nav>
  );
}

function totalLabel(total: number | null, capped: boolean): string {
  if (total == null) return '…';
  return `${formatInt(total)}${capped ? '+' : ''}`;
}

function periodLabel(args: Record<string, unknown>): string | null {
  const day = (v: unknown) => (typeof v === 'string' && v ? new Date(v).toLocaleDateString('pt-BR') : null);
  const from = day(args.dateFrom);
  const to = day(args.dateTo);
  return from && to ? `${from} - ${to}` : null;
}

interface CursorPages {
  pages: PaymentRow[][];
  /** Cursor that loads pages[i + 1]; null once the last page is in. */
  cursors: (string | null)[];
}

/** PaymentsListCard + the footer of the payments page, for get_payments_paginated and list_payments. */
function PaymentsList({ host, state, first, onOpen }: {
  host: Host; state: HostSnapshot; first: PaymentsPage; onOpen: (row: PaymentRow) => void;
}) {
  // Both tools answer a page of get_payments_paginated, and the next page and the search go back to it
  // through the host. A host that drops the tool name and hands a bare list (no cursor, no count) gets
  // its pages and search locally, over what it gave.
  const local = !state.toolName && first.nextCursor === null && first.total === null;
  const remote = !local && state.canCallTools;
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ head: PaymentsPage; walk: CursorPages }>(() => ({
    head: first, walk: { pages: [first.payments], cursors: [first.nextCursor] },
  }));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const filtered = useMemo(() => {
    if (!local || !applied) return first.payments;
    const needle = applied.toLowerCase();
    return first.payments.filter((p) => [p.id, p.customerEmail, p.customerName, p.customerPhone, p.offer]
      .some((field) => field?.toLowerCase().includes(needle)));
  }, [local, applied, first]);

  const pageSize = local ? LOCAL_PAGE_SIZE : Math.max(first.payments.length, Number(state.args.pageSize) || 10);
  const total = local ? filtered.length : data.head.total;
  const totalPages = total == null ? null : Math.max(1, Math.ceil(total / pageSize));
  const rows = local ? filtered.slice((page - 1) * pageSize, page * pageSize) : data.walk.pages[page - 1] ?? [];
  const hasNext = local ? page < (totalPages ?? 1) : page < data.walk.pages.length || (remote && data.walk.cursors[page - 1] != null);

  async function fetchPage(args: Record<string, unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      const next = summarizePaymentsPage(await host.callTool('get_payments_paginated', args));
      if (!next) throw new Error('no page');
      return next;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function go(target: number) {
    if (local || target <= data.walk.pages.length) return setPage(target);
    const cursor = data.walk.cursors[target - 2];
    if (!cursor || busy) return;
    const next = await fetchPage({ ...state.args, ...(applied ? { searchTerm: applied } : {}), lastCreatedAt: cursor });
    if (!next) return;
    setData((d) => ({ ...d, walk: { pages: [...d.walk.pages, next.payments], cursors: [...d.walk.cursors, next.nextCursor] } }));
    setPage(target);
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (term === applied) return;
    if (local) {
      setApplied(term);
      setPage(1);
      return;
    }
    if (!remote) return;
    const { searchTerm: _, lastCreatedAt: __, ...rest } = state.args;
    const head = await fetchPage(term ? { ...rest, searchTerm: term } : rest);
    if (!head) return;
    setApplied(term);
    setData({ head, walk: { pages: [head.payments], cursors: [head.nextCursor] } });
    setPage(1);
  }

  useEffect(() => {
    host.tellModel(`Lista de pagamentos aberta na tela do chat: página ${page}${applied ? `, busca "${applied}"` : ''}.`);
  }, [host, page, applied]);

  const start = rows.length ? (page - 1) * pageSize + 1 : 0;
  const end = start ? start + rows.length - 1 : 0;
  const period = periodLabel(state.args);
  const canSearch = local || remote;

  return (
    <>
      <section className="surface analytics art-payments-list pay-list">
        {data.head.coverageCapped && (
          <p className="pay-notice">Mostrando correspondências nos pagamentos mais recentes do período. Reduza o período para encontrar registros mais antigos.</p>
        )}
        <div className="pay-head">
          <h2 className="pay-title">
            <img src={state.colorMode === 'dark' ? receiptDark : receiptLight} width={24} height={24} alt="" />
            Últimos Clientes
          </h2>
          {canSearch && (
            <form className="pay-search" role="search" onSubmit={search}>
              <Search size={16} aria-hidden />
              <input type="search" value={query} placeholder="Buscar..." aria-label="Buscar pagamentos" onChange={(e) => setQuery(e.target.value)} />
            </form>
          )}
        </div>
        <div id="content" aria-busy={busy || undefined}>
          {failed && (
            <div className="pay-error" role="alert">
              <p>Erro ao carregar a lista. Tente novamente.</p>
            </div>
          )}
          {rows.length ? (
            <>
              <PaymentsTable rows={rows} onOpen={onOpen} />
              <PaymentsCards rows={rows} onOpen={onOpen} />
            </>
          ) : (
            <div className="pay-empty">
              <img src={salesIcon} width={56} height={56} alt="" />
              <p className="pay-empty-title">Nenhum pagamento</p>
              <p className="pay-empty-hint">Ajuste os filtros ou o período.</p>
            </div>
          )}
          <Pager page={page} totalPages={local || remote ? totalPages : null} numbered={local} hasNext={hasNext} busy={busy} onGo={go} />
        </div>
      </section>
      <p className="pay-foot num">
        {`Mostrando ${start}–${end} de ${totalLabel(total, !local && data.head.totalCapped)} registros`}
        {period && ` — Período: ${period}`}
      </p>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pay-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function DetailCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="pay-detail-card">
      <header>
        <h3>{title}</h3>
        <span className="pay-detail-icon" aria-hidden><Icon size={15} /></span>
      </header>
      <dl>{children}</dl>
    </section>
  );
}

/** The read-only parts of the payment detail page: header, customer, payment and order bumps. */
function PaymentDetail({ row, onBack }: { row: PaymentRow; onBack?: () => void }) {
  const [copied, copy] = useCopy();
  const method = `${row.subscription ? 'Assinatura ' : ''}${methodName(row.method)}`;
  return (
    <div className="pay-detail">
      {onBack && (
        <button type="button" className="pay-back" onClick={onBack}><ChevronLeft size={15} aria-hidden />Voltar</button>
      )}
      <header className="pay-detail-head">
        <StatusBadge status={row.status} detail />
        <h1 className="pay-detail-amount num">{formatCents(row.amountCents)}</h1>
        <div className="pay-detail-meta">
          <button type="button" className="pay-id num" onClick={() => copy(row.id)} aria-label="Copiar ID do pagamento">
            {`#${row.id.slice(0, 8)}`}
            {copied ? <Check size={14} className="pay-copied" aria-hidden /> : <Copy size={14} aria-hidden />}
          </button>
          <span>{`Criado em: ${formatDetailDate(row.createdAt)}`}</span>
        </div>
      </header>
      <div className="pay-detail-grid">
        <DetailCard title="Detalhes do cliente" icon={User}>
          {row.customerName && <Field label="Nome">{row.customerName}</Field>}
          <Field label="E-mail">
            {row.customerEmail ? <><span className="pay-break">{row.customerEmail}</span><CopyButton value={row.customerEmail} label="Copiar e-mail" /></> : 'Não informado'}
          </Field>
          {row.customerCpf && <Field label="CPF"><span className="mono">{row.customerCpf}</span></Field>}
          <Field label="Telefone">{row.customerPhone ?? 'Não informado'}</Field>
          <Field label="Produto / Oferta">{row.offer ?? '-'}</Field>
        </DetailCard>
        <DetailCard title="Pagamento" icon={CreditCard}>
          <Field label="Gateway/Método de Pagamento">
            {row.gateway || row.method
              ? <><GatewayMark id={row.gateway} size={18} />{`${row.gateway ? gatewayName(row.gateway) : 'Não informado'} · ${method}`}</>
              : '-'}
          </Field>
          <Field label="Modo">{row.subscription ? 'Assinatura' : 'Produção'}</Field>
          <Field label="Valor"><span className="num">{formatCents(row.amountCents)}</span></Field>
          {row.installments > 1 && <Field label="Parcelas"><span className="num">{`${row.installments}x`}</span></Field>}
          <Field label="ID"><span className="mono pay-break">{row.id}</span><CopyButton value={row.id} label="Copiar ID" /></Field>
          <Field label="Criado em"><span className="num">{formatDetailDate(row.createdAt)}</span></Field>
          {row.paidAt && <Field label="Pago em"><span className="num">{formatDetailDate(row.paidAt)}</span></Field>}
        </DetailCard>
        {row.orderBumps.length > 0 && (
          <DetailCard title={`Produtos Adicionais (${row.orderBumps.length})`} icon={PackagePlus}>
            {row.orderBumps.map((bump, i) => (
              <Field key={`${bump.title}-${i}`} label={`Orderbump ${i + 1}`}>
                {bump.title}
                <span className="num pay-bump-price">{bump.amountCents == null ? '-' : formatCents(bump.amountCents)}</span>
              </Field>
            ))}
          </DetailCard>
        )}
      </div>
    </div>
  );
}

/** Payments view: the list of get_payments_paginated / list_payments (a row opens its detail) and get_payment. */
export function PaymentsView({ host, state }: { host: Host; state: HostSnapshot }) {
  const single = useMemo(() => summarizePayment(state.payload), [state.payload]);
  const page = useMemo(() => (single ? null : summarizePaymentsPage(state.payload)), [single, state.payload]);
  const [open, setOpen] = useState<PaymentRow | null>(null);

  useEffect(() => {
    if (single) host.tellModel(`Pagamento ${single.id} aberto na tela do chat.`);
  }, [host, single]);

  const openRow = (row: PaymentRow) => {
    setOpen(row);
    host.tellModel(`O vendedor abriu o pagamento ${row.id} na tela do chat.`);
  };

  if (!single && !page) return <p className="state" data-tone="error">A resposta não trouxe pagamentos.</p>;
  return (
    <div className="dashboard payments">
      {single ? <PaymentDetail row={single} /> : (
        <>
          {open && <PaymentDetail row={open} onBack={() => setOpen(null)} />}
          {/* Kept mounted under the detail, so going back keeps the page and the search. */}
          <div hidden={Boolean(open)}>
            <PaymentsList host={host} state={state} first={page!} onOpen={openRow} />
          </div>
        </>
      )}
    </div>
  );
}
