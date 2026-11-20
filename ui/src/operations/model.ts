// Turns the WhatsApp operation tools into what the operations view draws, following the seller's
// "Operações" screens (saas components/settings/whatsapp/sections/sessions: SessionsSection,
// SessionDetailPage, ChipSlots, sessionHealth). The API still calls an operation a session:
// list_whatsapp_sessions is the list, get_whatsapp_session one operation, and the write tools answer
// the operation as it is after the write. Pure.

import type { Host } from '../host';
import { type Payload, isPayload, text } from '../lib/payload';
import type { Chip } from '../chips/model';

/** MAX_FALLBACK_NUMBERS in the saas: the primary and up to two fallbacks. */
export const MAX_CHIPS = 3;

export interface Operation {
  id: string;
  name: string;
  /** The primary first, then the fallbacks in the order they take over. */
  chipIds: string[];
  productIds: string[];
  isActive: boolean;
}

function toOperation(s: Payload): Operation {
  const ids = [s.primaryNumberId, ...(Array.isArray(s.fallbackNumberIds) ? s.fallbackNumberIds : [])];
  return {
    id: String(s.uid ?? s.id ?? ''),
    name: text(s.name) ?? 'Operação',
    // groupNumberIds: no blank id; a chip listed twice is kept, as the saas keeps it.
    chipIds: ids.filter((id): id is string => typeof id === 'string' && id.length > 0),
    productIds: Array.isArray(s.assignedProducts) ? s.assignedProducts.filter((id): id is string => typeof id === 'string' && id.length > 0) : [],
    isActive: s.isActive !== false,
  };
}

/** An operation as the API sends it: it always names its primary chip. */
const isOperation = (s: unknown): s is Payload => isPayload(s) && 'primaryNumberId' in s;

/** list_whatsapp_sessions `{ sessions }`; null for anything else. */
export function summarizeOperations(data: unknown): Operation[] | null {
  if (!isPayload(data) || !Array.isArray(data.sessions) || !data.sessions.every(isOperation)) return null;
  return data.sessions.map(toOperation);
}

/** get_whatsapp_session and the write tools `{ session }`; null for anything else. */
export function summarizeOperation(data: unknown): Operation | null {
  if (!isPayload(data) || !isOperation(data.session)) return null;
  return toOperation(data.session);
}

export type OperationHealth = 'healthy' | 'reserveDown' | 'degraded' | 'down' | 'empty';

/** Settings.whatsapp.subnav.sessionHealth (pt), the words the dashboard shows. */
export const HEALTH_LABEL: Record<OperationHealth, string> = {
  healthy: 'Enviando',
  reserveDown: 'Reserva fora',
  degraded: 'Em reserva',
  down: 'Sem cobertura',
  empty: 'Sem cobertura',
};

export const HEALTH_TONE: Record<OperationHealth, 'success' | 'warning' | 'danger' | 'muted'> = {
  healthy: 'success',
  reserveDown: 'warning',
  degraded: 'warning',
  down: 'danger',
  empty: 'muted',
};

/**
 * computeSessionHealth: green when the primary and every fallback send, amber when a fallback is down
 * with the primary sending or a fallback took over, red when no chip covers. A chip sends when it is
 * active and authenticated; a chip missing from `chips` (deleted) does not.
 */
export function operationHealth(op: Operation, chips: ReadonlyMap<string, Chip>): OperationHealth {
  if (op.chipIds.length === 0) return 'empty';
  const sends = (id: string) => {
    const chip = chips.get(id);
    return Boolean(chip?.isActive) && chip?.status === 'authenticated';
  };
  const sending = op.chipIds.filter(sends).length;
  if (sending === 0) return 'down';
  const primarySends = sends(op.chipIds[0]);
  if (primarySends && sending === op.chipIds.length) return 'healthy';
  return primarySends ? 'reserveDown' : 'degraded';
}

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Whether `fresh` still has the chips and products `seen` showed. The writes replace the whole order
 * or the whole product list, so a write built on an operation changed elsewhere (the dashboard, the
 * model) would undo that change: the view refuses it instead.
 */
export function unchangedSince(seen: Operation, fresh: Operation): boolean {
  return sameList(seen.chipIds, fresh.chipIds) && sameList(seen.productIds, fresh.productIds);
}

/** The tools that change an operation from the card; each answers `{ session }` as it is after the write. */
export type OperationWriteTool = 'update_whatsapp_session' | 'add_whatsapp_session_number' | 'remove_whatsapp_session_number' | 'set_whatsapp_session_products';

export type WriteOutcome =
  | { kind: 'drift'; fresh: Operation }
  /** `operation` is null when the write went through but its answer could not be read. */
  | { kind: 'done'; operation: Operation | null };

/**
 * A confirmed write of the card. The operation is read first: the writes replace the whole chip order
 * or product list, so one built on an operation changed since the card showed `seen` is refused.
 */
export async function writeOperation(host: Host, seen: Operation, tool: OperationWriteTool, args: Record<string, unknown>): Promise<WriteOutcome> {
  const fresh = summarizeOperation(await host.callTool('get_whatsapp_session', { sessionId: seen.id }));
  if (!fresh) throw new Error('get_whatsapp_session answered no operation');
  if (!unchangedSince(seen, fresh)) return { kind: 'drift', fresh };
  return { kind: 'done', operation: summarizeOperation(await host.callTool(tool, { sessionId: seen.id, ...args })) };
}

/** The order as update_whatsapp_session wants it: both fields go together. */
export interface ChipOrder {
  primaryNumberId: string;
  fallbackNumberIds: string[];
}

export function chipOrder(chipIds: readonly string[]): ChipOrder | null {
  const [primaryNumberId, ...fallbackNumberIds] = chipIds;
  return primaryNumberId ? { primaryNumberId, fallbackNumberIds } : null;
}

/** The chips with the one at `index` moved by `delta` (-1 up, 1 down); null when it cannot move. */
export function moveChip(chipIds: readonly string[], index: number, delta: -1 | 1): string[] | null {
  const target = index + delta;
  if (index < 0 || index >= chipIds.length || target < 0 || target >= chipIds.length) return null;
  const next = [...chipIds];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** The slot's name: "Principal" for the first chip, "Reserva n" for the others (NewSession backupLabel). */
export function slotLabel(index: number): string {
  return index === 0 ? 'Principal' : `Reserva ${index}`;
}

export interface ProductOption {
  id: string;
  title: string;
}

/** list_products `{ products }`, by title; null for anything else. */
export function summarizeProducts(data: unknown): ProductOption[] | null {
  if (!isPayload(data) || !Array.isArray(data.products)) return null;
  return data.products.filter(isPayload)
    .map((p) => ({ id: String(p.uid ?? p.id ?? ''), title: text(p.title) ?? 'Produto sem nome' }))
    .filter((p) => p.id)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}
