import { Check, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './payapi.css';
import type { Host, HostSnapshot } from '../host';
import { BackButton } from '../lib/BackButton';
import { Field } from '../lib/Field';
import { formatCents, formatInt, plural } from '../lib/format';
import { messageOf } from '../lib/messageOf';
import { COPY_FAILED_TEXT, useCopy } from '../lib/useCopy';
import { PixView } from '../pix/PixView';
import {
  formatReset, intentDate, levelText, summarizeLimits, summarizePayApi,
  type IntentRow, type IntentsPage, type LimitBucket, type LimitsInfo, type LimitsResult, type WalletRow,
} from './model';

const LIMITS_TOOL = 'get_payments_api_limits';

function Buckets({ buckets, compact }: { buckets: LimitBucket[]; compact?: boolean }) {
  return (
    <ul className="pa-buckets" data-compact={compact ? '' : undefined}>
      {buckets.map((b) => {
        const reset = formatReset(b.resetsInSeconds);
        const level = levelText(b.level);
        return (
          <li key={b.id} className="pa-bucket" data-level={b.level}>
            <div className="pa-bucket-head">
              <span className="pa-bucket-label">{b.label}</span>
              <span className="pa-bucket-count num">{formatInt(b.used)} / {formatInt(b.limit)}</span>
            </div>
            <div
              className="pa-bar" role="meter" aria-label={b.label}
              aria-valuemin={0} aria-valuemax={b.limit} aria-valuenow={Math.min(b.used, b.limit)}
              aria-valuetext={`${b.used} de ${b.limit}`}
            >
              <span style={{ width: `${Math.round(b.ratio * 100)}%` }} />
            </div>
            {(level || (!compact && reset)) && (
              <p className="pa-bucket-note">
                {level && <strong>{level}</strong>}
                {level && !compact && reset && ' · '}
                {!compact && reset}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ModeBadge({ livemode }: { livemode: boolean }) {
  return <span className="pa-badge" data-live={livemode ? '' : undefined}>{livemode ? 'LIVE' : 'TESTE'}</span>;
}

function LimitsCard({ result }: { result: LimitsResult }) {
  if (!result.available) {
    return (
      <section className="payapi-view surface">
        <p className="pa-quiet">Os limites por minuto ainda não estão disponíveis nesta API.</p>
      </section>
    );
  }
  const { limits } = result;
  return (
    <section className="payapi-view surface art-sales-chart">
      <div className="pa-head">
        <div>
          <p className="eyebrow brand">API de pagamentos</p>
          <h2 className="pa-title display">Requisições por minuto</h2>
        </div>
        <ModeBadge livemode={limits.livemode} />
      </div>
      {limits.buckets.length ? <Buckets buckets={limits.buckets} /> : <p className="pa-quiet">Nenhum limite informado.</p>}
      {limits.maxAmountCents !== null && (
        <dl className="pa-fields">
          <Field label="Valor máximo por cobrança"><span className="num">{formatCents(limits.maxAmountCents)}</span></Field>
        </dl>
      )}
    </section>
  );
}

/**
 * The compact strip on top of the lists. One read of get_payments_api_limits on mount; hidden while it
 * loads, when the host cannot call tools, when the route does not exist yet and when the read fails.
 */
function LimitsStrip({ host, enabled }: { host: Host; enabled: boolean }) {
  const [limits, setLimits] = useState<LimitsInfo | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    host.callTool(LIMITS_TOOL, {})
      .then((answer) => {
        const result = summarizeLimits(answer);
        if (live && result?.available) setLimits(result.limits);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [host, enabled]);

  if (!limits?.buckets.length) return null;
  return (
    <section className="pa-strip" aria-label="Requisições por minuto">
      <div className="pa-strip-head">
        <h3 className="pa-strip-title">Requisições por minuto</h3>
        <ModeBadge livemode={limits.livemode} />
      </div>
      <Buckets buckets={limits.buckets} compact />
    </section>
  );
}

function CopyId({ value }: { value: string }) {
  const [state, copy] = useCopy();
  return (
    <button type="button" className="pa-copy" onClick={() => void copy(value)} aria-label={`Copiar ${value}`}>
      <span className="pa-mono">{value}</span>
      {state === 'copied' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {state === 'copied' && <span className="pa-copy-note">Copiado</span>}
      {state === 'failed' && <span className="pa-copy-note">{COPY_FAILED_TEXT}</span>}
    </button>
  );
}

function WalletsList({ wallets }: { wallets: WalletRow[] }) {
  return (
    <section className="payapi-view surface art-credit-wallet">
      <p className="eyebrow brand">API de pagamentos</p>
      <h2 className="pa-title display">Carteiras</h2>
      {wallets.length ? (
        <ul className="pa-rows">
          {wallets.map((w) => (
            <li key={w.id} className="pa-row">
              <div className="pa-row-main">
                <span className="pa-row-name">{w.name}</span>
                <CopyId value={w.id} />
              </div>
              <span className="pa-pill" data-tone={w.activePix ? 'ok' : 'warn'}>
                {w.activePix ? plural(w.activePix, 'PIX ativo', 'PIX ativos') : 'Sem PIX ativo: cobrança live falha'}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="pa-quiet">Nenhuma carteira para esta chave.</p>}
    </section>
  );
}

function IntentRowButton({ row, busy, onOpen }: { row: IntentRow; busy: boolean; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" className="pa-row pa-row-button" disabled={busy} onClick={() => onOpen(row.id)}>
        <span className="pa-row-main">
          <span className="pa-row-name num">{row.amountCents === null ? '-' : formatCents(row.amountCents)}</span>
          <span className="pa-row-sub">
            {[row.reference, row.buyer, intentDate(row.createdAt)].filter((p) => p && p !== '-').join(' · ')}
          </span>
        </span>
        <span className="pa-pill" data-status={row.status}>{row.statusLabel}</span>
        <ChevronRight size={16} aria-hidden className="pa-chevron" />
      </button>
    </li>
  );
}

function IntentsList({ host, state, first }: { host: Host; state: HostSnapshot; first: IntentsPage }) {
  const [rows, setRows] = useState(first.rows);
  const [cursor, setCursor] = useState(first.nextCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const [detail, setDetail] = useState<{ id: string; payload: unknown } | null>(null);
  // Only the latest request may land: a response that is no longer current is dropped, and only the
  // current request clears `busy`.
  const requestId = useRef(0);

  async function run<T>(call: () => Promise<T>, fallback: string): Promise<T | null> {
    const id = ++requestId.current;
    setBusy(true);
    setFailed('');
    try {
      const result = await call();
      return id === requestId.current ? result : null;
    } catch (err) {
      if (id === requestId.current) setFailed(messageOf(err) || fallback);
      return null;
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  async function more() {
    if (!cursor || busy) return;
    // The filters the model opened the list with, one page further.
    const { starting_after: _ignored, ...filters } = state.args;
    const next = await run(async () => {
      const page = summarizePayApi(await host.callTool('list_payment_intents', { ...filters, starting_after: cursor }), 'list_payment_intents');
      if (page?.kind !== 'intents') throw new Error('');
      return page;
    }, 'Erro ao carregar mais cobranças. Tente novamente.');
    if (!next) return;
    setRows((r) => [...r, ...next.rows]);
    setCursor(next.nextCursor);
  }

  async function open(id: string) {
    if (busy) return;
    const payload = await run(() => host.callTool('get_payment_intent', { id }), 'Erro ao abrir a cobrança. Tente novamente.');
    if (payload) setDetail({ id, payload });
  }

  useEffect(() => {
    host.tellModel(`Lista de cobranças PIX aberta na tela do chat: ${plural(rows.length, 'cobrança', 'cobranças')}.`);
  }, [host, rows.length]);

  if (detail) {
    return (
      <>
        <BackButton onBack={() => setDetail(null)} label="Voltar à lista" />
        <PixView key={detail.id} host={host} state={{ ...state, toolName: 'get_payment_intent', payload: detail.payload }} />
      </>
    );
  }

  return (
    <section className="payapi-view surface art-payments-list" aria-busy={busy || undefined}>
      <p className="eyebrow brand">API de pagamentos</p>
      <h2 className="pa-title display">Cobranças PIX</h2>
      {failed && <p className="pa-error" role="alert">{failed}</p>}
      {rows.length ? (
        <ul className="pa-rows">
          {rows.map((r) => <IntentRowButton key={r.id} row={r} busy={busy} onOpen={(id) => void open(id)} />)}
        </ul>
      ) : <p className="pa-quiet">Nenhuma cobrança encontrada.</p>}
      {cursor && state.canCallTools && (
        <button type="button" className="pa-more" disabled={busy} onClick={() => void more()}>{busy ? 'Carregando...' : 'Mais'}</button>
      )}
    </section>
  );
}

/** Payments API cards: limits, wallets and charges, each list with the requests-per-minute strip on top. */
export function PayApiView({ host, state }: { host: Host; state: HostSnapshot }) {
  const [data] = useState(() => summarizePayApi(state.payload, state.toolName));
  if (!data) return <p className="state" data-tone="error">A resposta não trouxe nada que esta tela desenhe.</p>;
  if (data.kind === 'limits') return <LimitsCard result={data} />;
  return (
    <div className="payapi-stack">
      <LimitsStrip host={host} enabled={state.canCallTools} />
      {data.kind === 'wallets'
        ? <WalletsList wallets={data.wallets} />
        : <IntentsList host={host} state={state} first={data} />}
    </div>
  );
}
