import { Ban, Play, RotateCcw, Send, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Host } from '../host';
import { BackButton } from '../lib/BackButton';
import { ConfirmPanel } from '../lib/ConfirmPanel';
import {
  MAX_REPLY_CHARS, MESSAGES_PAGE, POLL_MS, bodyOf, clockLabel, codePointLength, contactLabel, conversationLabels, errorText,
  latestIncomingId, mergeMessages, nextFunnelsAfter, pendingFor, replyProblem, runLabel, startOutcome, toContactRun, toFunnelOptions, toMessages,
  type Conversation, type FunnelOption, type PendingSend, type Run, type ThreadMessage,
} from './model';
import { startVisiblePolling } from './poll';

type Confirming = 'start' | 'stop' | 'optout' | null;

/** Safety cap on the funnel pages read for the picker (50 each). */
const FUNNEL_PAGES = 20;

/** The enabled manual funnels, across every page of list_whatsapp_funnels; null when unreadable. */
export async function loadManualFunnels(host: Host): Promise<FunnelOption[] | null> {
  const all: FunnelOption[] = [];
  let after: string | null = null;
  for (let page = 0; page < FUNNEL_PAGES; page++) {
    const data = await host.callTool('list_whatsapp_funnels', { limit: 50, ...(after ? { after } : {}) });
    const options = toFunnelOptions(data);
    if (!options) return page === 0 ? null : all;
    all.push(...options);
    after = nextFunnelsAfter(data);
    if (!after) break;
  }
  return all;
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
 * A conversation: its messages (read again every 10 s while the tab is visible), the composer, and
 * the funnel actions. It marks the thread read when it opens and again when the contact writes
 * while it is open. Everything it reads or sends goes through the app-only tools of the server.
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

  useEffect(() => startVisiblePolling(async () => {
    await Promise.allSettled([loadHead(), loadRun()]);
  }, POLL_MS), [loadHead, loadRun]);

  // The contact wrote while the thread is open: it is read.
  useEffect(() => {
    if (!messages) return;
    const latest = latestIncomingId(messages);
    if (lastIncoming.current !== undefined && latest !== lastIncoming.current) markRead();
    lastIncoming.current = latest;
  }, [messages, markRead]);

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
      await loadHead().catch(() => {});
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
          <h2 className="ix-name">{label}</h2>
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
            <label className="ix-sr" htmlFor="ix-funnel">Funil manual</label>
            <select id="ix-funnel" className="ix-select" value={funnelId} onChange={(e) => setFunnelId(e.target.value)} disabled={busy}>
              {funnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button type="button" className="ix-ghost" onClick={() => setConfirming('start')} disabled={busy || !funnelId}>
              <Play size={14} aria-hidden />Rodar funil
            </button>
          </span>
        ) : null}
        {conversation.optedOut ? (
          <button type="button" className="ix-ghost" onClick={() => void setOptOut(false)} disabled={busy}>
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
      {actionError && <p className="ix-alert" role="alert">{actionError}</p>}
      {actionNote && <p className="ix-note" role="status">{actionNote}</p>}
      {funnels && funnels.length === 0 && !running && (
        <p className="ix-hint">Nenhum funil manual ligado. Crie um funil manual e ligue-o para rodar aqui.</p>
      )}

      {loadError && <p className="ix-alert" role="alert">{loadError}</p>}
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
        <label className="ix-sr" htmlFor="ix-reply">Responder</label>
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
