import { useEffect, useRef, useState, type RefObject } from 'react';
import './pix.css';
import type { Host, HostSnapshot } from '../host';
import { formatCents } from '../lib/format';
import { FINAL_STATUSES, formatRemaining, normalizePix, polledStatus, type PixCharge, type PixStatus } from './model';

const POLL_MS = 5000;
// A PIX paid in the last seconds can take a moment to show, so polling outlives the expiry a little.
const GRACE_AFTER_EXPIRY_MS = 120_000;
const POLL_LIMIT_MS = 30 * 60_000;

const STATUS_TEXT: Record<string, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  expired: 'Expirado',
  canceled: 'Cancelado',
  failed: 'Falhou',
};

function CheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.14" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** Keeps the status fresh by polling the tool that reads it, until it is final or polling gives up. */
function usePolledStatus(host: Host, charge: PixCharge, canCallTools: boolean) {
  const [status, setStatus] = useState<PixStatus>(charge.status);
  useEffect(() => {
    if (status !== 'pending' || !canCallTools || !charge.poll) return;
    const poll = charge.poll;
    const startedAt = Date.now();
    let timer = 0;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const expiredFor = charge.expiresAt ? Date.now() - Date.parse(charge.expiresAt) : -1;
      if (expiredFor > GRACE_AFTER_EXPIRY_MS || Date.now() - startedAt > POLL_LIMIT_MS) {
        if (expiredFor > 0) setStatus('expired');
        return;
      }
      if (!document.hidden) {
        try {
          const next = polledStatus(charge, await host.callTool(poll.tool, poll.args));
          if (next && next !== 'pending') {
            setStatus(next);
            return;
          }
        } catch {
          // A failed read is not a status: try again on the next tick.
        }
      }
      if (!stopped) timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [host, charge, canCallTools, status]);

  useEffect(() => {
    if (status === charge.status || !FINAL_STATUSES.has(status)) return;
    const what = `${charge.title}${charge.id ? ` ${charge.id}` : ''}`;
    host.tellModel(`${what}: ${STATUS_TEXT[status].toLowerCase()} (visto na tela do PIX).`);
  }, [host, charge, status]);

  return status;
}

function CopyButton({ code, field }: { code: string; field: RefObject<HTMLInputElement | null> }) {
  const [label, setLabel] = useState('Copiar código PIX');
  const flash = (text: string, ms: number) => {
    setLabel(text);
    setTimeout(() => setLabel('Copiar código PIX'), ms);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // No clipboard permission in this sandbox: select the text so Ctrl/Cmd+C finishes the job.
      field.current?.focus();
      field.current?.select();
      if (!document.execCommand?.('copy')) {
        flash('Selecionado, use Ctrl+C', 2400);
        return;
      }
    }
    flash('Código copiado', 2000);
  };
  return <button className="cta" type="button" onClick={copy}>{label}</button>;
}

function Charge({ host, charge, canCallTools }: { host: Host; charge: PixCharge; canCallTools: boolean }) {
  const status = usePolledStatus(host, charge, canCallTools);
  const open = status === 'pending';
  const now = useNow(open);
  const field = useRef<HTMLInputElement>(null);

  if (status === 'none') return <p className="state">Nenhuma recarga em aberto.</p>;
  if (status === 'paid') {
    return (
      <div className="done" role="status">
        <CheckIcon />
        <div>
          <h2 className="display">Pagamento confirmado</h2>
          <p className="note muted num">{[charge.amountCents != null ? formatCents(charge.amountCents) : null, charge.title].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    );
  }

  const remaining = charge.expiresAt ? formatRemaining(charge.expiresAt, now) : null;
  return (
    <div className="pix">
      <div className="qr" data-dim={open ? undefined : ''}>
        {charge.qrSrc ? <img src={charge.qrSrc} alt="QR code do PIX" /> : <span className="faint note">QR indisponível</span>}
      </div>
      <div className="info">
        <div>
          <p className="eyebrow brand">{charge.title}</p>
          {charge.amountCents != null && <p className="amount display num">{formatCents(charge.amountCents)}</p>}
          {charge.description && <p className="description">{charge.description}</p>}
        </div>
        <div className="meta" role="status">
          <span className="pill" data-status={status}>{STATUS_TEXT[status] ?? status}</span>
          {open && charge.expiresAt && <span className="muted num">{remaining ? `expira em ${remaining}` : 'prazo encerrado, conferindo'}</span>}
          {!charge.livemode && <span className="badge">MODO TESTE</span>}
        </div>
        {charge.code && open && <input ref={field} className="code" value={charge.code} readOnly aria-label="Código PIX copia e cola" />}
        {charge.code && open && <CopyButton code={charge.code} field={field} />}
        {open && !canCallTools && <p className="note faint">Peça no chat para conferir se o PIX foi pago.</p>}
      </div>
    </div>
  );
}

/** PIX view: QR, copy-and-paste code, time left, and the status kept fresh while the view is open. */
export function PixView({ host, state }: { host: Host; state: HostSnapshot }) {
  const [charge] = useState(() => normalizePix(state.payload));
  if (!charge) return <p className="state" data-tone="error">A resposta não trouxe um PIX.</p>;
  return (
    <div className={`pix-view surface ${charge.kind === 'topup' ? 'art-credit-wallet' : 'art-sales-by-payment'}`}>
      <Charge host={host} charge={charge} canCallTools={state.canCallTools} />
    </div>
  );
}
