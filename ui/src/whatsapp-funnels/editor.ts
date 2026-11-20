// The funnel editor's model, after the seller's (saas components/settings/whatsapp/sections/funnels:
// funnelModel, funnelFlow, funnelModels, FunnelWaitField). The editor works on a local draft; Salvar
// sends the whole funnel (update_whatsapp_funnel / create_whatsapp_funnel), so the draft carries every
// field the route replaces. Pure.

import { cutText } from '../lib/format';
import {
  AFTER_EVENT, TRIGGER_LABEL, formatWait,
  type FunnelDetail, type FunnelLayout, type FunnelStep, type FunnelTrigger, type StoreStyle,
} from './model';

/** Caps of the saas schema (lib/whatsapp/funnels-schema), counted in code points as the core does. */
export const FUNNEL_MAX_STEPS = 5;
export const FUNNEL_MIN_WAIT_MINUTES = 15;
export const FUNNEL_MAX_WAIT_MINUTES = 2 * 24 * 60;
export const FUNNEL_MAX_NAME = 80;
export const FUNNEL_MAX_TEXT = 4096;
export const FUNNEL_MAX_SIGNATURE = 60;
export const FUNNEL_MAX_COUPON = 30;

/** A step on the screen: the stored one plus a local key, stable while steps come and go. */
export interface DraftStep extends FunnelStep {
  key: string;
}

export interface FunnelDraft {
  name: string;
  trigger: FunnelTrigger;
  /** The operation of a manual funnel (`sessionGroupId`); kept while the trigger is automatic. */
  sessionId: string | null;
  steps: DraftStep[];
  style: StoreStyle;
  stopOnReply: boolean;
  sendWindow: { start: number; end: number } | null;
  layout: FunnelLayout | null;
}

/** The body create_whatsapp_funnel takes, and update_whatsapp_funnel replaces the funnel with. */
export interface FunnelInput {
  name: string;
  trigger: FunnelTrigger;
  sessionGroupId?: string;
  stopOnReply: boolean;
  sendWindow: { start: number; end: number } | null;
  signature: string;
  coupon: string;
  useEmoji: boolean;
  steps: FunnelStep[];
  layout: FunnelLayout | null;
}

/** Only the manual funnel picks an operation; an automatic one sends by each product's. */
export const needsSession = (trigger: FunnelTrigger): boolean => trigger === 'manual';

/** A code-point cap, like the core's (`maxLength` counts UTF-16 and would split an emoji). */
export const clipCodePoints = (value: string, max: number): string => Array.from(value).slice(0, max).join('');

export function draftFrom(funnel: FunnelDetail): FunnelDraft {
  return {
    name: funnel.name,
    trigger: funnel.trigger,
    sessionId: funnel.sessionId,
    steps: funnel.steps.map((step, i) => ({ ...step, key: `step_${i + 1}` })),
    style: { ...funnel.style },
    stopOnReply: funnel.stopOnReply,
    sendWindow: funnel.sendWindow,
    layout: funnel.layout,
  };
}

/** A step written from scratch: 1 day after the previous one, with the human pace on. */
export const newStep = (key: string): DraftStep => ({ key, waitMinutes: 1440, text: '', markSeen: true, showTyping: true });

/** newFunnelDraft: one empty message 15 min after the abandoned cart, off, sending 8h to 21h. */
export function newDraft(sessionId: string | null): FunnelDraft {
  return {
    name: 'Novo funil',
    trigger: 'abandoned_cart',
    sessionId,
    steps: [{ ...newStep('step_1'), waitMinutes: 15 }],
    style: { signature: '', coupon: '', useEmoji: true },
    stopOnReply: true,
    sendWindow: { start: 8, end: 21 },
    layout: null,
  };
}

const LAYOUT_STEP_KEY = /^(wait|message)-(\d+)$/;

/** Only the positions a funnel of `steps` messages can use, rounded; null when none is left. */
function layoutFor(layout: FunnelLayout | null, steps: number): FunnelLayout | null {
  if (!layout) return null;
  const kept = Object.entries(layout).filter(([key]) => {
    const match = LAYOUT_STEP_KEY.exec(key);
    return match ? Number(match[2]) <= steps : key === 'start' || key === 'end';
  });
  return kept.length ? Object.fromEntries(kept.map(([key, p]) => [key, { x: Math.round(p.x), y: Math.round(p.y) }])) : null;
}

