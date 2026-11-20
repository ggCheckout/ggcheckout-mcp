import { Ban, Play, RotateCcw, Send, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Host } from '../host';
import { BackButton } from '../lib/BackButton';
import { ConfirmPanel } from '../lib/ConfirmPanel';
import { codePointLength } from '../lib/format';
import {
  MAX_REPLY_CHARS, MESSAGES_PAGE, bodyOf, clockLabel, contactLabel, conversationLabels, errorText,
  latestAutoId, latestIncomingId, mergeMessages, pendingFor, replyProblem, runLabel, startOutcome, toContactRun, toMessages,
  type Conversation, type FunnelOption, type PendingSend, type Run, type ThreadMessage,
} from './model';
import { PollNote } from './PollNote';
import { listAllFunnels } from '../whatsapp-funnels/funnelCalls';
import { useInboxPolling } from './useInboxPolling';

type Confirming = 'start' | 'stop' | 'optout' | 'optin' | null;

/** The enabled manual funnels, across the pages of list_whatsapp_funnels; null when unreadable. */
export async function loadManualFunnels(host: Host): Promise<FunnelOption[] | null> {
  const all = await listAllFunnels(host);
  return all && all.filter((f) => f.trigger === 'manual' && f.isEnabled).map((f) => ({ id: f.id, name: f.name }));
}

/** One bubble. The text goes in as a text node: whatever a customer wrote stays literal, never markup. */
export function Bubble({ message }: { message: ThreadMessage }) {
  return (
    <li className="ix-msg" data-dir={message.dir} data-auto={message.auto || undefined}>
      <p className="ix-bubble">{bodyOf(message)}</p>
      <span className="ix-meta">{message.auto ? 'Automática · ' : ''}{clockLabel(message.at)}</span>
    </li>
  );
}

/**
 * A conversation: its messages (read again every 10 s while the tab is visible, for 15 minutes or
 * until the API asks to wait), the composer, and the funnel actions. It marks the thread read when it
 * opens and again when the contact writes while it is open. The funnel run is read when the thread
 * opens, after an action, and when a new message shows it may have moved (the contact wrote, a funnel
 * step went out), not on every beat. Everything goes through the app-only tools of the server.
 */
