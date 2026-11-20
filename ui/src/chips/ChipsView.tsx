import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Power, PowerOff, QrCode, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/dashboard.css';
import './chips.css';
import type { Host, HostSnapshot } from '../host';
import { BackButton } from '../lib/BackButton';
import { ConfirmPanel } from '../lib/ConfirmPanel';
import { plural } from '../lib/format';
import { messageOf } from '../lib/messageOf';
import { COPY_FAILED_TEXT, useCopy } from '../lib/useCopy';
import {
  MAX_ACTIVE_CHIPS, PROVIDER, activeChips, canPair, chipsNeedingAction, needsRestart, chipStatus, formatCode, pairingPhone, phoneLabel, sessionByChip, summarizeHealth,
  type HealthOutcome, summarizeChip, summarizeChips, summarizePairing, type Chip,
} from './model';

/** How often the chip is read while the seller types the code, and for how long. */
const POLL_MS = 4000;
const POLL_FOR_MS = 3 * 60 * 1000;


/** How often the clock behind the removal countdowns ticks while a chip is marked for removal. */
const CLOCK_MS = 60_000;

/** The time the countdowns read: ticks every minute, only while some chip is marked for removal. */
function useRemovalClock(chips: readonly Chip[] | null): number {
  const [now, setNow] = useState(Date.now);
  const counting = Boolean(chips?.some((c) => c.removalAt));
  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [counting]);
  return now;
}

/** WaStatus: the chip's state as a dot and a word, explained on hover (also drawn by the operations view). */
export function Status({ chip, now = Date.now() }: { chip: Chip; now?: number }) {
  const { label, tone, pulse, description } = chipStatus(chip, now);
  return <span className="ch-status" data-tone={tone} title={description || undefined}><span className="ch-dot" data-pulse={pulse || undefined} aria-hidden />{label}</span>;
}

