// Turns the WhatsApp chip tools into what the chips view draws, following the seller's chip screens
// (saas components/settings/whatsapp/sections/chips: ChipsGrid, ChipDetailPage, chipStatus):
// list_whatsapp_numbers is the chips list, get_whatsapp_number one chip, and get_pairing_code the code
// that connects a QR code chip from the phone. The dashboard connects by QR, which the server never
// passes on (it links a device to the account), so the chat connects with the code instead. Pure.

import { type Payload, count, isPayload, text } from '../lib/payload';
import { plural } from '../lib/format';

export type ChipTone = 'success' | 'info' | 'warning' | 'alert' | 'danger' | 'muted';

/** MAX_NUMBERS_PER_USER in the saas: active chips an account may have ("N chips ativos / 20"). */
export const MAX_ACTIVE_CHIPS = 20;

/** REMOVAL_WINDOW_MS in the saas: a removed chip is deleted 48 hours later, undoable until then. */
const REMOVAL_WINDOW_MS = 48 * 3_600_000;
const HOUR_MS = 3_600_000;

/**
 * chipStatus.ts removalCountdown: the time left, rounded up, capped at the 48-hour window (a clock a
 * little behind the server would otherwise read "3 dias"); at the deadline the chip awaits deletion.
 */
export function removalCountdown(removalAt: string, now: number): string {
  const remaining = Math.min(Date.parse(removalAt) - now, REMOVAL_WINDOW_MS);
  if (!(remaining > 0)) return 'Removendo…';
  const hours = remaining / HOUR_MS;
  if (hours >= 24) return `Será removido em ${plural(Math.ceil(hours / 24), 'dia', 'dias')}`;
  if (hours >= 1) return `Será removido em ${plural(Math.ceil(hours), 'hora', 'horas')}`;
  return 'Será removido em menos de 1 hora';
}

export interface ChipStatusVisual {
  label: string;
  tone: ChipTone;
  pulse: boolean;
  /** What the state means and what to do, as the dashboard explains it on hover. */
  description: string;
}

const DESCRIPTIONS: Record<string, string> = {
  authenticated: 'O chip está enviando mensagens normalmente.',
  inactive: 'Você pausou este chip: ele não envia mensagens. Reative para ele voltar a enviar.',
  qr_code: 'O chip espera a conexão com o WhatsApp do celular. Abra o chip e conecte pelo código.',
  pending: 'O chip está ligando; leva alguns segundos.',
  starting: 'O chip está ligando; leva alguns segundos.',
  disconnected: 'O chip desconectou e não envia mensagens. Abra o chip, reinicie e conecte de novo.',
  error: 'O chip falhou e não envia mensagens. Abra o chip, reinicie e conecte de novo.',
  banned: 'O WhatsApp baniu este número; ele não envia mensagens. Cadastre outro chip e troque-o na operação.',
};
/** A Meta chip connects with its credentials in the dashboard and at Meta, never by a code. */
const META_DESCRIPTIONS: Record<string, string> = {
  qr_code: 'Confira a conexão da API oficial na tela de Chips do painel e na Meta.',
  pending: 'A conexão da API oficial está pendente. Confira o status no painel e na Meta.',
  starting: 'A conexão da API oficial está iniciando. Acompanhe o status no painel e na Meta.',
  disconnected: 'A API oficial está desconectada e não envia mensagens. Confira a conexão no painel e na Meta.',
  error: 'A API oficial apresentou uma falha e não envia mensagens. Confira a conexão no painel e na Meta.',
};

function removalDescription(chip: StatusChip, deadline: string, expired: boolean): string {
  if (expired) return 'O prazo terminou e o chip está sendo removido. Ele não envia mensagens; cadastre outro chip no painel para continuar.';
  if (chip.removalReason !== 'disconnected') {
    return `Você marcou este chip para remover. ${deadline}. Ele não envia mensagens; para mantê-lo, use Desfazer na tela de Chips do painel antes do prazo.`;
  }
  return chip.provider === 'meta'
    ? `O chip está marcado para remoção por desconexão. ${deadline}. Confira a conexão da API oficial no painel e na Meta antes do prazo.`
    : `O chip está há 7 dias sem conexão e não envia mensagens. ${deadline}. Reinicie e conecte antes do prazo para mantê-lo.`;
}

type StatusChip = Pick<Chip, 'status' | 'isActive' | 'provider' | 'removalAt' | 'removalReason'>;

/**
 * chipStatus.ts getNumberStatusVisual: a chip marked for removal reads its countdown whatever its
 * status, an inactive one reads "Desativado", and the rest their connection state.
 */
