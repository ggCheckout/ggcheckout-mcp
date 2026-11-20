// Turns the WhatsApp inbox tools into what the inbox view draws, following the seller's inbox in the
// panel (saas types/whatsapp-inbox.ts, lib/whatsapp/inbox-reply.ts, lib/whatsapp/funnels-schema.ts).
// `open_whatsapp_inbox` answers only counts; the conversations, the messages and the replies come
// from app-only tools the view calls through the host, so a name, a phone or a message text lives in
// this view and never in the model's context. Pure.

import { type Payload, count, isPayload, text } from '../lib/payload';
import { parseDate } from '../lib/format';

/** How often the open list and thread are read, while the document is visible. */
export const POLL_MS = 10_000;
/** The saas caps a reply in code points (an emoji is 1). */
export const MAX_REPLY_CHARS = 4096;
export const CONVERSATIONS_PAGE = 50;
export const MESSAGES_PAGE = 100;

export interface InboxOpen {
  available: boolean;
  enabled: boolean;
  conversations: number;
  unread: number;
}

/** `open_whatsapp_inbox`'s four fields; null for anything else (and for another tool's `available`). */
export function summarizeInbox(data: unknown): InboxOpen | null {
  if (!isPayload(data) || 'object' in data) return null;
  const { available, enabled, conversations, unread } = data;
  if (typeof available !== 'boolean' || typeof enabled !== 'boolean') return null;
  if (typeof conversations !== 'number' || typeof unread !== 'number') return null;
  return { available, enabled, conversations: count(conversations), unread: count(unread) };
}

// --- Conversations ---

export interface Conversation {
  key: string;
  name: string | null;
  lastText: string | null;
  lastType: string | null;
  lastAt: string | null;
  unread: number;
  exitRequested: boolean;
  optedOut: boolean;
}

export interface Page<T> {
  items: T[];
  nextBefore: string | null;
}

function toConversation(raw: Payload): Conversation | null {
  const key = text(raw.contactKey);
  if (!key) return null;
  return {
    key,
    name: text(raw.name),
    lastText: text(raw.lastText),
    lastType: text(raw.lastType),
    lastAt: text(raw.lastAt),
    unread: count(raw.unread),
    exitRequested: text(raw.exitRequestedAt) !== null,
    optedOut: raw.optedOut === true,
  };
}

/** list_whatsapp_conversations `{ items, nextBefore }`; null for anything else. */
export function toConversations(data: unknown): Page<Conversation> | null {
  if (!isPayload(data) || !Array.isArray(data.items)) return null;
  return {
    items: data.items.filter(isPayload).map(toConversation).filter((c): c is Conversation => c !== null),
    nextBefore: text(data.nextBefore),
  };
}

const time = (iso: string | null): number => parseDate(iso)?.getTime() ?? 0;

/**
 * A poll reads the newest page again. When that page is the whole list it is the list; otherwise the
 * older pages the seller already loaded stay below it, minus any conversation the new page moved up.
 */
export function mergeConversations(current: Conversation[], fresh: Page<Conversation>): Conversation[] {
  if (!fresh.nextBefore) return fresh.items;
  const seen = new Set(fresh.items.map((c) => c.key));
  const oldest = Math.min(...fresh.items.map((c) => time(c.lastAt)));
  const older = current.filter((c) => !seen.has(c.key) && time(c.lastAt) <= oldest);
  return [...fresh.items, ...older];
}

/** An older page (the "Carregar mais" click) goes below what is shown, without repeating a row. */
export function appendConversations(current: Conversation[], page: Conversation[]): Conversation[] {
  const seen = new Set(current.map((c) => c.key));
  return [...current, ...page.filter((c) => !seen.has(c.key))];
}

/** The phone is not shown whole: the last four digits are enough to tell contacts apart. */
export function maskContact(key: string): string {
  if (key.startsWith('lid:')) return 'Contato do WhatsApp';
  const last = key.replace(/\D/g, '').slice(-4);
  return last.length === 4 ? `•••• ${last}` : 'Contato do WhatsApp';
}

/** The name the contact has, else the masked phone. */
export function contactLabel(c: Pick<Conversation, 'key' | 'name'>): string {
  return c.name ?? maskContact(c.key);
}