/**
 * shiftLayout: a step coming in (`delta` 1) or going out (-1) at `index` moves the `wait-N`/`message-N`
 * positions after it along, so the dashboard's drawing keeps each block where the seller put it.
 */
export function shiftLayout(layout: FunnelLayout | null, index: number, delta: 1 | -1): FunnelLayout | null {
  if (!layout) return null;
  const next: FunnelLayout = {};
  for (const [key, point] of Object.entries(layout)) {
    const match = LAYOUT_STEP_KEY.exec(key);
    if (!match) {
      next[key] = point;
      continue;
    }
    const n = Number(match[2]);
    if (delta === -1 && n === index + 1) continue;
    const moved = n > index + (delta === -1 ? 1 : 0) ? n + delta : n;
    next[`${match[1]}-${moved}`] = point;
  }
  return Object.keys(next).length ? next : null;
}

/** funnelToInput: the whole funnel as the route stores it (the on/off has its own write). */
export function toInput(draft: FunnelDraft): FunnelInput {
  return {
    name: draft.name.trim(),
    trigger: draft.trigger,
    ...(needsSession(draft.trigger) && draft.sessionId ? { sessionGroupId: draft.sessionId } : {}),
    stopOnReply: draft.stopOnReply,
    sendWindow: draft.sendWindow,
    signature: draft.style.signature.trim(),
    coupon: draft.style.coupon.trim(),
    useEmoji: draft.style.useEmoji,
    steps: draft.steps.map(({ waitMinutes, text, markSeen, showTyping }) => ({ waitMinutes, text, markSeen, showTyping })),
    layout: layoutFor(draft.layout, draft.steps.length),
  };
}

/** What a save would write, comparable: equal snapshots mean nothing to save. */
export const snapshotOf = (draft: FunnelDraft): string => JSON.stringify(toInput(draft));

/**
 * The funnel read right before Salvar still is the one the editor opened (or last saved): a save
 * replaces it whole, so an edit made meanwhile elsewhere (dashboard, chat, another card) would be undone.
 */
export const unchangedSince = (seen: FunnelDetail, fresh: FunnelDetail): boolean => snapshotOf(draftFrom(seen)) === snapshotOf(draftFrom(fresh));

/** The step comes in at `index` (0 to steps.length); the ones after it move one place. */
export function insertStep<S>(steps: readonly S[], index: number, step: S): S[] {
  const at = Math.max(0, Math.min(index, steps.length));
  return [...steps.slice(0, at), step, ...steps.slice(at)];
}

export const canAddStep = (steps: readonly unknown[]): boolean => steps.length < FUNNEL_MAX_STEPS;

/** The minutes from the event to each step (the waits summed). */
export function cumulativeMinutes(steps: ReadonlyArray<Pick<FunnelStep, 'waitMinutes'>>): number[] {
  let total = 0;
  return steps.map((step) => (total += step.waitMinutes));
}

/* ── Waits ── */

/** The one-click waits of the editor; any other goes through "Outro". */
export const WAIT_PRESETS: readonly number[] = [15, 30, 60, 180, 1440, 2880];