export function chipStatus(chip: StatusChip, now: number): ChipStatusVisual {
  if (chip.removalAt) {
    const label = removalCountdown(chip.removalAt, now);
    return { label, tone: 'warning', pulse: false, description: removalDescription(chip, label, !(Date.parse(chip.removalAt) > now)) };
  }
  if (!chip.isActive) return { label: 'Desativado', tone: 'muted', pulse: false, description: DESCRIPTIONS.inactive };
  const description = (chip.provider === 'meta' && META_DESCRIPTIONS[chip.status]) || DESCRIPTIONS[chip.status] || '';
  switch (chip.status) {
    case 'authenticated': return { label: 'Conectado', tone: 'success', pulse: false, description };
    case 'qr_code': return { label: 'QR pronto', tone: 'info', pulse: true, description };
    case 'pending':
    case 'starting': return { label: 'Conectando…', tone: 'warning', pulse: true, description };
    case 'disconnected': return { label: 'Desconectado', tone: 'alert', pulse: false, description };
    case 'banned': return { label: 'Banido', tone: 'danger', pulse: false, description };
    case 'error': return { label: 'Erro', tone: 'danger', pulse: false, description };
    default: return { label: chip.status, tone: 'muted', pulse: false, description };
  }
}

/** ChipProviderBadge: the dashboard's names for the two chip types and what each means. */
export const PROVIDER: Record<'waha' | 'meta', { label: string; description: string }> = {
  waha: { label: 'WhatsApp GG', description: 'Conectado pelo QR Code, lendo com o WhatsApp do celular, pela conexão da GG. Não precisa de conta de negócio na Meta.' },
  meta: { label: 'Meta oficial', description: 'Conectado pela API Oficial do WhatsApp, com as suas credenciais da Meta (Cloud API). Mais estável e com os limites oficiais da Meta.' },
};

export interface ChipUse {
  sessionId: string;
  name: string;
  role: 'primary' | 'fallback';
}

export interface Chip {
  id: string;
  name: string;
  /** Masked by the server. */
  phone: string | null;
  provider: 'waha' | 'meta';
  status: string;
  isActive: boolean;
  /** How many operations (sessions in the API) use it (list) or, on one chip, the operations themselves. */
  sessionsCount: number;
  usedBy: ChipUse[] | null;
  errorMessage: string | null;
  /** When the chip is deleted, if it is marked for removal (48 hours after the mark). */
  removalAt: string | null;
  /** Who marked it: the seller (undone in the dashboard) or 7 days without a connection (reconnect to keep it). */
  removalReason: 'seller' | 'disconnected' | null;
}

function toChip(n: Payload): Chip {
  const usedBy = Array.isArray(n.usedBy)
    ? n.usedBy.filter(isPayload).map((u) => ({
      sessionId: String(u.groupId ?? ''),
      name: text(u.name) ?? 'Operação',
      role: u.role === 'fallback' ? 'fallback' as const : 'primary' as const,
    }))
    : null;
  return {
    id: String(n.uid ?? n.id ?? ''),
    name: text(n.displayName) ?? 'Sem nome',
    phone: text(n.phoneNumber),
    provider: n.provider === 'meta' ? 'meta' : 'waha',
    status: String(n.status ?? 'pending'),
    isActive: n.isActive !== false,
    sessionsCount: usedBy ? usedBy.length : count(n.groupsCount),
    usedBy,
    errorMessage: text(n.errorMessage),
    removalAt: text(n.removalScheduledAt),
    removalReason: n.removalScheduledAt ? (n.removalReason === 'disconnected' ? 'disconnected' : 'seller') : null,
  };
}

/** list_whatsapp_numbers `{ numbers }`; null for anything else. */
export function summarizeChips(data: unknown): Chip[] | null {
  if (!isPayload(data) || !Array.isArray(data.numbers)) return null;
  return data.numbers.filter(isPayload).map(toChip);
}

/** get_whatsapp_number `{ number }`; null for anything else. */
export function summarizeChip(data: unknown): Chip | null {
  if (!isPayload(data) || !isPayload(data.number) || !('provider' in data.number || 'status' in data.number)) return null;
  return toChip(data.number);
}

/** get_pairing_code `{ success, code }`; null for anything else. */
export function summarizePairing(data: unknown): string | null {
  if (!isPayload(data) || typeof data.code !== 'string' || !data.code.trim() || !('success' in data)) return null;
  return data.code.trim();
}

/**
 * chipStatus.ts needsChipQr: a QR code chip that may connect is active and not marked for removal, or
 * marked for removal for lack of a connection (connecting it keeps it). The seller's own mark is
 * undone in the dashboard; a paused chip is reactivated first.
 */
