import { ArrowDownRight, ArrowUpRight, ChevronLeft, Gem, Lock, Receipt, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import '../styles/dashboard.css';
import './billing.css';
import type { Host, HostSnapshot } from '../host';
import { formatCents, formatInt } from '../lib/format';
import {
  TOLERANCE_PCT, creditLevel, formatDay, formatDayTime, futureDayTime, invoiceAmount, invoiceStatusLabel,
  summarizeInvoice, summarizeInvoices, summarizeLedger, summarizeWallet, usagePercent, usageTone,
  type InvoiceRow, type Ledger, type LedgerRow, type Wallet,
} from './model';

/** Rows shown before "Ver mais", as the page pages its lists. */
const PAGE_SIZE = 10;

/** UnblockInfoBanner: only while the account is in grace or blocked. */
function UnblockBanner({ wallet }: { wallet: Wallet }) {
  if (!wallet.blocked && !wallet.grace) return null;
  const amount = wallet.openInvoiceCents != null ? ` (${formatCents(wallet.openInvoiceCents)})` : '';
  return (
    <div className="bill-banner" data-tone={wallet.blocked ? 'danger' : 'warn'} role="alert">
      {wallet.blocked ? <Lock size={18} aria-hidden /> : <TriangleAlert size={18} aria-hidden />}
      <div>
        <p className="bill-banner-title">{wallet.blocked ? 'Conta Bloqueada - Checkouts Desativados' : 'Período de Carência Ativo'}</p>
        <p>
          {wallet.blocked
            ? 'Sua conta foi bloqueada por exceder o limite de crédito.'
            : 'Você tem um pagamento pendente. Se não for quitado, seus checkouts serão despublicados.'}
          {` Pague a fatura em aberto${amount} via PIX ou adicione crédito suficiente.`}
        </p>
      </div>
    </div>
  );
}

/** CreditWalletCard's second line: the deadline when overdue, else the next charge. */
function WalletDeadline({ wallet, owing }: { wallet: Wallet; owing: boolean }) {
  if (wallet.blocked) return <p className="bill-line danger">Pague para reativar sua loja e seus checkouts.</p>;
  if (wallet.overdue) {
    const deadline = futureDayTime(wallet.graceEndsAt);
    return (
      <p className="bill-line danger">
        {deadline ? <>Pague até <strong>{deadline}</strong> para manter a loja no ar.</> : 'Pague para manter a loja no ar.'}
      </p>
    );
  }
  if (!wallet.closingAt) return null;
  return <p className="bill-line">{owing ? 'Cobrança automática em ' : 'Próxima cobrança em '}<strong>{formatDay(wallet.closingAt)}</strong></p>;
}

/** CreditLevelLadder, folded to its header and the next step: the chat has no room for the whole ladder. */
function LevelLine({ wallet }: { wallet: Wallet }) {
  const level = creditLevel(wallet.level);
  if (!level) return null;
  const next = level.next;
  const paid = wallet.totalPaidCents;
  return (
    <div className="bill-level">
      <div className="bill-level-head">
        <p className="bill-eyebrow">Limite de crédito</p>
        <span className="bill-level-name"><Gem size={14} aria-hidden />{level.name}</span>
        {level.autoScale && <span className="bill-pill">Escala automática</span>}
      </div>
      <p className="bill-level-limit num">{formatCents(wallet.limitCents)}</p>
      {next && (
        <p className="bill-level-next">
          {`Próximo: ${next.name} · limite de ${formatCents(next.limitCents)}`}
          {paid != null && <span className="num">{` · ${formatCents(Math.min(paid, next.requiredPaidCents))} de ${formatCents(next.requiredPaidCents)} em faturas pagas`}</span>}
        </p>
      )}
      <p className="bill-level-hint">O limite é quanto de taxa pode acumular antes de a fatura fechar mais cedo.</p>
    </div>
  );
}

/** CreditWalletCard + UsageLimitBar, with the cycle row of "Cobrança da plataforma" above. */
function WalletCard({ wallet }: { wallet: Wallet }) {
  const negative = wallet.signedNetCents < 0;
  const credit = wallet.signedNetCents > 0;
  const owing = wallet.overdue || negative;
  const sign = negative ? '−' : credit ? '+' : '';
  const pct = usagePercent(wallet);
  const tone = usageTone(wallet.usedCents, wallet.limitCents);
  return (
    <>
      <UnblockBanner wallet={wallet} />
      {wallet.closingAt && (
        <div className="bill-cycle">
          <span className="bill-ping" aria-hidden />
          <p>
            {wallet.overdue
              ? 'Ciclo em andamento · fechamento pausado até a fatura em aberto ser paga'
              : `Processando ciclo · fecha ${formatDayTime(wallet.closingAt)}`}
          </p>
        </div>
      )}
      <section className="surface art-credit-wallet bill-wallet">
        <div className="bill-hero">
          <span className="bill-rule" aria-hidden />
          <p className="bill-title">Saldo da conta</p>
          <p className="bill-value num" data-tone={owing ? 'owing' : credit ? 'credit' : undefined}>
            {`${sign}${formatCents(Math.abs(wallet.signedNetCents))}`}
          </p>
          <p className="bill-sub">
            {wallet.overdue ? 'Fatura fechada e não paga' : negative ? 'A pagar neste ciclo · usando seu limite' : 'Saldo pré-pago via PIX'}
          </p>
          <WalletDeadline wallet={wallet} owing={owing} />
        </div>
        <div className="bill-usage">
          <div className="bill-usage-head">
            <p className="bill-eyebrow">Uso do limite</p>
            <span className="num" data-tone={tone}>{`${pct}%`}</span>
          </div>
          <div className="bill-bar" data-tone={tone} role="progressbar" aria-label="Uso do limite" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="bill-usage-line num">
            {`${formatCents(wallet.usedCents)} de ${formatCents(wallet.limitWithToleranceCents)} · ${TOLERANCE_PCT}% de tolerância do crédito emergencial`}
          </p>
          {wallet.overdue && <p className="bill-usage-note">O limite não cobre a fatura em aberto: só o pagamento evita o bloqueio.</p>}
        </div>
        <LevelLine wallet={wallet} />
      </section>
    </>
  );
}

function InvoiceBadge({ status }: { status: string }) {
  return <span className="bill-badge" data-status={status}>{invoiceStatusLabel(status)}</span>;
}

const period = (row: InvoiceRow) => `${formatDay(row.periodStart)} - ${formatDay(row.periodEnd)}`;
const salesLine = (row: InvoiceRow) => (row.salesCount == null
  ? null
  : `${formatInt(row.salesCount)} ${row.salesCount === 1 ? 'venda' : 'vendas'} • ${formatCents(row.salesVolumeCents)} em vendas`);

/** InvoiceList: "Histórico de Faturas", a row per invoice that opens its detail. */
function InvoiceList({ rows, onOpen }: { rows: InvoiceRow[]; onOpen: (row: InvoiceRow) => void }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  return (
    <section className="surface analytics art-billing-statement bill-list">
      <header className="bill-list-head">
        <h2 className="card-title">Histórico de Faturas</h2>
        <p className="card-sub">Suas faturas de cobrança de taxas</p>
      </header>
      {rows.length ? (
        <ul className="bill-rows">
          {rows.slice(0, shown).map((row) => (
            <li key={row.id}>
              <button type="button" className="bill-row" onClick={() => onOpen(row)}>
                <span className="bill-row-main">
                  <span className="bill-row-title num">{period(row)}</span>
                  {salesLine(row) && <span className="bill-row-sub num">{salesLine(row)}</span>}
                </span>
                <span className="bill-row-side">
                  <span className="bill-row-amount num">{formatCents(invoiceAmount(row))}</span>
                  <InvoiceBadge status={row.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bill-empty"><Receipt size={32} aria-hidden /><p>Nenhuma fatura encontrada</p></div>
      )}
      {rows.length > shown && (
        <div className="list-foot">
          <span className="num">{`${shown} de ${rows.length}`}</span>
          <button type="button" className="more" onClick={() => setShown((n) => n + PAGE_SIZE)}>Ver mais</button>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bill-field">
      <dt>{label}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}

/** InvoiceDetailsDialog, read-only: the breakdown of the fee and how it was paid. */
function InvoiceDetail({ row, onBack }: { row: InvoiceRow; onBack?: () => void }) {
  const salesFee = row.grossCents - row.whatsappCents - row.sacCents;
  return (
    <div className="bill-detail">
      {onBack && <button type="button" className="bill-back" onClick={onBack}><ChevronLeft size={15} aria-hidden />Voltar</button>}
      <section className="surface analytics art-billing-statement bill-detail-card">
        <header className="bill-detail-head">
          <InvoiceBadge status={row.status} />
          <p className="bill-detail-amount num">{formatCents(invoiceAmount(row))}</p>
          <p className="card-sub num">{`Período: ${period(row)}`}</p>
        </header>
        <dl className="bill-fields">
          {row.salesCount != null && <Field label="Vendas no período">{salesLine(row)}</Field>}
          <Field label="Taxa sobre vendas">{formatCents(salesFee)}</Field>
          {row.sacCents > 0 && <Field label="Atendimento (SAC)">{formatCents(row.sacCents)}</Field>}
          {row.whatsappCents > 0 && <Field label="Disparos WhatsApp">{formatCents(row.whatsappCents)}</Field>}
          <Field label="Total da fatura">{formatCents(row.grossCents)}</Field>
          {row.creditAppliedCents > 0 && <Field label="Pago com saldo">{`−${formatCents(row.creditAppliedCents)}`}</Field>}
          {row.status === 'paid'
            ? row.netCents > 0 && <Field label="Restante pago">{formatCents(row.netCents)}</Field>
            : <Field label="A pagar">{formatCents(row.netCents)}</Field>}
          {row.dueAt && <Field label="Vencimento">{formatDayTime(row.dueAt)}</Field>}
          {row.paidAt && <Field label="Pago em">{formatDayTime(row.paidAt)}</Field>}
        </dl>
      </section>
    </div>
  );
}

/** A ledger line's notes, as ledgerRow.ts writes them. */
function LedgerNotes({ row }: { row: LedgerRow }) {
  if (row.receipt) {
    const { creditAppliedCents, remainingCents } = row.receipt;
    return (
      <>
        {creditAppliedCents > 0 && <span className="bill-note num">{`Pago com saldo −${formatCents(creditAppliedCents)}`}</span>}
        {remainingCents > 0
          ? <span className="bill-note danger num">{`Ficou em aberto ${formatCents(remainingCents)}`}</span>
          : <span className="bill-note">Paga integralmente com saldo</span>}
      </>
    );
  }
  if (row.settledInvoiceAt) {
    const closed = formatDay(row.settledInvoiceAt).slice(0, 5);
    return <span className="bill-note num">{`Fatura de ${closed} quitada com saldo`}</span>;
  }
  if (row.pending) {
    return (
      <span className="bill-note num">
        {row.pending.shortfallCents > 0
          ? `Guardado · faltavam ${formatCents(row.pending.shortfallCents)} para quitar a fatura de ${formatCents(row.pending.amountCents)}`
          : `Completou o valor da fatura de ${formatCents(row.pending.amountCents)}`}
      </span>
    );
  }
  return null;
}

function LedgerLine({ row }: { row: LedgerRow }) {
  const income = row.amountCents >= 0;
  const Arrow = income ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="bill-ledger-row">
      <span className="bill-ledger-icon" data-dir={row.receipt ? 'neutral' : income ? 'in' : 'out'} aria-hidden>
        {row.receipt ? <Receipt size={16} /> : <Arrow size={16} />}
      </span>
      <span className="bill-ledger-main">
        <span className="bill-ledger-title">
          {row.label}
          {row.receipt?.trigger && <span className="bill-outline">{row.receipt.trigger === 'cap' ? 'limite atingido' : 'fechamento semanal'}</span>}
          {row.legacyStatus && <span className="bill-outline">{row.legacyStatus}</span>}
        </span>
        <span className="bill-ledger-date num">{formatDayTime(row.createdAt)}</span>
        <LedgerNotes row={row} />
      </span>
      <span className="bill-ledger-side">
        {row.receipt
          ? <span className="bill-ledger-amount num">{formatCents(row.receipt.grossCents)}</span>
          : <span className="bill-ledger-amount num" data-dir={income ? 'in' : 'out'}>{`${income ? '+' : '−'}${formatCents(Math.abs(row.amountCents))}`}</span>}
        {row.balanceAfterCents != null && <span className="bill-ledger-balance mono">{`saldo ${formatCents(row.balanceAfterCents)}`}</span>}
      </span>
    </li>
  );
}

/** CreditLedgerList (the "Extrato" tab): older lines come through list_credits' `before` cursor. */
function LedgerList({ host, state, first }: { host: Host; state: HostSnapshot; first: Ledger }) {
  const [ledger, setLedger] = useState(first);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!ledger.nextBefore || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const next = summarizeLedger(await host.callTool('list_credits', { ...state.args, before: ledger.nextBefore }));
      if (!next) throw new Error('no ledger');
      setLedger((l) => ({ rows: [...l.rows, ...next.rows], nextBefore: next.nextBefore, error: next.error }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface bill-list">
      <header className="bill-list-head">
        <h2 className="card-title">Extrato</h2>
        <p className="card-sub">Entradas e saídas do seu saldo de crédito</p>
      </header>
      {ledger.error && <p className="bill-error" role="alert">Não foi possível carregar o extrato.</p>}
      {ledger.rows.length
        ? <ul className="bill-ledger" aria-busy={busy || undefined}>{ledger.rows.map((row) => <LedgerLine key={row.id} row={row} />)}</ul>
        : !ledger.error && <p className="empty">Nenhum movimento de crédito ainda.</p>}
      {failed && <p className="bill-error" role="alert">Não foi possível carregar o extrato. Tente de novo.</p>}
      {ledger.nextBefore && state.canCallTools && (
        <div className="list-foot">
          <span className="num">{`${formatInt(ledger.rows.length)} movimentos`}</span>
          <button type="button" className="more" disabled={busy} onClick={loadMore}>{busy ? 'Carregando…' : 'Ver mais'}</button>
        </div>
      )}
    </section>
  );
}

/** Billing view: the wallet (get_billing_status / get_billing_balance), the invoices (list_invoices,
 *  get_invoice) and the credit statement (list_credits), as the seller's /billing page draws them. */
export function BillingView({ host, state }: { host: Host; state: HostSnapshot }) {
  const parts = useMemo(() => {
    const wallet = summarizeWallet(state.payload);
    const invoice = wallet ? null : summarizeInvoice(state.payload);
    const invoices = wallet || invoice ? null : summarizeInvoices(state.payload);
    const ledger = wallet || invoice || invoices ? null : summarizeLedger(state.payload);
    return { wallet, invoice, invoices, ledger };
  }, [state.payload]);
  const [open, setOpen] = useState<InvoiceRow | null>(null);

  useEffect(() => {
    const { wallet, invoice, invoices, ledger } = parts;
    if (wallet) host.tellModel('Saldo da conta e uso do limite abertos na tela do chat.');
    else if (invoice) host.tellModel(`Fatura ${invoice.id} aberta na tela do chat.`);
    else if (invoices) host.tellModel('Histórico de faturas aberto na tela do chat.');
    else if (ledger) host.tellModel('Extrato de crédito aberto na tela do chat.');
  }, [host, parts]);

  const openRow = (row: InvoiceRow) => {
    setOpen(row);
    host.tellModel(`O vendedor abriu a fatura ${row.id} (${invoiceStatusLabel(row.status)}) na tela do chat.`);
  };

  const { wallet, invoice, invoices, ledger } = parts;
  if (!wallet && !invoice && !invoices && !ledger) return <p className="state" data-tone="error">A resposta não trouxe dados da fatura.</p>;
  return (
    <div className="dashboard billing">
      {wallet && <WalletCard wallet={wallet} />}
      {invoice && <InvoiceDetail row={invoice} />}
      {invoices && (
        <>
          {open && <InvoiceDetail row={open} onBack={() => setOpen(null)} />}
          <div hidden={Boolean(open)}><InvoiceList rows={invoices} onOpen={openRow} /></div>
        </>
      )}
      {ledger && <LedgerList host={host} state={state} first={ledger} />}
    </div>
  );
}