export type WaitUnit = 'minutes' | 'hours' | 'days';
export const WAIT_UNITS: ReadonlyArray<[WaitUnit, string]> = [['minutes', 'minutos'], ['hours', 'horas'], ['days', 'dias']];
const UNIT_MINUTES: Record<WaitUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** The wait in its largest exact unit, for the manual field: 90 → 90 min, 120 → 2 h, 2880 → 2 dias. */
export function waitInUnit(minutes: number): { amount: number; unit: WaitUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

/** The manual field's minutes, or null when the core would refuse them (whole number, 15 min to 2 days). */
export function manualWaitMinutes(amount: string, unit: WaitUnit): number | null {
  const digits = amount.trim();
  if (!/^\d{1,4}$/.test(digits)) return null;
  const minutes = Number(digits) * UNIT_MINUTES[unit];
  return minutes >= FUNNEL_MIN_WAIT_MINUTES && minutes <= FUNNEL_MAX_WAIT_MINUTES ? minutes : null;
}

/** editorStudy.step.timing: "30 min depois do PIX gerado · esperas somadas 30 min". */
export function stepTiming(step: Pick<FunnelStep, 'waitMinutes'>, index: number, trigger: FunnelTrigger, atMinutes: number): string {
  const after = index === 0 ? ` ${AFTER_EVENT[trigger]}` : '';
  return `${formatWait(step.waitMinutes)} depois${after} · esperas somadas ${formatWait(atMinutes)}`;
}

/* ── The human pace (calculate_typing_delay in the core's waha_provider.rs) ── */

const TYPING_MIN_MS = 3_000;
const TYPING_MAX_MS = 15_000;
const clampTyping = (ms: number): number => Math.min(TYPING_MAX_MS, Math.max(TYPING_MIN_MS, ms));

/** How long "digitando…" shows for a text: 50 to 80 ms a character ±20%, between 3 and 15 s. */
export function formatTypingRange(length: number): string {
  const a = Math.round(clampTyping(Math.round(length * 50 * 0.8)) / 1000);
  const b = Math.round(clampTyping(Math.round(length * 80 * 1.2)) / 1000);
  return a === b ? `${a} s` : `${a}–${b} s`;
}

/* ── Variables ── */

export interface FunnelVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

const VARIABLE: Record<string, FunnelVariable> = {
  customer_name: { key: 'customer_name', label: 'Nome do cliente', description: 'Nome completo do cliente', example: 'João Silva' },
  product_title: { key: 'product_title', label: 'Nome do Produto', description: 'Nome do produto comprado', example: 'Curso Completo de Fotografia Digital' },
  amount: { key: 'amount', label: 'Valor', description: 'Valor da compra formatado', example: 'R$ 197,00' },
  checkout_url: { key: 'checkout_url', label: 'Link do Checkout', description: 'Link para o cliente voltar ao checkout', example: 'https://ggcheckout.com/v2/checkout/ABC123' },
  checkout_url_with_coupon: { key: 'checkout_url_with_coupon', label: 'Link com Cupom', description: 'URL do checkout com cupom aplicado automaticamente', example: 'https://ggcheckout.com/v2/checkout/ABC123?coupon=SAVE10' },
  pix_copia_cola: { key: 'pix_copia_cola', label: 'PIX Copia e Cola', description: 'Código PIX copia e cola (apenas para PIX não expirado)', example: '00020126580014br.gov.bcb.pix…' },
  assinatura: { key: 'assinatura', label: 'Assinatura', description: 'Como a loja assina as mensagens', example: 'Equipe Fotografia Pro' },
  cupom: { key: 'cupom', label: 'Cupom', description: 'O cupom que a loja oferece na recuperação', example: 'VOLTA10' },
};

const CART = ['customer_name', 'product_title', 'amount', 'checkout_url', 'checkout_url_with_coupon'];
const EVENT_VARIABLES: Record<FunnelTrigger, string[]> = {
  abandoned_cart: CART,
  card_refused: CART,
  card_cancelled: CART,
  pix_unpaid: [...CART, 'pix_copia_cola'],
  pix_expired: [...CART, 'pix_copia_cola'],
  // In a funnel run by hand the inbox only knows the contact's name.
  manual: ['customer_name'],
};

/** funnelVariables: the event's variables (variablesForEvent), then the store's signature and coupon. */
export function funnelVariables(trigger: FunnelTrigger): FunnelVariable[] {
  return [...EVENT_VARIABLES[trigger], 'assinatura', 'cupom'].map((key) => VARIABLE[key]);
}

/** The text with the sample values in place of the event variables, as the preview shows it. */
export function sampleText(text: string, variables: readonly FunnelVariable[]): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (full, key: string) => variables.find((v) => v.key === key)?.example ?? full);
}

/* ── What is missing ── */

/** funnelProblems: what still keeps the funnel from being saved or turned on, in the editor's words. */
export function funnelProblems(draft: FunnelDraft): string[] {
  const problems: string[] = [];
  if (!draft.name.trim()) problems.push('Dê um nome ao funil.');
  if (draft.steps.length === 0) problems.push('Adicione pelo menos uma mensagem.');
  draft.steps.forEach((step, i) => {
    if (!step.text.trim()) problems.push(`A mensagem ${i + 1} está vazia.`);
    if (/\{\{\s*cupom\s*\}\}/.test(step.text) && !draft.style.coupon.trim()) problems.push(`A mensagem ${i + 1} usa {{cupom}} e a loja não tem cupom.`);
  });
  if (needsSession(draft.trigger) && !draft.sessionId) problems.push('Escolha a operação que envia.');
  return problems;
}

