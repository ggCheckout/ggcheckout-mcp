import { Check, ChevronLeft, ChevronRight, Copy, Power, PowerOff, QrCode, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import './chips.css';
import type { Host, HostSnapshot } from '../host';
import { useCopy } from '../lib/useCopy';
import {
  canPair, needsRestart, chipStatus, formatCode, pairingPhone, phoneLabel, sessionByChip, sessionsLabel, summarizeChip, summarizeChips, summarizePairing, type Chip,
} from './model';

/** How often the chip is read while the seller types the code, and for how long. */
const POLL_MS = 4000;
const POLL_FOR_MS = 3 * 60 * 1000;

const errorText = (e: unknown) => (e instanceof Error ? e.message : '');

function Status({ chip }: { chip: Chip }) {
  const { label, tone, pulse } = chipStatus(chip.status, chip.isActive);
  return <span className="ch-status" data-tone={tone}><span className="ch-dot" data-pulse={pulse || undefined} aria-hidden />{label}</span>;
}

/** ChipProviderBadge: "Oficial" (Meta) or "QR Code" (WAHA). */
function Provider({ provider }: { provider: Chip['provider'] }) {
  return (
    <span className="ch-provider" data-meta={provider === 'meta' || undefined}>
      {provider === 'meta' ? <ShieldCheck size={12} aria-hidden /> : <QrCode size={12} aria-hidden />}
      {provider === 'meta' ? 'Oficial' : 'QR Code'}
    </span>
  );
}

/**
 * "Conecte o chip": the dashboard shows a QR, the chat a code. The seller types the chip's number,
 * gets the code and types it on the phone; the chip is read until it connects or the code expires.
 */
function PairPanel({ host, chip, firstCode, onConnected }: {
  host: Host; chip: Chip; firstCode: string | null; onConnected: (chip: Chip) => void;
}) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(firstCode);
  const [since, setSince] = useState(firstCode ? Date.now() : 0);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, copy] = useCopy();

  useEffect(() => {
    if (!code || expired) return;
    let live = true;
    const timer = setInterval(async () => {
      if (Date.now() - since > POLL_FOR_MS) {
        setExpired(true);
        return;
      }
      try {
        const fresh = summarizeChip(await host.callTool('get_whatsapp_number', { numberId: chip.id }));
        if (live && fresh?.status === 'authenticated') {
          onConnected(fresh);
          host.tellModel(`O chip ${fresh.name} foi conectado pela tela do chat.`);
        }
      } catch {
        // A failed read is retried on the next tick.
      }
    }, POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, [host, chip.id, code, since, expired, onConnected]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const phoneNumber = pairingPhone(phone);
    if (!phoneNumber) {
      setError('Digite o número do chip com DDD.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = summarizePairing(await host.callTool('get_pairing_code', { numberId: chip.id, phoneNumber }));
      if (!next) throw new Error('no code');
      setCode(next);
      setSince(Date.now());
      setExpired(false);
      host.tellModel(`Código de pareamento do chip ${chip.name} gerado na tela do chat.`);
    } catch (err) {
      const message = errorText(err);
      setError(/ALREADY_AUTHENTICATED|já está conectado/i.test(message) ? 'Este chip já está conectado.' : 'Não foi possível gerar o código. Confira o número e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ch-panel">
      <h3 className="ch-panel-title">Conecte o chip</h3>
      {code && !expired ? (
        <>
          <ol className="ch-steps">
            <li>Abra o WhatsApp no celular deste chip.</li>
            <li>Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar um aparelho</strong>.</li>
            <li>Toque em <strong>Conectar com número de telefone</strong> e digite o código abaixo.</li>
          </ol>
          <button type="button" className="ch-code mono" onClick={() => copy(formatCode(code))} title="Clique para copiar">
            <span>{formatCode(code)}</span>
            {copied ? <Check size={16} className="ch-copied" aria-label="Copiado!" /> : <Copy size={16} aria-hidden />}
          </button>
          <p className="ch-waiting" role="status"><span className="ch-dot" data-pulse aria-hidden />Aguardando a conexão no celular…</p>
        </>
      ) : (
        <>
          <p className="ch-hint">
            {expired
              ? 'O código expirou antes da conexão. Gere outro e digite no celular.'
              : 'Digite o número do WhatsApp deste chip. Vamos gerar um código para você digitar no celular, sem precisar do QR.'}
          </p>
          <form className="ch-form" onSubmit={generate}>
            <label className="ch-label" htmlFor="ch-phone">Número com DDD</label>
            <div className="ch-form-row">
              <input id="ch-phone" className="ch-input num" inputMode="tel" autoComplete="off" placeholder="(31) 99999-9999"
                value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
              <button type="submit" className="cta" disabled={busy}>{busy ? 'Gerando…' : 'Gerar código'}</button>
            </div>
          </form>
        </>
      )}
      {error && <p className="ch-alert" role="alert">{error}</p>}
    </section>
  );
}

/** ChipConnectedCard: the sessions that use the chip and its role in each. */
function UsedBy({ uses }: { uses: NonNullable<Chip['usedBy']> }) {
  return (
    <section className="ch-panel">
      <h3 className="ch-panel-title">Sessões que usam este chip</h3>
      <p className="ch-hint">Cada sessão define em qual papel (principal ou reserva) o chip atua.</p>
      {uses.length ? (
        <ul className="ch-uses">
          {uses.map((u) => <li key={u.sessionId}><span>{u.name}</span><span className="ch-tag">{u.role === 'primary' ? 'Principal' : 'Reserva'}</span></li>)}
        </ul>
      ) : (
        <p className="ch-note">Este chip ainda não está vinculado a nenhuma sessão. Vá em <strong>Sessões</strong> pra atribuir.</p>
      )}
    </section>
  );
}

/** ChipDetailPage: the chip, connecting it with a code, its sessions, and "Reiniciar" behind a confirmation. */
function ChipDetail({ host, first, firstCode = null, canCallTools, onBack }: {
  host: Host; first: Chip; firstCode?: string | null; canCallTools: boolean; onBack?: () => void;
}) {
  const [chip, setChip] = useState(first);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  async function restart() {
    setBusy(true);
    setError(null);
    try {
      await host.callTool('restart_whatsapp_number', { numberId: chip.id });
      const fresh = summarizeChip(await host.callTool('get_whatsapp_number', { numberId: chip.id }));
      if (fresh) setChip(fresh);
      setRound((n) => n + 1);
      host.tellModel(`O chip ${chip.name} foi reiniciado pela tela do chat e precisa ser conectado de novo.`);
    } catch {
      setError('Falha ao reiniciar chip. Tenta de novo em alguns segundos.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  /** "Desativar" / "Reativar": update_whatsapp_number answers the chip as it is now. */
  async function toggleActive() {
    const wasActive = chip.isActive;
    setBusy(true);
    setError(null);
    try {
      const fresh = summarizeChip(await host.callTool('update_whatsapp_number', { numberId: chip.id, isActive: !wasActive }));
      setChip(fresh ? { ...fresh, usedBy: fresh.usedBy ?? chip.usedBy } : { ...chip, isActive: !wasActive });
      host.tellModel(`O chip ${chip.name} foi ${wasActive ? 'desativado' : 'reativado'} pela tela do chat.`);
    } catch {
      setError(`${wasActive ? 'Falha ao desativar chip' : 'Falha ao reativar chip'}. Tenta de novo em alguns segundos.`);
    } finally {
      setBusy(false);
    }
  }

  const connected = chip.status === 'authenticated';
  return (
    <div className="ch-detail">
      {onBack && <button type="button" className="ch-back" onClick={onBack}><ChevronLeft size={15} aria-hidden />Voltar pros chips</button>}
      <section className="surface ch-card">
        <header className="ch-head">
          <span className="ch-icon big" aria-hidden><Smartphone size={20} /></span>
          <div className="ch-head-main">
            <h2 className="ch-name">{chip.name}</h2>
            <p className="ch-sub"><span className="num">{phoneLabel(chip.phone)}</span><Status chip={chip} /><Provider provider={chip.provider} /></p>
          </div>
          {canCallTools && !confirming && (
            <div className="ch-actions">
              {chip.provider === 'waha' && (
                <button type="button" className="ch-ghost" onClick={() => setConfirming(true)} disabled={busy}><RefreshCw size={14} aria-hidden />Reiniciar</button>
              )}
              <button type="button" className="ch-ghost" onClick={toggleActive} disabled={busy}>
                {chip.isActive ? <><PowerOff size={14} aria-hidden />Desativar</> : <><Power size={14} aria-hidden />Reativar</>}
              </button>
            </div>
          )}
        </header>
        {confirming && (
          <div className="ch-confirm" role="alertdialog" aria-label="Reiniciar chip">
            <p>{connected ? 'Reiniciar desconecta este chip: ele para de enviar até ser conectado de novo.' : 'Reiniciar volta o chip ao início da conexão. Use quando ele travar.'}</p>
            <div className="ch-confirm-actions">
              <button type="button" className="ch-ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</button>
              <button type="button" className="cta" onClick={restart} disabled={busy}>{busy ? 'Reiniciando…' : 'Reiniciar'}</button>
            </div>
          </div>
        )}
        {error && <p className="ch-alert" role="alert">{error}</p>}
        {chip.errorMessage && ['error', 'banned', 'disconnected'].includes(chip.status) && <p className="ch-alert">{chip.errorMessage}</p>}
        {!chip.isActive && <p className="ch-note">Este chip está desativado e não envia por nenhuma sessão.</p>}
        {canCallTools && canPair(chip) && (
          <PairPanel key={round} host={host} chip={chip} firstCode={round === 0 ? firstCode : null} onConnected={setChip} />
        )}
        {canCallTools && needsRestart(chip) && (
          <p className="ch-note">Este chip desconectou. Clique em <strong>Reiniciar</strong> para conectar de novo.</p>
        )}
        {chip.usedBy && connected && <UsedBy uses={chip.usedBy} />}
      </section>
    </div>
  );
}

/** ChipsGrid, as rows: name, number, provider, status and how many sessions use the chip. */
function ChipsList({ chips, sessions, canOpen, busyId, onOpen }: {
  chips: Chip[]; sessions: Record<string, string> | null; canOpen: boolean; busyId: string | null; onOpen: (chip: Chip) => void;
}) {
  return (
    <section className="surface ch-card">
      <header className="ch-list-head">
        <h2 className="card-title">Chips</h2>
        <p className="card-sub">Cada chip é uma conexão WhatsApp: API Oficial (Meta) ou QR Code. Atribua a uma sessão pra usar em envios.</p>
      </header>
      {chips.length ? (
        <ul className="ch-rows">
          {chips.map((c) => {
            const body = (
              <>
                <span className="ch-icon" aria-hidden><Smartphone size={16} /></span>
                <span className="ch-row-main">
                  <span className="ch-row-name">{c.name}</span>
                  <span className="ch-sub"><span className="num">{phoneLabel(c.phone)}</span><Provider provider={c.provider} /></span>
                </span>
                <span className="ch-row-side">
                  <Status chip={c} />
                  {sessions && <span className="ch-session" data-none={!sessions[c.id] || undefined}>{sessions[c.id] ?? 'Não vinculado'}</span>}
                  <span className="ch-count num">{sessionsLabel(c.sessionsCount)}</span>
                </span>
                {canOpen && <ChevronRight size={16} className="ch-chevron" aria-hidden />}
              </>
            );
            return (
              <li key={c.id} className="ch-row" aria-busy={busyId === c.id || undefined}>
                {canOpen
                  ? <button type="button" className="ch-row-btn" onClick={() => onOpen(c)} aria-label={`Abrir o chip ${c.name}`}>{body}</button>
                  : <div className="ch-row-btn">{body}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">Nenhum chip cadastrado ainda.</p>
      )}
    </section>
  );
}

/** Chips view: list_whatsapp_numbers, get_whatsapp_number and get_pairing_code. */
export function ChipsView({ host, state }: { host: Host; state: HostSnapshot }) {
  const parts = useMemo(() => {
    const chip = summarizeChip(state.payload);
    const chips = chip ? null : summarizeChips(state.payload);
    const code = chip || chips ? null : summarizePairing(state.payload);
    return { chip, chips, code };
  }, [state.payload]);
  const [open, setOpen] = useState<Chip | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sessions, setSessions] = useState<Record<string, string> | null>(null);
  const numberId = typeof state.args.numberId === 'string' ? state.args.numberId : null;

  // get_pairing_code answers the code alone: the chip is read to draw it around the code.
  useEffect(() => {
    if (!parts.code || !numberId || !state.canCallTools) return;
    host.callTool('get_whatsapp_number', { numberId })
      .then((data) => setOpen(summarizeChip(data)))
      .catch(() => setFailed(true));
  }, [host, parts.code, numberId, state.canCallTools]);

  // The list's "Sessão": the first session that uses each chip, read once.
  useEffect(() => {
    if (!parts.chips || !state.canCallTools) return;
    host.callTool('list_whatsapp_sessions', {}).then((data) => setSessions(sessionByChip(data))).catch(() => setSessions(null));
  }, [host, parts.chips, state.canCallTools]);

  useEffect(() => {
    if (parts.chip) host.tellModel(`Chip ${parts.chip.name} aberto na tela do chat.`);
    else if (parts.chips) host.tellModel('Lista de chips do WhatsApp aberta na tela do chat.');
    else if (parts.code) host.tellModel('Código de pareamento mostrado na tela do chat, com os passos no celular.');
  }, [host, parts]);

  async function openChip(c: Chip) {
    setBusyId(c.id);
    setFailed(false);
    try {
      const full = summarizeChip(await host.callTool('get_whatsapp_number', { numberId: c.id }));
      if (!full) throw new Error('no chip');
      setOpen(full);
    } catch {
      setFailed(true);
    } finally {
      setBusyId(null);
    }
  }

  const { chip, chips, code } = parts;
  if (!chip && !chips && !code) return <p className="state" data-tone="error">A resposta não trouxe chips do WhatsApp.</p>;
  return (
    <div className="dashboard chips">
      {failed && <p className="ch-alert" role="alert">Não foi possível carregar o chip. Tente novamente.</p>}
      {chip && <ChipDetail host={host} first={chip} canCallTools={state.canCallTools} />}
      {chips && (
        <>
          {open && <ChipDetail key={open.id} host={host} first={open} canCallTools={state.canCallTools} onBack={() => setOpen(null)} />}
          <div hidden={Boolean(open)}>
            <ChipsList chips={chips} sessions={sessions} canOpen={state.canCallTools} busyId={busyId} onOpen={openChip} />
          </div>
        </>
      )}
      {code && (open
        ? <ChipDetail key={open.id} host={host} first={open} firstCode={code} canCallTools={state.canCallTools} />
        : (
          <section className="surface ch-card">
            <p className="ch-hint">Código de pareamento:</p>
            <p className="ch-code mono">{formatCode(code)}</p>
          </section>
        ))}
    </div>
  );
}