export function Thread({ host, conversation, onBack, onRead, onOptOutChange }: {
  host: Host;
  conversation: Conversation;
  onBack: () => void;
  onRead: (key: string) => void;
  onOptOutChange: (key: string, optedOut: boolean) => void;
}) {
  const key = conversation.key;
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [older, setOlder] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const pending = useRef<PendingSend | null>(null);
  const [run, setRun] = useState<Run | null | undefined>(undefined);
  const [funnels, setFunnels] = useState<FunnelOption[] | null>(null);
  const [funnelId, setFunnelId] = useState('');
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const box = useRef<HTMLUListElement>(null);
  const stick = useRef(true);
  const cursorSet = useRef(false);
  const lastIncoming = useRef<string | null | undefined>(undefined);
  const lastAuto = useRef<string | null | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);

  const markRead = useCallback(() => {
    host.callTool('mark_whatsapp_conversation_read', { contactKey: key }).then(() => onRead(key)).catch(() => {});
  }, [host, key, onRead]);

  const loadHead = useCallback(async () => {
    const page = toMessages(await host.callTool('list_whatsapp_messages', { contactKey: key, limit: MESSAGES_PAGE }));
    if (!page) throw new Error('shape');
    setMessages((cur) => mergeMessages(cur ?? [], page.items));
    // The cursor to older messages comes from the first read only: a poll must not rewind it.
    if (!cursorSet.current) {
      cursorSet.current = true;
      setOlder(page.nextBefore);
    }
    setLoadError(null);
  }, [host, key]);

  const loadRun = useCallback(async () => {
    const next = toContactRun(await host.callTool('get_whatsapp_conversation_funnel', { contactKey: key }));
    if (next !== undefined) setRun(next);
  }, [host, key]);

  useEffect(() => {
    markRead();
    loadHead().catch((e) => setLoadError(errorText(e)));
    loadRun().catch(() => setRun(null));
    loadManualFunnels(host)
      .then((options) => {
        setFunnels(options);
        if (options?.length) setFunnelId((cur) => cur || options[0].id);
      })
      .catch(() => setFunnels(null));
  }, [host, markRead, loadHead, loadRun]);

  // The thread opened from a row that is gone now: the focus starts on the contact's name.
  useEffect(() => heading.current?.focus(), []);

  // A failed beat is tried again on the next one; the first read already says when it fails.
  const { pause, resume } = useInboxPolling(loadHead);

  // The contact wrote while the thread is open: it is read, and the run may have stopped on the reply.
  // A funnel step went out: the run moved a step.
  useEffect(() => {
    if (!messages) return;
    const incoming = latestIncomingId(messages);
    const auto = latestAutoId(messages);
    const incomingMoved = lastIncoming.current !== undefined && incoming !== lastIncoming.current;
    const autoMoved = lastAuto.current !== undefined && auto !== lastAuto.current;
    if (incomingMoved) markRead();
    if (incomingMoved || autoMoved) loadRun().catch(() => {});
    lastIncoming.current = incoming;
    lastAuto.current = auto;
  }, [messages, markRead, loadRun]);

  // Follow the newest message unless the seller scrolled up to read.
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!older) return;
    setLoadingOlder(true);
    try {
      const page = toMessages(await host.callTool('list_whatsapp_messages', { contactKey: key, limit: MESSAGES_PAGE, before: older }));
      if (!page) throw new Error('shape');
      stick.current = false;
      setMessages((cur) => mergeMessages(cur ?? [], page.items));
      setOlder(page.nextBefore);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const problem = replyProblem(draft);
    if (problem) {
      setSendError(problem);
      return;
    }
    // A failed send keeps its id, so sending the same text again cannot double the message.
    const attempt = pendingFor(pending.current, draft);
    pending.current = attempt;
    setSending(true);
    setSendError(null);
    try {
      await host.callTool('send_whatsapp_reply', { contactKey: key, text: draft, clientMessageId: attempt.clientMessageId });
      pending.current = null;
      setDraft('');
      stick.current = true;
      // The seller is here: one read now, and the beats start over with a fresh time cap (after a pause too).
      resume();
    } catch (err) {
      setSendError(errorText(err, 'Não foi possível enviar. Tente de novo: a mensagem não será repetida.'));
    } finally {
      setSending(false);
    }
  }

  async function act(work: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    setActionNote(null);
    try {
      await work();
    } catch (err) {
      setActionError(errorText(err));
      loadRun().catch(() => {});
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  const startFunnel = () => act(async () => {
    const outcome = startOutcome(await host.callTool('start_whatsapp_conversation_funnel', { contactKey: key, funnelId }));
    if (!outcome) throw new Error('shape');
    if (outcome.kind === 'refused') {
      setActionError(outcome.message);
      return;
    }
    if (outcome.run) setRun(outcome.run);
    setActionNote('Funil iniciado para este contato.');
    loadRun().catch(() => {});
  });

  const stopFunnel = () => act(async () => {
    await host.callTool('stop_whatsapp_conversation_funnel', { contactKey: key });
    setRun((cur) => (cur ? { ...cur, status: 'stopped' } : cur));
    setActionNote('Funil parado.');
    loadRun().catch(() => {});
  });

  const setOptOut = (optedOut: boolean) => act(async () => {
    await host.callTool('set_whatsapp_conversation_opt_out', { contactKey: key, optedOut });
    onOptOutChange(key, optedOut);
    setActionNote(optedOut ? 'Este contato não recebe mais funis nem envios.' : 'Este contato volta a receber envios.');
    loadRun().catch(() => {});
  });

  const label = contactLabel(conversation);
  const tags = conversationLabels(conversation);
  const running = runLabel(run ?? null);
  const used = codePointLength(draft);
  const funnelName = funnels?.find((f) => f.id === funnelId)?.name ?? 'o funil';

  return (
    <section className="surface ix-card ix-thread">
      <BackButton onBack={onBack} label="Voltar às conversas" />
      <header className="ix-thread-head">
        <div className="ix-thread-main">
          <h2 className="ix-name" ref={heading} tabIndex={-1}>{label}</h2>
          <p className="ix-tags">
            {running && <span className="ix-tag" data-tone="info">{running}</span>}
            {tags.map((t) => <span key={t} className="ix-tag" data-tone="warn">{t}</span>)}
          </p>
        </div>
      </header>

      <div className="ix-actions">
        {run?.status === 'running' ? (
          <button type="button" className="ix-ghost" onClick={() => setConfirming('stop')} disabled={busy}>
            <Square size={14} aria-hidden />Parar funil
          </button>
        ) : funnels && funnels.length > 0 && !conversation.optedOut ? (
          <span className="ix-run">
            <label className="sr-only" htmlFor="ix-funnel">Funil manual</label>
            <select id="ix-funnel" className="ix-select" value={funnelId} onChange={(e) => setFunnelId(e.target.value)} disabled={busy}>
              {funnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button type="button" className="ix-ghost" onClick={() => setConfirming('start')} disabled={busy || !funnelId}>
              <Play size={14} aria-hidden />Rodar funil
            </button>
          </span>
        ) : null}
        {conversation.optedOut ? (
          <button type="button" className="ix-ghost" onClick={() => setConfirming('optin')} disabled={busy}>
            <RotateCcw size={14} aria-hidden />Voltar a enviar
          </button>
        ) : (
          <button type="button" className="ix-ghost" onClick={() => setConfirming('optout')} disabled={busy}>
            <Ban size={14} aria-hidden />Parar funil e não enviar mais
          </button>
        )}
      </div>

      {confirming === 'start' && (
        <ConfirmPanel
          label="Rodar funil"
          message={`Rodar "${funnelName}" para este contato? As mensagens saem pelo WhatsApp, uma após a outra, com a espera de cada passo.`}
          confirmLabel="Rodar funil"
          busyLabel="Iniciando…"
          busy={busy}
          onConfirm={() => void startFunnel()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'stop' && (
        <ConfirmPanel
          label="Parar funil"
          tone="warning"
          message="Parar o funil deste contato? As próximas mensagens do funil não saem."
          confirmLabel="Parar funil"
          busyLabel="Parando…"
          busy={busy}
          onConfirm={() => void stopFunnel()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'optout' && (
        <ConfirmPanel
          label="Parar funil e não enviar mais"
          tone="warning"
          message="Isto para os funis deste contato e bloqueia qualquer envio automático para ele, incluindo a recuperação. Você pode desfazer em Voltar a enviar."
          confirmLabel="Não enviar mais"
          busyLabel="Salvando…"
          busy={busy}
          onConfirm={() => void setOptOut(true)}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'optin' && (
        <ConfirmPanel
          label="Voltar a enviar"
          message={conversation.exitRequested
            ? 'Este contato pediu para sair. Voltar a enviar libera os funis e os envios automáticos para ele de novo.'
            : 'Os funis e os envios automáticos voltam a poder sair para este contato. Um funil que foi parado continua parado.'}
          confirmLabel="Voltar a enviar"
          busyLabel="Salvando…"
          busy={busy}
          onConfirm={() => void setOptOut(false)}
          onCancel={() => setConfirming(null)}
        />
      )}
      {actionError && <p className="ix-alert" role="alert">{actionError}</p>}
      {/* Always mounted, only its text changes, so the note is announced when it appears. */}
      <p className="ix-note status-region" role="status">{actionNote}</p>
      {funnels && funnels.length === 0 && !running && (
        <p className="ix-hint">Nenhum funil manual ligado. Crie um funil manual e ligue-o para rodar aqui.</p>
      )}

      {loadError && <p className="ix-alert" role="alert">{loadError}</p>}
      <PollNote pause={pause} onResume={resume} />
      {messages === null && !loadError && <div className="skeleton" style={{ height: 160 }} aria-busy="true" />}
      {messages !== null && (
        <>
          {older && (
            <button type="button" className="ix-ghost ix-more" onClick={() => void loadOlder()} disabled={loadingOlder}>
              {loadingOlder ? 'Carregando…' : 'Mensagens anteriores'}
            </button>
          )}
          {messages.length === 0 ? (
            <p className="empty">Nenhuma mensagem nesta conversa ainda.</p>
          ) : (
            <ul
              className="ix-messages"
              ref={box}
              role="log"
              aria-label="Mensagens da conversa"
              onScroll={(e) => {
                const el = e.currentTarget;
                stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              }}
            >
              {messages.map((m) => <Bubble key={m.id} message={m} />)}
            </ul>
          )}
        </>
      )}

      <form className="ix-composer" onSubmit={send}>
        <label className="sr-only" htmlFor="ix-reply">Responder</label>
        <textarea
          id="ix-reply"
          className="ix-input"
          rows={2}
          placeholder="Escreva uma resposta"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send(e);
          }}
          disabled={sending}
        />
        <div className="ix-composer-row">
          <span className="ix-count num" data-over={used > MAX_REPLY_CHARS || undefined}>
            {used > MAX_REPLY_CHARS * 0.9 ? `${used}/${MAX_REPLY_CHARS}` : ''}
          </span>
          <button type="submit" className="cta" disabled={sending || !draft.trim()}>
            <Send size={14} aria-hidden />{sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        {sendError && <p className="ix-alert" role="alert">{sendError}</p>}
      </form>
    </section>
  );
}