export function typeLabel(type: string | null): string {
  switch (type) {
    case 'media': return 'Mídia (não exibida aqui)';
    case 'reaction': return 'Reação';
    default: return 'Mensagem sem texto';
  }
}

/** The line under the name: the last text, or what kind of message it was. */
export function previewOf(c: Pick<Conversation, 'lastText' | 'lastType'>): string {
  return c.lastText ?? (c.lastType ? typeLabel(c.lastType) : 'Sem mensagens');
}

/** "agora", "há 5 min", "há 3 h", "ontem" or dd/mm: how long ago the conversation moved. */
export function activityLabel(iso: string | null, now: Date = new Date()): string {
  const date = parseDate(iso);
  if (!date) return '';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;
  if (minutes < 48 * 60) return 'ontem';
  return dayMonth.format(date);
}

const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** "14:32" for a message of today, "19/11 14:32" for an older one (São Paulo time). */
export function clockLabel(iso: string | null, now: Date = new Date()): string {
  const date = parseDate(iso);
  if (!date) return '';
  return dayKey.format(date) === dayKey.format(now) ? clock.format(date) : `${dayMonth.format(date)} ${clock.format(date)}`;
}

/** The tags of a row, in the panel's words. */
export function conversationLabels(c: Pick<Conversation, 'exitRequested' | 'optedOut'>): string[] {
  const labels: string[] = [];
  if (c.exitRequested) labels.push('Pediu para sair');
  if (c.optedOut) labels.push('Não recebe funis');
  return labels;
}

// --- Messages ---

export interface ThreadMessage {
  id: string;
  dir: 'in' | 'out';
  type: string;
  text: string | null;
  at: string | null;
  auto: boolean;
}

function toMessage(raw: Payload): ThreadMessage | null {
  const id = text(raw.id) ?? text(raw.messageId);
  if (!id) return null;
  return {
    id,
    dir: raw.dir === 'out' ? 'out' : 'in',
    type: text(raw.type) ?? 'text',
    // Kept as sent: the spacing and the line breaks of a message are part of it.
    text: typeof raw.text === 'string' && raw.text.trim() ? raw.text : null,
    at: text(raw.at),
    auto: raw.auto === true,
  };
}

/** list_whatsapp_messages `{ items, nextBefore }`; null for anything else. */
export function toMessages(data: unknown): Page<ThreadMessage> | null {
  if (!isPayload(data) || !Array.isArray(data.items)) return null;
  return {
    items: data.items.filter(isPayload).map(toMessage).filter((m): m is ThreadMessage => m !== null),
    nextBefore: text(data.nextBefore),
  };
}

/** Stream ids look like `1763640000000-3`: compared as numbers, so `-10` follows `-9`. */
function byOrder(a: ThreadMessage, b: ThreadMessage): number {
  const delta = time(a.at) - time(b.at);
  return delta || a.id.localeCompare(b.id, undefined, { numeric: true });
}

/** Messages from any page, once each, oldest first (how a thread reads). */
export function mergeMessages(current: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(byOrder);
}

/** What a bubble shows: the text, else what kind of message it was. Never markup. */
export function bodyOf(m: Pick<ThreadMessage, 'text' | 'type'>): string {
  return m.text ?? typeLabel(m.type);
}

/** The newest message from the contact: when it changes while a thread is open, the thread is read again. */
export function latestIncomingId(messages: ThreadMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].dir === 'in') return messages[i].id;
  return null;
}

// --- Composer ---

export const codePointLength = (value: string): number => Array.from(value).length;

/** Why the text cannot be sent, in words for the seller; null when it can. */
export function replyProblem(value: string): string | null {
  if (!value.trim()) return 'Escreva uma mensagem.';
  if (codePointLength(value) > MAX_REPLY_CHARS) return `A mensagem passa de ${MAX_REPLY_CHARS} caracteres.`;
  return null;
}

/** One id per message: `[A-Za-z0-9_-]{1,64}`, which a UUID is. */
export function newClientMessageId(): string {
  return crypto.randomUUID();
}

export interface PendingSend {
  text: string;
  clientMessageId: string;
}

