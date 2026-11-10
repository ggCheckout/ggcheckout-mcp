import { useEffect, useRef, useState, type RefObject } from 'react';
import './pix.css';
import type { Host, HostSnapshot } from '../host';
import { formatCents } from '../lib/format';
import { COPY_FAILED_TEXT, useCopy } from '../lib/useCopy';
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
  const [gaveUp, setGaveUp] = useState(false);
  const polling = status === 'pending' && canCallTools && !!charge.poll && !gaveUp;
  useEffect(() => {
    if (!polling || !charge.poll) return;
    const poll = charge.poll;
    const startedAt = Date.now();
    let timer = 0;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const expiredFor = charge.expiresAt ? Date.now() - Date.parse(charge.expiresAt) : -1;
      if (expiredFor > GRACE_AFTER_EXPIRY_MS || Date.now() - startedAt > POLL_LIMIT_MS) {
        if (expiredFor > 0) setStatus('expired');
        else setGaveUp(true);
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
  }, [host, charge, polling]);

  useEffect(() => {
    if (status === charge.status || !FINAL_STATUSES.has(status)) return;
    const what = `${charge.title}${charge.id ? ` ${charge.id}` : ''}`;
    host.tellModel(`${what}: ${STATUS_TEXT[status].toLowerCase()} (visto na tela do PIX).`);
  }, [host, charge, status]);

  return { status, polling, gaveUp };
}

function CopyButton({ code, field }: { code: string; field: RefObject<HTMLInputElement | null> }) {
  const [state, copy] = useCopy();
  // No clipboard in this sandbox: select the code so Ctrl/Cmd+C finishes the job.
  useEffect(() => {
    if (state !== 'failed') return;
    field.current?.focus();
    field.current?.select();
  }, [state, field]);
  const label = state === 'copied' ? 'Código copiado' : state === 'failed' ? COPY_FAILED_TEXT : 'Copiar código PIX';
  return <button className="cta" type="button" onClick={() => void copy(code)}>{label}</button>;
}

function Charge({ host, charge, canCallTools }: { host: Host; charge: PixCharge; canCallTools: boolean }) {
  const { status, polling, gaveUp } = usePolledStatus(host, charge, canCallTools);
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
        <div className="meta">
          <span className="pill" role="status" data-status={status}>{STATUS_TEXT[status] ?? status}</span>
          {open && charge.expiresAt && <span className="muted num">{remaining ? `expira em ${remaining}` : polling ? 'prazo encerrado, conferindo' : 'prazo encerrado'}</span>}
          {!charge.livemode && <span className="badge">MODO TESTE</span>}
        </div>
        {charge.code && open && <input ref={field} className="code" value={charge.code} readOnly aria-label="Código PIX copia e cola" />}
        {charge.code && open && <CopyButton code={charge.code} field={field} />}
        {open && gaveUp && <p className="note faint">Paramos de conferir. Peça para verificar o pagamento de novo.</p>}
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