/** What the route refuses on a save (name, texts, a manual funnel's operation); a missing coupon only stops turning it on. */
export function saveBlocked(draft: FunnelDraft): boolean {
  return !draft.name.trim() || draft.steps.length === 0 || draft.steps.some((s) => !s.text.trim()) || (needsSession(draft.trigger) && !draft.sessionId);
}

/* ── The blocks of the flow ── */

export type FlowSelection = { kind: 'start' } | { kind: 'step'; key: string } | { kind: 'end' } | { kind: 'settings' };

/** editorStudy.flow.stopWith(out)Reply: what the end block says. */
export const stopDetail = (stopOnReply: boolean): string => (stopOnReply
  ? 'Para quando o cliente comprou ou respondeu, ou quando você para os funis dele na caixa.'
  : 'Para quando o cliente comprou, ou quando você para os funis dele na caixa.');

/** The message on one line for its block, at most `max` code points before the "…". */
export function excerpt(text: string, max = 70): string {
  return cutText(text.replace(/\s+/g, ' ').trim(), max);
}

/** Builds the step a palette item puts in, under the given local key. */
export type StepBuilder = (key: string) => DraftStep;

/** flowPalette: what "+ Adicionar" and the "+" between blocks put in. */
export const PALETTE: ReadonlyArray<{ id: string; label: string; hint: string; build: StepBuilder }> = [
  { id: 'message', label: 'Mensagem', hint: 'Texto livre, 1 dia depois da anterior.', build: newStep },
  {
    id: 'reminder',
    label: 'Lembrete com o link',
    hint: 'Lembra o produto e manda o link de volta, 3 h depois.',
    build: (key) => ({ ...newStep(key), waitMinutes: 180, text: 'Oi, {{customer_name}}! O seu *{{product_title}}* ainda está separado: {{checkout_url}}' }),
  },
  {
    id: 'coupon',
    label: 'Última chamada com cupom',
    hint: 'Oferece o cupom da loja, 1 dia depois.',
    build: (key) => ({ ...newStep(key), text: 'Última chamada! Separei o cupom *{{cupom}}* para você fechar hoje: {{checkout_url_with_coupon}}\n\n{{assinatura}}' }),
  },
];

/* ── Ready-made funnels ("+ Novo funil") ── */

export interface FunnelModel {
  key: string;
  name: string;
  trigger: FunnelTrigger;
  steps: ReadonlyArray<{ waitMinutes: number; text: string }>;
}

/**
 * funnelModels: the texts stay in pt-BR on purpose, they are what the store's customer gets. None uses
 * {{cupom}}: with it the funnel only turns on with the store's coupon, and the cart one is born on.
 */
export const FUNNEL_MODELS: readonly FunnelModel[] = [
  {
    key: 'abandoned_cart', name: 'Carrinho abandonado', trigger: 'abandoned_cart',
    steps: [
      { waitMinutes: 30, text: 'Oi, {{customer_name}}! 👋 Vi que você quase fechou a compra do *{{product_title}}* e não finalizou. Ainda dá tempo, é só continuar de onde parou:\n{{checkout_url}}' },
      { waitMinutes: 180, text: 'Passando para lembrar: o *{{product_title}}* continua separado para você. Se travou em algum passo, me responde aqui que eu te ajudo.\n\n{{assinatura}}' },
      { waitMinutes: 1440, text: 'Última chamada para o *{{product_title}}* 🙌 O link continua valendo:\n{{checkout_url}}\n\n{{assinatura}}' },
    ],
  },
  {
    key: 'pix_unpaid', name: 'PIX não pago', trigger: 'pix_unpaid',
    steps: [
      { waitMinutes: 15, text: 'Oi, {{customer_name}}! O PIX do *{{product_title}}* ({{amount}}) ainda não foi pago. Se o código venceu, o link gera outro na hora: {{checkout_url}}' },
      { waitMinutes: 60, text: 'Ainda dá tempo de garantir o *{{product_title}}*. É só pagar pelo link, que gera um PIX novo: {{checkout_url}}' },
      { waitMinutes: 180, text: 'Último lembrete do *{{product_title}}*: o link continua valendo e gera um PIX novo. {{checkout_url}}\n\n{{assinatura}}' },
    ],
  },
  {
    key: 'card_refused', name: 'Cartão recusado', trigger: 'card_refused',
    steps: [
      { waitMinutes: 15, text: 'Oi, {{customer_name}}! O pagamento no cartão do *{{product_title}}* não foi aprovado. Sem problema: dá para pagar com PIX ou com outro cartão por este link:\n{{checkout_url}}' },
      { waitMinutes: 180, text: 'Conseguiu finalizar? Se o cartão continuar recusando, o PIX é aprovado na hora: {{checkout_url}}\n\n{{assinatura}}' },
    ],
  },
  {
    key: 'manual', name: 'Atendimento: retomar conversa', trigger: 'manual',
    steps: [
      { waitMinutes: 15, text: 'Oi, {{customer_name}}! Conseguiu ver a minha mensagem anterior? Fico à disposição para ajudar.' },
      { waitMinutes: 1440, text: 'Sigo por aqui se precisar de alguma coisa. É só responder esta mensagem.\n\n{{assinatura}}' },
    ],
  },
];

