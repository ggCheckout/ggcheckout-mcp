// Turns the WhatsApp funnel tools into what the funnels view draws, following the seller's "Funis"
// screens (saas components/settings/whatsapp/sections/funnels: FunnelsSection, FunnelDetailPage,
// funnelModel): list_whatsapp_funnels is the list (`{ items, nextAfter }`), get_whatsapp_funnel one
// funnel with its steps. Pure.

import { type Payload, count, isPayload, text } from '../lib/payload';
import { plural } from '../lib/format';

export type FunnelTrigger = 'abandoned_cart' | 'pix_unpaid' | 'pix_expired' | 'card_refused' | 'card_cancelled' | 'manual';

const TRIGGERS: readonly FunnelTrigger[] = ['abandoned_cart', 'pix_unpaid', 'pix_expired', 'card_refused', 'card_cancelled', 'manual'];

/** Settings.whatsapp.funnels.triggers (pt): "Quando começa". */
export const TRIGGER_LABEL: Record<FunnelTrigger, string> = {
  abandoned_cart: 'Carrinho abandonado',
  pix_unpaid: 'PIX não pago',
  pix_expired: 'PIX expirado',
  card_refused: 'Cartão recusado',
  card_cancelled: 'Cartão cancelado',
  manual: 'À mão, pela caixa',
};

/** editorStudy.events (pt): what the first wait counts from ("depois do carrinho abandonado"). */
const AFTER_EVENT: Record<FunnelTrigger, string> = {
  abandoned_cart: 'do carrinho abandonado',
  pix_unpaid: 'do PIX gerado',
  pix_expired: 'do vencimento do PIX',
  card_refused: 'da recusa do cartão',
  card_cancelled: 'do cancelamento do cartão',
  manual: 'de iniciar pela caixa',
};

const toTrigger = (value: unknown): FunnelTrigger => (TRIGGERS.includes(value as FunnelTrigger) ? value as FunnelTrigger : 'manual');

export interface FunnelRow {
  id: string;
  name: string;
  trigger: FunnelTrigger;
  isEnabled: boolean;
  stepCount: number;
  /** The operation that sends a manual funnel; an automatic one sends by each product's operation. */
  sessionId: string | null;
}

export interface FunnelStep {
  waitMinutes: number;
  text: string;
}

export interface StoreStyle {
  signature: string;
  coupon: string;
  useEmoji: boolean;
}

export interface FunnelDetail extends FunnelRow {
  steps: FunnelStep[];
  stopOnReply: boolean;
  /** Brasília hours, `[start, end)`; null sends at any hour. */
  sendWindow: { start: number; end: number } | null;
  style: StoreStyle;
}

function toRow(f: Payload, stepCount: number): FunnelRow {
  return {
    id: String(f.id ?? ''),
    name: text(f.name) ?? 'Funil sem nome',
    trigger: toTrigger(f.trigger),
    isEnabled: f.isEnabled === true,
    stepCount,
    sessionId: text(f.sessionGroupId),
  };
}

export interface FunnelPage {
  funnels: FunnelRow[];
  nextAfter: string | null;
}

/** list_whatsapp_funnels `{ items, nextAfter }`; null for anything else. */
export function summarizeFunnels(data: unknown): FunnelPage | null {
  if (!isPayload(data) || !Array.isArray(data.items) || !('nextAfter' in data)) return null;
  const items = data.items.filter(isPayload);
  if (!items.every((f) => 'trigger' in f && 'stepCount' in f)) return null;
  return { funnels: items.map((f) => toRow(f, count(f.stepCount))).filter((f) => f.id), nextAfter: nextFunnelsAfter(data) };
}

/** The cursor of the next list_whatsapp_funnels page, or null on the last one. */
export function nextFunnelsAfter(data: unknown): string | null {
  return isPayload(data) ? text(data.nextAfter) ?? null : null;
}

