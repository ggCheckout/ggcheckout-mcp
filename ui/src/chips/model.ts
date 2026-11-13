// Turns the WhatsApp chip tools into what the chips view draws, following the seller's chip screens
// (saas components/settings/whatsapp/sections/chips: ChipsGrid, ChipDetailPage, chipStatus):
// list_whatsapp_numbers is the chips list, get_whatsapp_number one chip, and get_pairing_code the code
// that connects a QR code chip from the phone. The dashboard connects by QR, which the server never
// passes on (it links a device to the account), so the chat connects with the code instead. Pure.

import { type Payload, count, isPayload, text } from '../lib/payload';

export type ChipTone = 'success' | 'info' | 'warning' | 'alert' | 'danger' | 'muted';

/** chipStatus.ts getChipStatusVisual: an inactive chip reads "Desativado" whatever its status. */
export function chipStatus(status: string, isActive: boolean): { label: string; tone: ChipTone; pulse: boolean } {
  if (!isActive) return { label: 'Desativado', tone: 'muted', pulse: false };
  switch (status) {
    case 'authenticated': return { label: 'Conectado', tone: 'success', pulse: false };
    case 'qr_code': return { label: 'QR pronto', tone: 'info', pulse: true };
    case 'pending':
    case 'starting': return { label: 'Conectando…', tone: 'warning', pulse: true };
    case 'disconnected': return { label: 'Desconectado', tone: 'alert', pulse: false };
    case 'banned': return { label: 'Banido', tone: 'danger', pulse: false };
    case 'error': return { label: 'Erro', tone: 'danger', pulse: false };
    default: return { label: status, tone: 'muted', pulse: false };
  }
}

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
  /** How many sessions use it (list) or, on one chip, the sessions themselves. */
  sessionsCount: number;
  usedBy: ChipUse[] | null;
  errorMessage: string | null;
}

function toChip(n: Payload): Chip {
  const usedBy = Array.isArray(n.usedBy)
    ? n.usedBy.filter(isPayload).map((u) => ({
      sessionId: String(u.groupId ?? ''),
      name: text(u.name) ?? 'Sessão',
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
 * ChipDetailPage `showQR`: an active QR code chip in the handshake (pending, qr_code, starting). The
 * dashboard shows its QR there; the chat, a pairing code. A disconnected chip is restarted first.
 */
export function canPair(chip: Chip): boolean {
  return chip.provider === 'waha' && chip.isActive && ['pending', 'starting', 'qr_code'].includes(chip.status);
}

/** A QR code chip that dropped: "Reiniciar" puts it back in the handshake to connect again. */
export function needsRestart(chip: Chip): boolean {
  return chip.provider === 'waha' && chip.isActive && chip.status === 'disconnected';
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
 * ChipsSection groupLookupByChipId: each chip's first session, primary or fallback, from
 * list_whatsapp_sessions `{ sessions }`; null for anything else.
 */
export function sessionByChip(data: unknown): Record<string, string> | null {
  if (!isPayload(data) || !Array.isArray(data.sessions)) return null;
  const map: Record<string, string> = {};
  for (const s of data.sessions.filter(isPayload)) {
    const ids = [s.primaryNumberId, ...(Array.isArray(s.fallbackNumberIds) ? s.fallbackNumberIds : [])];
    for (const id of ids) {
      if (typeof id === 'string' && id && !(id in map)) map[id] = text(s.name) ?? 'Sessão';
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