/** FunnelStarterDialog: the funnel a model creates, off, sending 8h to 21h, with the human pace on. */
export function modelInput(model: FunnelModel, sessionId: string | null): FunnelInput {
  return {
    name: model.name,
    trigger: model.trigger,
    ...(needsSession(model.trigger) && sessionId ? { sessionGroupId: sessionId } : {}),
    stopOnReply: true,
    sendWindow: { start: 8, end: 21 },
    signature: '',
    coupon: '',
    useEmoji: true,
    steps: model.steps.map((step) => ({ ...step, markSeen: true, showTyping: true })),
    layout: null,
  };
}

/** starter.schedule: "1ª 30 min depois do carrinho abandonado · próximas 3 h, 1 dia". */
export function modelSchedule(model: FunnelModel): string {
  const [first, ...rest] = model.steps;
  if (!first) return '';
  if (!rest.length) return `1 mensagem, ${formatWait(first.waitMinutes)} depois ${AFTER_EVENT[model.trigger]}`;
  return `1ª ${formatWait(first.waitMinutes)} depois ${AFTER_EVENT[model.trigger]} · ${rest.length === 1 ? 'próxima' : 'próximas'} ${rest.map((s) => formatWait(s.waitMinutes)).join(', ')}`;
}

/** Decision 5: the cart funnel is born on, unless another funnel already holds the trigger. */
export const bornEnabled = (trigger: FunnelTrigger, triggerTaken: boolean): boolean => trigger === 'abandoned_cart' && !triggerTaken;

/* ── The customer's phone (funnelSimulation, still) ── */

export type Beat =
  | { kind: 'pill'; text: string }
  | { kind: 'message'; text: string; time: string }
  | { kind: 'end'; text: string };

/** The event happens at 15:12 Brasília; the window can push each send to its next opening. */
const EVENT_AT_MINUTES = 15 * 60 + 12;

const clock = (minutes: number): string => {
  const total = minutes % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function nextSendAt(minutes: number, window: FunnelDraft['sendWindow']): number {
  if (!window) return minutes;
  const day = Math.floor(minutes / 1440) * 1440;
  const time = minutes % 1440;
  if (time < window.start * 60) return day + window.start * 60;
  if (time >= window.end * 60) return day + 1440 + window.start * 60;
  return minutes;
}

/**
 * buildBeats: what the customer sees, in order: each wait, the delay of a send that falls outside the
 * window (the next wait counts from the send), the message and how the funnel ends.
 */
export function buildBeats(draft: FunnelDraft, render: (text: string) => string): Beat[] {
  const beats: Beat[] = [];
  let at = EVENT_AT_MINUTES;
  draft.steps.forEach((step, index) => {
    const wait = formatWait(step.waitMinutes);
    beats.push({ kind: 'pill', text: index === 0 ? `${TRIGGER_LABEL[draft.trigger]} · ${wait} depois` : `${wait} depois` });
    const planned = at + step.waitMinutes;
    at = nextSendAt(planned, draft.sendWindow);
    if (at > planned) beats.push({ kind: 'pill', text: `Fora do horário · espera mais ${formatWait(at - planned)} até a próxima abertura` });
    beats.push({ kind: 'message', text: render(step.text), time: clock(at) });
  });
  beats.push({ kind: 'end', text: 'Fim do funil' });
  return beats;
}