/**
 * The id for the message about to go. The same text that failed keeps its id, so a retry cannot
 * double the message (the saas answers the repeat with the delivery it already made); an edited or a
 * new text gets a new one.
 */
export function pendingFor(previous: PendingSend | null, value: string, make: () => string = newClientMessageId): PendingSend {
  return previous && previous.text === value ? previous : { text: value, clientMessageId: make() };
}

// --- Funnel ---

export interface Run {
  status: 'running' | 'stopped' | 'done';
  funnelName: string;
  currentStep: number;
  totalSteps: number;
}

function toRun(raw: Payload): Run | null {
  const status = raw.status === 'running' || raw.status === 'stopped' || raw.status === 'done' ? raw.status : null;
  if (!status) return null;
  return { status, funnelName: text(raw.funnelName) ?? 'Funil', currentStep: count(raw.currentStep), totalSteps: count(raw.totalSteps) };
}

/** get_whatsapp_conversation_funnel `{ run }` (null: none yet); undefined for anything else. */
export function toContactRun(data: unknown): Run | null | undefined {
  if (!isPayload(data) || !('run' in data)) return undefined;
  return isPayload(data.run) ? toRun(data.run) : null;
}

/** "funil 2/3" while a funnel runs for the contact; null otherwise. */
export function runLabel(run: Run | null): string | null {
  return run?.status === 'running' ? `funil ${run.currentStep}/${run.totalSteps}` : null;
}

export interface FunnelOption {
  id: string;
  name: string;
}

/** The cursor of the next list_whatsapp_funnels page, or null on the last one. */
export function nextFunnelsAfter(data: unknown): string | null {
  return isPayload(data) ? text(data.nextAfter) ?? null : null;
}

/** list_whatsapp_funnels `{ items }` reduced to what a manual run can use: manual and enabled. */
export function toFunnelOptions(data: unknown): FunnelOption[] | null {
  if (!isPayload(data) || !Array.isArray(data.items)) return null;
  return data.items.filter(isPayload)
    .filter((f) => f.trigger === 'manual' && f.isEnabled === true && text(f.id))
    .map((f) => ({ id: String(f.id), name: text(f.name) ?? 'Funil sem nome' }));
}

export type StartOutcome = { kind: 'started'; run: Run | null } | { kind: 'refused'; message: string };

const START_REFUSALS: Record<string, string> = {
  opted_out: 'Este contato não recebe mais envios. Volte a enviar antes de rodar um funil.',
  product_without_session: 'O produto deste contato não está em nenhuma operação.',
};

/** start_whatsapp_conversation_funnel's answer: the run, or why the contact was not enrolled. */
export function startOutcome(data: unknown): StartOutcome | null {
  if (!isPayload(data)) return null;
  if (data.started === true) return { kind: 'started', run: isPayload(data.run) ? toRun(data.run) : null };
  if (data.started === false) return { kind: 'refused', message: START_REFUSALS[String(data.reason)] ?? 'O funil não foi iniciado para este contato.' };
  return null;
}

// --- Errors ---

const KNOWN_ERRORS: Record<string, string> = {
  INBOX_API_ACCESS_DISABLED: 'O acesso do MCP à caixa está desligado. Ligue "Permitir acesso pelo MCP" nas configurações da caixa de entrada, no painel.',
  INBOX_TERMS_REQUIRED: 'A caixa de entrada ainda não tem o termo aceito. Aceite o termo no painel para usar a caixa.',
};

/**
 * A tool error as the seller reads it: the host hands over "Error: API Error (422): <message>
 * (<CODE>)", and the message the saas wrote for the seller is what stays.
 */
export function errorText(error: unknown, fallback = 'Não foi possível concluir. Tente de novo.'): string {
  const raw = error instanceof Error ? error.message : '';
  for (const [code, message] of Object.entries(KNOWN_ERRORS)) if (raw.includes(code)) return message;
  const cleaned = raw
    .replace(/^Error:\s*/, '')
    .replace(/^API Error \(\d+\):\s*/, '')
    .replace(/\s*\([A-Z][A-Z_]+(?:;[^)]*)?\)\s*$/, '')
    .trim();
  return cleaned || fallback;
}