/** ChipProviderBadge: "Meta oficial" (API Oficial) or "WhatsApp GG" (WAHA, by QR Code), explained on hover. */
function Provider({ provider }: { provider: Chip['provider'] }) {
  const { label, description } = PROVIDER[provider];
  return (
    <span className="ch-provider" data-meta={provider === 'meta' || undefined} title={description}>
      {provider === 'meta' ? <ShieldCheck size={12} aria-hidden /> : <QrCode size={12} aria-hidden />}
      {label}
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
  const [copyState, copy] = useCopy();
  const copied = copyState === 'copied';

  useEffect(() => {
    if (!code || expired) return;
    let live = true;
    let timer = 0;
    // Self-rescheduling: the next read starts only after the previous one settled.
    const tick = async () => {
      if (!live) return;
      if (Date.now() - since > POLL_FOR_MS) {
        setExpired(true);
        return;
      }
      try {
        const fresh = summarizeChip(await host.callTool('get_whatsapp_number', { numberId: chip.id }));
        if (live && fresh?.status === 'authenticated') {
          onConnected(fresh);
          host.tellModel(`O chip ${fresh.name} foi conectado pela tela do chat.`);
          return;
        }
      } catch {
        // A failed read is retried on the next tick.
      }
      if (live) timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => { live = false; clearTimeout(timer); };
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
      const message = messageOf(err);
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
          <button type="button" className="ch-code mono" onClick={() => void copy(formatCode(code))} title="Clique para copiar">
            <span>{formatCode(code)}</span>
            {copied ? <Check size={16} className="ch-copied" aria-label="Copiado!" /> : <Copy size={16} aria-hidden />}
          </button>
          <p className="copy-failed status-region" role="status">{copyState === 'failed' ? COPY_FAILED_TEXT : ''}</p>
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

/** ChipConnectedCard: the operations that use the chip and its role in each. */
function UsedBy({ uses }: { uses: NonNullable<Chip['usedBy']> }) {
  return (
    <section className="ch-panel">
      <h3 className="ch-panel-title">Operações que usam este chip</h3>
      <p className="ch-hint">Cada operação define em qual papel (principal ou reserva) o chip atua.</p>
      {uses.length ? (
        <ul className="ch-uses">
          {uses.map((u) => <li key={u.sessionId}><span>{u.name}</span><span className="ch-tag">{u.role === 'primary' ? 'Principal' : 'Reserva'}</span></li>)}
        </ul>
      ) : (
        <p className="ch-note">Este chip ainda não está em nenhuma operação. Vá em <strong>Operações</strong> pra atribuir.</p>
      )}
    </section>
  );
}

/** ChipDetailPage: the chip, connecting it with a code, its operations, and "Reiniciar" behind a confirmation. */
function ChipDetail({ host, first, firstCode = null, canCallTools, onBack, onChange }: {
  host: Host; first: Chip; firstCode?: string | null; canCallTools: boolean; onBack?: () => void; onChange?: (chip: Chip) => void;
}) {
  const [chip, setChipState] = useState(first);
  /** The detail's chip, also reported to the parent so the list shows it after "Voltar". */
  const setChip = useCallback((next: Chip) => {
    setChipState(next);
    onChange?.(next);
  }, [onChange]);
  // One confirmation at a time: the action that is waiting for its "yes".
  const [confirming, setConfirming] = useState<'restart' | 'toggle' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  async function restart() {
    setBusy(true);
    setError(null);
    try {
      await host.callTool('restart_whatsapp_number', { numberId: chip.id });
      setRound((n) => n + 1);
      host.tellModel(`O chip ${chip.name} foi reiniciado pela tela do chat e precisa ser conectado de novo.`);
      // The restart happened: a failed refresh must not read as a failed restart.
      try {
        const fresh = summarizeChip(await host.callTool('get_whatsapp_number', { numberId: chip.id }));
        if (fresh) setChip(fresh);
      } catch {
        setError('Chip reiniciado, mas não foi possível atualizar o status agora.');
      }
    } catch {
      setError('Falha ao reiniciar chip. Tenta de novo em alguns segundos.');
    } finally {
      setBusy(false);
      setConfirming(null);
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
      setConfirming(null);
    }
  }

  const connected = chip.status === 'authenticated';
  // A chip marked by the seller stays out of the restart; one marked for lack of a connection is kept by connecting it.
  const canRestart = chip.provider === 'waha' && (!chip.removalAt || chip.removalReason === 'disconnected');
  return (
    <div className="ch-detail">
      {onBack && <BackButton onBack={onBack} label="Voltar pros chips" />}
      <section className="surface ch-card">
        <header className="ch-head">
          <span className="ch-icon big" aria-hidden><Smartphone size={20} /></span>
          <div className="ch-head-main">
            <h2 className="ch-name">{chip.name}</h2>
            <p className="ch-sub"><span className="num">{phoneLabel(chip.phone)}</span><Status chip={chip} /><Provider provider={chip.provider} /></p>
          </div>
          {canCallTools && !confirming && (canRestart || !chip.removalAt) && (
            <div className="ch-actions">
              {canRestart && (
                <button type="button" className="ch-ghost" onClick={() => setConfirming('restart')} disabled={busy}><RefreshCw size={14} aria-hidden />Reiniciar</button>
              )}
              {/* A chip marked for removal does not send: the seller undoes the mark in the dashboard, not here. */}
              {!chip.removalAt && (
                <button type="button" className="ch-ghost" onClick={() => setConfirming('toggle')} disabled={busy}>
                  {chip.isActive ? <><PowerOff size={14} aria-hidden />Desativar</> : <><Power size={14} aria-hidden />Reativar</>}
                </button>
              )}
            </div>
          )}
        </header>
        {confirming === 'restart' && (
          <ConfirmPanel
            label="Reiniciar chip"
            tone="warning"
            message={connected ? 'Reiniciar desconecta este chip: ele para de enviar até ser conectado de novo.' : 'Reiniciar volta o chip ao início da conexão. Use quando ele travar.'}
            confirmLabel="Reiniciar"
            busyLabel="Reiniciando…"
            busy={busy}
            onConfirm={restart}
            onCancel={() => setConfirming(null)}
          />
        )}
        {confirming === 'toggle' && (
          <ConfirmPanel
            label={chip.isActive ? 'Desativar chip' : 'Reativar chip'}
            tone={chip.isActive ? 'warning' : undefined}
            message={chip.isActive ? 'Desativar faz este chip parar de enviar mensagens até ser reativado.' : 'Reativar faz este chip voltar a enviar mensagens pelas operações que o usam.'}
            confirmLabel={chip.isActive ? 'Desativar' : 'Reativar'}
            busyLabel={chip.isActive ? 'Desativando…' : 'Reativando…'}
            busy={busy}
            onConfirm={toggleActive}
            onCancel={() => setConfirming(null)}
          />
        )}
        {error && <p className="ch-alert" role="alert">{error}</p>}
        {chip.errorMessage && ['error', 'banned', 'disconnected'].includes(chip.status) && <p className="ch-alert">{chip.errorMessage}</p>}
        {chip.removalAt
          ? <p className="ch-note" data-tone="warning">{chipStatus(chip, Date.now()).description}</p>
          : !chip.isActive && <p className="ch-note">Este chip está desativado e não envia por nenhuma operação.</p>}
        {canCallTools && canPair(chip) && (
          <PairPanel key={round} host={host} chip={chip} firstCode={round === 0 ? firstCode : null} onConnected={setChip} />
        )}
        {canCallTools && needsRestart(chip) && (
          <p className="ch-note">Este chip desconectou. Clique em <strong>Reiniciar</strong> para conectar de novo.</p>
        )}
        {chip.usedBy && connected && !chip.removalAt && <UsedBy uses={chip.usedBy} />}
      </section>
    </div>
  );
}

/** One chip as a row (the list and the "pedem ação" row): name, number, type, status, operation and count. */
function ChipRow({ chip, sessions, now, canOpen, busy, onOpen, unlinkedLabel = 'Não vinculado' }: {
  chip: Chip; sessions: Record<string, string> | null; now: number; canOpen: boolean; busy: boolean; onOpen: (chip: Chip) => void;
  /** The list says "Não vinculado"; the "pedem ação" row, "Sem operação" (as the dashboard words each). */
  unlinkedLabel?: string;
}) {
  const body = (
    <>
      <span className="ch-icon" aria-hidden><Smartphone size={16} /></span>
      <span className="ch-row-main">
        <span className="ch-row-name">{chip.name}</span>
        <span className="ch-sub"><span className="num">{phoneLabel(chip.phone)}</span><Provider provider={chip.provider} /></span>
      </span>
      <span className="ch-row-side">
        <Status chip={chip} now={now} />
        {sessions && <span className="ch-session" data-none={!sessions[chip.id] || undefined}>{sessions[chip.id] ?? unlinkedLabel}</span>}
        <span className="ch-count num">{plural(chip.sessionsCount, 'operação', 'operações')}</span>
      </span>
      {canOpen && <ChevronRight size={16} className="ch-chevron" aria-hidden />}
    </>
  );
  return (
    <li className="ch-row" aria-busy={busy || undefined}>
      {canOpen
        ? <button type="button" className="ch-row-btn" onClick={() => onOpen(chip)} aria-label={`Abrir o chip ${chip.name}`}>{body}</button>
        : <div className="ch-row-btn">{body}</div>}
    </li>
  );
}

/**
 * ChipsNeedingAction: the chips that will be removed or that do not send until the seller acts, at the
 * top of the list and minimizable; each opens its detail, where it is fixed. Nothing pending, no row.
 */
function NeedingAction({ chips, sessions, now, canOpen, busyId, onOpen }: {
  chips: Chip[]; sessions: Record<string, string> | null; now: number; canOpen: boolean; busyId: string | null; onOpen: (chip: Chip) => void;
}) {
  const [isOpen, setOpen] = useState(true);
  const pending = chipsNeedingAction(chips);
  if (!pending.length) return null;
  return (
    <section className="ch-pending">
      <button type="button" className="ch-pending-head" onClick={() => setOpen((v) => !v)} aria-expanded={isOpen}>
        <AlertTriangle size={16} className="ch-pending-icon" aria-hidden />
        <span className="ch-pending-text">
          <span className="ch-pending-title">{pending.length === 1 ? '1 chip pede ação' : `${pending.length} chips pedem ação`}</span>
          <span className="ch-hint">Os que vão ser removidos e os que só voltam a enviar com você. Abra cada um para resolver.</span>
        </span>
        <span className="ch-pending-toggle" aria-hidden><span className="ch-pending-word">{isOpen ? 'Minimizar' : 'Mostrar'}</span><ChevronDown size={14} data-open={isOpen || undefined} aria-hidden /></span>
      </button>
      {isOpen && (
        <ul className="ch-rows">
          {pending.map((c) => <ChipRow key={c.id} chip={c} sessions={sessions} now={now} canOpen={canOpen} busy={busyId === c.id} onOpen={onOpen} unlinkedLabel="Sem operação" />)}
        </ul>
      )}
    </section>
  );
}

/** ChipsSection, as rows: the chips that need the seller first, then every chip, with the active count. */
function ChipsList({ chips, sessions, now, canOpen, busyId, onOpen, checking, health, onCheck, refreshing, onRefresh }: {
  chips: Chip[]; sessions: Record<string, string> | null; now: number; canOpen: boolean; busyId: string | null; onOpen: (chip: Chip) => void;
  checking: boolean; health: HealthOutcome | null; onCheck: () => void; refreshing: boolean; onRefresh: () => void;
}) {
  return (
    <section className="surface ch-card">
      <header className="ch-list-head">
        <div className="ch-list-title">
          <h2 className="card-title">Chips</h2>
          {canOpen && (
            <div className="ch-actions">
              <button type="button" className="ch-ghost" onClick={onCheck} disabled={checking} title="Confirma direto na conexão se o status mostrado é real">
                <ShieldCheck size={14} aria-hidden />{checking ? 'Verificando…' : 'Verificar status'}
              </button>
              <button type="button" className="ch-ghost" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw size={14} aria-hidden />{refreshing ? 'Atualizando…' : 'Atualizar'}
              </button>
            </div>
          )}
        </div>
        <p className="card-sub">Cada chip é uma conexão WhatsApp: WhatsApp GG, pelo QR Code, ou Meta oficial. Atribua a uma operação pra usar em envios.</p>
      </header>
      {health && (
        <div className="ch-health" data-tone={health.tone} role="status">
          <p className="ch-health-title">{health.title}</p>
          {health.detail && <p>{health.detail}</p>}
        </div>
      )}
      <NeedingAction chips={chips} sessions={sessions} now={now} canOpen={canOpen} busyId={busyId} onOpen={onOpen} />
      {chips.length > 0 && (
        <p className="ch-hint num">{plural(activeChips(chips), 'chip ativo', 'chips ativos')} / {MAX_ACTIVE_CHIPS}</p>
      )}
      {chips.length ? (
        <ul className="ch-rows">
          {chips.map((c) => <ChipRow key={c.id} chip={c} sessions={sessions} now={now} canOpen={canOpen} busy={busyId === c.id} onOpen={onOpen} />)}
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, string> | null>(null);
  const [list, setList] = useState<Chip[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<HealthOutcome | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const numberId = typeof state.args.numberId === 'string' ? state.args.numberId : null;

  // get_pairing_code answers the code alone: the chip is read to draw it around the code.
  useEffect(() => {
    if (!parts.code || !numberId || !state.canCallTools) return;
    host.callTool('get_whatsapp_number', { numberId })
      .then((data) => setOpen(summarizeChip(data)))
      .catch(() => setLoadError('Não foi possível carregar o chip. Tente novamente.'));
  }, [host, parts.code, numberId, state.canCallTools]);

  /** The list's "Operação": the first operation that uses each chip. */
  const readSessions = useCallback(
    () => host.callTool('list_whatsapp_sessions', {}).then((data) => setSessions(sessionByChip(data))).catch(() => setSessions(null)),
    [host],
  );
  useEffect(() => {
    if (parts.chips && state.canCallTools) void readSessions();
  }, [parts.chips, state.canCallTools, readSessions]);

  useEffect(() => {
    if (parts.chip) host.tellModel(`Chip ${parts.chip.name} aberto na tela do chat.`);
    else if (parts.chips) host.tellModel('Lista de chips do WhatsApp aberta na tela do chat.');
    else if (parts.code) host.tellModel('Código de pareamento mostrado na tela do chat, com os passos no celular.');
  }, [host, parts]);

  async function openChip(c: Chip) {
    setBusyId(c.id);
    setLoadError(null);
    try {
      const full = summarizeChip(await host.callTool('get_whatsapp_number', { numberId: c.id }));
      if (!full) throw new Error('no chip');
      setOpen(full);
    } catch {
      setLoadError('Não foi possível carregar o chip. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  }

  /** "Verificar status": the live check corrects the stored status, then the list is read again. */
  async function checkStatus() {
    setChecking(true);
    try {
      const outcome = summarizeHealth(await host.callTool('check_whatsapp_numbers', {}));
      setHealth(outcome ?? { tone: 'danger', title: 'Falha no health check', detail: null });
      const fresh = summarizeChips(await host.callTool('list_whatsapp_numbers', {}));
      if (fresh) setList(fresh);
      if (outcome) host.tellModel(`Status dos chips verificado na tela do chat: ${outcome.title}.`);
    } catch (e) {
      setHealth({ tone: 'danger', title: 'Falha no health check', detail: messageOf(e) || 'Erro desconhecido.' });
    } finally {
      setChecking(false);
    }
  }

  /** "Atualizar": the chips and their operations read again, as the dashboard's refresh. */
  async function refresh() {
    setRefreshing(true);
    setLoadError(null);
    try {
      const [fresh] = await Promise.all([host.callTool('list_whatsapp_numbers', {}), readSessions()]);
      const next = summarizeChips(fresh);
      if (!next) throw new Error('no chips');
      setList(next);
    } catch {
      setLoadError('Não foi possível atualizar os chips. Tente novamente.');
    } finally {
      setRefreshing(false);
    }
  }

  const { chip, code } = parts;
  const chips = parts.chips && (list ?? parts.chips);
  const now = useRemovalClock(chips);
  /** A chip changed in the detail replaces its row, so "Voltar" does not show the old status. */
  const replaceChip = useCallback((next: Chip) => {
    setList((cur) => (cur ?? parts.chips ?? []).map((c) => (c.id === next.id ? next : c)));
  }, [parts.chips]);
  if (!chip && !chips && !code) return <p className="state" data-tone="error">A resposta não trouxe chips do WhatsApp.</p>;
  return (
    <div className="dashboard chips">
      {loadError && <p className="ch-alert" role="alert">{loadError}</p>}
      {chip && <ChipDetail host={host} first={chip} canCallTools={state.canCallTools} />}
      {chips && (
        <>
          {open && <ChipDetail key={open.id} host={host} first={open} canCallTools={state.canCallTools} onBack={() => setOpen(null)} onChange={replaceChip} />}
          <div hidden={Boolean(open)}>
            <ChipsList chips={chips} sessions={sessions} now={now} canOpen={state.canCallTools} busyId={busyId} onOpen={openChip}
              checking={checking} health={health} onCheck={checkStatus} refreshing={refreshing} onRefresh={refresh} />
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
