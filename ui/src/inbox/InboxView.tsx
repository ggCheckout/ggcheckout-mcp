import { ChevronRight, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/dashboard.css';
import './inbox.css';
import type { Host, HostSnapshot } from '../host';
import { plural } from '../lib/format';
import {
  CONVERSATIONS_PAGE, activityLabel, appendConversations, contactLabel, conversationLabels, errorText, mergeConversations,
  previewOf, summarizeInbox, toConversations, type Conversation,
} from './model';
import { PollNote } from './PollNote';
import { Thread } from './Thread';
import { useInboxPolling } from './useInboxPolling';

function Row({ conversation, onOpen }: { conversation: Conversation; onOpen: (c: Conversation) => void }) {
  const labels = conversationLabels(conversation);
  const name = contactLabel(conversation);
  return (
    <li className="ix-row">
      <button type="button" className="ix-row-btn" data-contact={conversation.key} onClick={() => onOpen(conversation)}
        aria-label={`Abrir a conversa com ${name}${conversation.unread ? `, ${plural(conversation.unread, 'não lida', 'não lidas')}` : ''}`}>
        <span className="ix-avatar" aria-hidden><MessageCircle size={16} /></span>
        <span className="ix-row-main">
          <span className="ix-row-top">
            <span className="ix-row-name" data-unread={conversation.unread > 0 || undefined}>{name}</span>
            <span className="ix-when">{activityLabel(conversation.lastAt)}</span>
          </span>
          <span className="ix-preview">{previewOf(conversation)}</span>
          {labels.length > 0 && (
            <span className="ix-tags">{labels.map((l) => <span key={l} className="ix-tag" data-tone="warn">{l}</span>)}</span>
          )}
        </span>
        {conversation.unread > 0 && <span className="ix-unread num" aria-hidden>{conversation.unread}</span>}
        <ChevronRight size={16} className="ix-chevron" aria-hidden />
      </button>
    </li>
  );
}

/**
 * The conversation list, read again every 10 s while the tab is visible and no thread is open (the
 * thread reads itself), for 15 minutes or until the API asks to wait; and the open thread.
 */
function Inbox({ host }: { host: Host }) {
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [older, setOlder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const rows = useRef<HTMLUListElement>(null);
  /** The conversation the seller came back from: its row takes the focus again. */
  const returnTo = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const page = toConversations(await host.callTool('list_whatsapp_conversations', { limit: CONVERSATIONS_PAGE }));
    if (!page) throw new Error('shape');
    setItems((cur) => (cur ? mergeConversations(cur, page) : page.items));
    // The cursor of the older pages the seller loaded survives a poll; a whole-list read clears it.
    setOlder((cur) => (page.nextBefore === null ? null : cur ?? page.nextBefore));
    setError(null);
  }, [host]);

  const threadOpen = selected !== null;
  // The list waits while a thread is open: the thread reads itself.
  const { pause, read, resume } = useInboxPolling(refresh, { held: threadOpen, onError: (e) => setError(errorText(e)) });

  useEffect(() => {
    void read();
  }, [read]);
  const back = () => {
    returnTo.current = selected?.key ?? null;
    setSelected(null);
    void read();
  };

  useEffect(() => {
    if (threadOpen || !returnTo.current) return;
    rows.current?.querySelector<HTMLButtonElement>(`[data-contact="${CSS.escape(returnTo.current)}"]`)?.focus();
    returnTo.current = null;
  }, [threadOpen]);

  async function loadMore() {
    if (!older) return;
    setLoadingMore(true);
    try {
      const page = toConversations(await host.callTool('list_whatsapp_conversations', { limit: CONVERSATIONS_PAGE, before: older }));
      if (!page) throw new Error('shape');
      setItems((cur) => appendConversations(cur ?? [], page.items));
      setOlder(page.nextBefore);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoadingMore(false);
    }
  }

  const patch = useCallback((key: string, change: Partial<Conversation>) => {
    setItems((cur) => cur && cur.map((c) => (c.key === key ? { ...c, ...change } : c)));
    setSelected((cur) => (cur && cur.key === key ? { ...cur, ...change } : cur));
  }, []);
  const onRead = useCallback((key: string) => patch(key, { unread: 0 }), [patch]);
  const onOptOutChange = useCallback((key: string, optedOut: boolean) => patch(key, { optedOut }), [patch]);

  // The thread shows the conversation as the latest read left it (its tags can change under it).
  const current = selected && (items?.find((c) => c.key === selected.key) ?? selected);

  if (current) {
    return <Thread key={current.key} host={host} conversation={current} onBack={back} onRead={onRead} onOptOutChange={onOptOutChange} />;
  }
  return (
    <section className="surface ix-card">
      <header className="ix-list-head">
        <h2 className="card-title">Caixa de entrada</h2>
        <p className="card-sub">As conversas do WhatsApp da loja. Os textos aparecem só aqui, não para o assistente.</p>
      </header>
      {error && <p className="ix-alert" role="alert">{error}</p>}
      <PollNote pause={pause} onResume={resume} />
      {items === null && !error && <div className="skeleton" style={{ height: 160 }} aria-busy="true" />}
      {items !== null && (items.length ? (
        <>
          <ul className="ix-rows" ref={rows}>{items.map((c) => <Row key={c.key} conversation={c} onOpen={setSelected} />)}</ul>
          {older && (
            <button type="button" className="ix-ghost ix-more" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </>
      ) : (
        <p className="empty">Nenhuma conversa ainda.</p>
      ))}
    </section>
  );
}

/** Inbox view: open_whatsapp_inbox's counts decide what shows, and the app-only tools fill it. */
export function InboxView({ host, state }: { host: Host; state: HostSnapshot }) {
  const open = useMemo(() => summarizeInbox(state.payload), [state.payload]);

  useEffect(() => {
    // Only that the view is open: no name, phone or text ever goes to the model from here.
    if (open?.available && open.enabled) host.tellModel('Caixa de entrada do WhatsApp aberta na tela do chat.');
  }, [host, open]);

  if (!open) return <p className="state" data-tone="error">A resposta não trouxe a caixa de entrada.</p>;
  return (
    <div className="dashboard inbox">
      {!open.available ? (
        <section className="surface ix-card"><p className="ix-note">A caixa de entrada do WhatsApp ainda não está disponível nesta conta.</p></section>
      ) : !open.enabled ? (
        <section className="surface ix-card">
          <h2 className="card-title">Acesso do MCP desligado</h2>
          <p className="ix-note">
            Para ler e responder as conversas aqui, ligue <strong>Permitir acesso pelo MCP</strong> nas configurações da caixa de entrada,
            no painel. Só você pode ligar, e dá para desligar a qualquer momento. Depois, peça para abrir a caixa de novo.
          </p>
        </section>
      ) : !state.canCallTools ? (
        <section className="surface ix-card"><p className="ix-note">Este chat não deixa o app chamar as ferramentas, então a caixa não abre aqui.</p></section>
      ) : (
        <Inbox host={host} />
      )}
    </div>
  );
}