function mayConnect(chip: Chip): boolean {
  return chip.provider === 'waha' && (chip.removalReason === 'disconnected' || (chip.isActive && !chip.removalAt));
}

/**
 * ChipDetailPage `showQR`: a chip that may connect, in the handshake (pending, qr_code, starting). The
 * dashboard shows its QR there; the chat, a pairing code. A disconnected chip is restarted first.
 */
export function canPair(chip: Chip): boolean {
  return mayConnect(chip) && ['pending', 'starting', 'qr_code'].includes(chip.status);
}

/** A QR code chip that dropped: "Reiniciar" puts it back in the handshake to connect again. */
export function needsRestart(chip: Chip): boolean {
  return mayConnect(chip) && chip.status === 'disconnected';
}

/** Statuses of an active chip that stop it from sending until the seller acts (chipStatus.ts ACTION_STATUSES). */
const ACTION_STATUSES = new Set(['qr_code', 'disconnected', 'banned', 'error']);

/**
 * chipsNeedingAction: the chips marked for removal, soonest first, then the active ones that do not
 * send until the seller acts. A paused chip, one still connecting and a connected one stay out.
 */
export function chipsNeedingAction(chips: readonly Chip[]): Chip[] {
  const removals = chips.filter((c) => c.removalAt).sort((a, b) => Date.parse(a.removalAt ?? '') - Date.parse(b.removalAt ?? ''));
  return [...removals, ...chips.filter((c) => !c.removalAt && c.isActive && ACTION_STATUSES.has(c.status))];
}

/** The "N chips ativos / 20" count: active and not marked for removal. */
export function activeChips(chips: readonly Chip[]): number {
  return chips.filter((c) => c.isActive && !c.removalAt).length;
}

/** WhatsApp shows the code in two groups of four: "ABCD-EFGH". */
export function formatCode(code: string): string {
  const clean = code.replace(/[^0-9a-z]/gi, '').toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : code.toUpperCase();
}

/**
 * The number typed to pair, as the route wants it: digits with country and area code. A Brazilian
 * number typed with only the area code (10 or 11 digits) gets 55; null when it cannot be a phone.
 */
export function pairingPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : null;
}

/**
 * The masked number as a line: the server keeps only the last four digits (`*********1671`), so the
 * dashboard's formatPhoneBR cannot apply, and guessing a BR layout would misread a foreign Meta chip.
 */
export function phoneLabel(masked: string | null): string {
  if (!masked) return '—';
  const last = masked.replace(/\D/g, '').slice(-4);
  return last.length === 4 ? `•••• ${last}` : masked;
}

/**
 * ChipsSection groupLookupByChipId: each chip's first operation, primary or fallback, from
 * list_whatsapp_sessions `{ sessions }`; null for anything else.
 */
export function sessionByChip(data: unknown): Record<string, string> | null {
  if (!isPayload(data) || !Array.isArray(data.sessions)) return null;
  const map: Record<string, string> = {};
  for (const s of data.sessions.filter(isPayload)) {
    const ids = [s.primaryNumberId, ...(Array.isArray(s.fallbackNumberIds) ? s.fallbackNumberIds : [])];
    for (const id of ids) {
      if (typeof id === 'string' && id && !(id in map)) map[id] = text(s.name) ?? 'Operação';
    }
  }
  return map;
}

export interface HealthOutcome {
  tone: 'success' | 'danger' | 'muted';
  title: string;
  detail: string | null;
}

/**
 * check_whatsapp_numbers worded as the chips screen's toasts after "Verificar status"; null for
 * anything else.
 */
export function summarizeHealth(data: unknown): HealthOutcome | null {
  if (!isPayload(data) || !isPayload(data.summary) || !Array.isArray(data.numbers)) return null;
  const { total, connected, divergent } = { total: count(data.summary.total), connected: count(data.summary.connected), divergent: count(data.summary.divergent) };
  if (total === 0) return { tone: 'muted', title: 'Sem chips', detail: 'Nenhum chip cadastrado pra verificar.' };
  if (divergent === 0) return { tone: 'success', title: 'Tudo certo', detail: `${connected}/${total} chip(s) conectado(s), sem divergências.` };
  const offenders = data.numbers.filter(isPayload).filter((n) => n.diverged === true)
    .map((n) => text(n.displayName) ?? String(n.numberId ?? '').slice(0, 6)).join(', ');
  return { tone: 'danger', title: `${divergent} chip(s) divergente(s), sincronizado(s)`, detail: `Status real diferia do salvo: ${offenders}. Status atualizado.` };
}