/** get_whatsapp_funnel and toggle_whatsapp_funnel `{ funnel }`; null for anything else. */
export function summarizeFunnel(data: unknown): FunnelDetail | null {
  if (!isPayload(data) || !isPayload(data.funnel) || !Array.isArray(data.funnel.steps) || !('trigger' in data.funnel)) return null;
  const f = data.funnel;
  const steps = (f.steps as unknown[]).filter(isPayload).map((s) => ({ waitMinutes: count(s.waitMinutes), text: typeof s.text === 'string' ? s.text : '' }));
  const window = isPayload(f.sendWindow) && typeof f.sendWindow.start === 'number' && typeof f.sendWindow.end === 'number'
    ? { start: f.sendWindow.start, end: f.sendWindow.end }
    : null;
  return {
    ...toRow(f, steps.length),
    steps,
    stopOnReply: f.stopOnReply === true,
    sendWindow: window,
    style: { signature: typeof f.signature === 'string' ? f.signature : '', coupon: typeof f.coupon === 'string' ? f.coupon : '', useEmoji: f.useEmoji !== false },
  };
}

const DAY_MINUTES = 1440;

/** formatWait: "na hora", "15 min", "1 h", "1 h 30 min", "1 dia", "2 dias". */
export function formatWait(minutes: number): string {
  if (minutes <= 0) return 'na hora';
  if (minutes % DAY_MINUTES === 0) return plural(minutes / DAY_MINUTES, 'dia', 'dias');
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** What each step waits for: the event that opened the funnel, then the previous message. */
export function waitLabel(step: FunnelStep, index: number, trigger: FunnelTrigger): string {
  const after = index === 0 ? AFTER_EVENT[trigger] : 'da mensagem anterior';
  return step.waitMinutes <= 0 ? `Na hora, depois ${after}` : `Espera ${formatWait(step.waitMinutes)} depois ${after}`;
}

/** "Envia das 8h às 20h" or "Envia a qualquer hora" (the window is in Brasília time). */
export function sendWindowLabel(window: FunnelDetail['sendWindow']): string {
  return window ? `Envia das ${window.start}h às ${window.end}h (Brasília)` : 'Envia a qualquer hora';
}

const EMOJI = /[0-9#*]️?⃣|[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍️⃣]/gu;

/**
 * funnelModel applyStoreStyle: `{{assinatura}}` and `{{cupom}}` become the store's own, and a store
 * that does not use emoji has them taken out. The event's variables stay as they are.
 */
export function applyStoreStyle(message: string, style: StoreStyle): string {
  const out = message
    .replace(/\{\{\s*assinatura\s*\}\}/g, style.signature.trim() || 'a equipe')
    .replace(/\{\{\s*cupom\s*\}\}/g, style.coupon.trim());
  return style.useEmoji ? out : out.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').trim();
}

/** A message split into plain text and `{{variable}}` tokens, so the view marks the variables. */
export function messageParts(message: string): Array<{ text: string; isVariable: boolean }> {
  return message.split(/(\{\{\s*[\w.]+\s*\}\})/g).filter(Boolean).map((part) => ({ text: part, isVariable: /^\{\{/.test(part) }));
}

/**
 * FunnelsSection: the state is always "Ligado"/"Desligado"; the action of a manual funnel says what
 * it does to the inbox's list ("Disponível na caixa" / "Tirar da caixa").
 */
export function toggleWords(funnel: Pick<FunnelRow, 'trigger' | 'isEnabled'>): { state: string; action: string } {
  const isManual = funnel.trigger === 'manual';
  return funnel.isEnabled
    ? { state: 'Ligado', action: isManual ? 'Tirar da caixa' : 'Desligar' }
    : { state: 'Desligado', action: isManual ? 'Disponível na caixa' : 'Ligar' };
}

/**
 * triggerTaken: only one funnel per automatic trigger can be on, so turning one on while another of
 * the same trigger is on is refused by the API; the view says which one first.
 */
export function triggerTakenBy(funnel: FunnelRow, funnels: readonly FunnelRow[]): FunnelRow | null {
  if (funnel.trigger === 'manual' || funnel.isEnabled) return null;
  return funnels.find((f) => f.id !== funnel.id && f.trigger === funnel.trigger && f.isEnabled) ?? null;
}

/** The step count as the list words it ("3 mensagens"). */
export const stepsLabel = (n: number): string => plural(n, 'mensagem', 'mensagens');
