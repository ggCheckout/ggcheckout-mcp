import { describe, expect, it, vi } from 'vitest';
import type { Chip } from '../chips/model';
import type { Host } from '../host';
import {
  chipOrder, moveChip, operationHealth, slotLabel, summarizeOperation, summarizeOperations, summarizeProducts, unchangedSince, writeOperation, type Operation,
} from './model';

const raw = { uid: 'g1', name: 'Método Aurora', primaryNumberId: 'c1', fallbackNumberIds: ['c2', '', 'c3'], assignedProducts: ['p1', 7], isActive: true };
const op = (chipIds: string[]): Operation => ({ id: 'g1', name: 'Op', chipIds, productIds: [], isActive: true });
const chip = (id: string, status: string, isActive = true): Chip => ({
  id, name: id, phone: null, provider: 'waha', status, isActive, sessionsCount: 1, usedBy: null, errorMessage: null, removalAt: null, removalReason: null,
});
const chips = (...list: Chip[]) => new Map(list.map((c) => [c.id, c]));

describe('summarizeOperations / summarizeOperation', () => {
  it('reads the chips primary first and drops blank ids and non-string products', () => {
    expect(summarizeOperations({ sessions: [raw] })).toEqual([
      { id: 'g1', name: 'Método Aurora', chipIds: ['c1', 'c2', 'c3'], productIds: ['p1'], isActive: true },
    ]);
  });

  it('reads one operation from get_whatsapp_session and the write answers', () => {
    expect(summarizeOperation({ success: true, session: { ...raw, isActive: false } })?.isActive).toBe(false);
  });

  it('refuses shapes that are not operations', () => {
    expect(summarizeOperations({ sessions: [{ uid: 'x', name: 'no primary' }] })).toBeNull();
    expect(summarizeOperations({ numbers: [] })).toBeNull();
    expect(summarizeOperation({ session: { uid: 'x' } })).toBeNull();
    expect(summarizeOperation({ success: true })).toBeNull();
  });
});

describe('operationHealth (computeSessionHealth)', () => {
  it('is empty without chips and down when none sends', () => {
    expect(operationHealth(op([]), chips())).toBe('empty');
    expect(operationHealth(op(['c1', 'c2']), chips(chip('c1', 'disconnected'), chip('c2', 'authenticated', false)))).toBe('down');
  });

  it('is healthy only when every chip sends', () => {
    expect(operationHealth(op(['c1', 'c2']), chips(chip('c1', 'authenticated'), chip('c2', 'authenticated')))).toBe('healthy');
  });

  it('tells a reserve down from sending on a reserve', () => {
    expect(operationHealth(op(['c1', 'c2']), chips(chip('c1', 'authenticated'), chip('c2', 'pending')))).toBe('reserveDown');
    expect(operationHealth(op(['c1', 'c2']), chips(chip('c1', 'banned'), chip('c2', 'authenticated')))).toBe('degraded');
  });

  it('counts a chip the account no longer has as not sending', () => {
    expect(operationHealth(op(['gone', 'c2']), chips(chip('c2', 'authenticated')))).toBe('degraded');
  });
});

describe('moveChip / chipOrder / slotLabel', () => {
  it('swaps with the neighbour and refuses moves past either end', () => {
    expect(moveChip(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveChip(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveChip(['a', 'b'], 0, -1)).toBeNull();
    expect(moveChip(['a', 'b'], 1, 1)).toBeNull();
  });

  it('splits the order as update_whatsapp_session wants it', () => {
    expect(chipOrder(['b', 'a', 'c'])).toEqual({ primaryNumberId: 'b', fallbackNumberIds: ['a', 'c'] });
    expect(chipOrder([])).toBeNull();
  });

  it('names the slots like the dashboard', () => {
    expect([0, 1, 2].map(slotLabel)).toEqual(['Principal', 'Reserva 1', 'Reserva 2']);
  });
});

describe('summarizeProducts', () => {
  it('keeps id and title, sorted by title, and skips products without an id', () => {
    expect(summarizeProducts({ products: [{ uid: 'p2', title: 'Zeta' }, { uid: 'p1', title: 'alfa' }, { title: 'sem id' }, { uid: 'p3' }] })).toEqual([
      { id: 'p1', title: 'alfa' }, { id: 'p3', title: 'Produto sem nome' }, { id: 'p2', title: 'Zeta' },
    ]);
    expect(summarizeProducts({ product: {} })).toBeNull();
  });
});

describe('unchangedSince', () => {
  const seen: Operation = { id: 'g1', name: 'Op', chipIds: ['a', 'b'], productIds: ['p1'], isActive: true };

  it('accepts the same chips and products, even if the name or pause changed', () => {
    expect(unchangedSince(seen, { ...seen, name: 'Outro', isActive: false })).toBe(true);
  });

  it('refuses a reordered chip list or a changed product list', () => {
    expect(unchangedSince(seen, { ...seen, chipIds: ['b', 'a'] })).toBe(false);
    expect(unchangedSince(seen, { ...seen, chipIds: ['a'] })).toBe(false);
    expect(unchangedSince(seen, { ...seen, productIds: ['p1', 'p2'] })).toBe(false);
  });
});

describe('writeOperation (the re-read before a write that replaces a list)', () => {
  const session = (primaryNumberId: string, fallbackNumberIds: string[], assignedProducts: string[] = []) => ({
    session: { uid: 'g1', name: 'Op', primaryNumberId, fallbackNumberIds, assignedProducts, isActive: true },
  });
  const hostAnswering = (...answers: unknown[]) => {
    const callTool = vi.fn();
    for (const answer of answers) callTool.mockResolvedValueOnce(answer);
    return { callTool } as unknown as Host & { callTool: ReturnType<typeof vi.fn> };
  };

  it('refuses, writing nothing, when the chips changed since the card showed them', async () => {
    const host = hostAnswering(session('c2', ['c1']));
    const outcome = await writeOperation(host, op(['c1', 'c2']), 'update_whatsapp_session', { primaryNumberId: 'c2', fallbackNumberIds: ['c1'] });
    expect(outcome).toMatchObject({ kind: 'drift', fresh: { chipIds: ['c2', 'c1'] } });
    expect(host.callTool).toHaveBeenCalledTimes(1);
    expect(host.callTool).toHaveBeenCalledWith('get_whatsapp_session', { sessionId: 'g1' });
  });

  it('writes when the operation is as shown, and answers it as stored', async () => {
    const host = hostAnswering(session('c1', ['c2']), session('c2', ['c1']));
    const outcome = await writeOperation(host, op(['c1', 'c2']), 'update_whatsapp_session', { primaryNumberId: 'c2', fallbackNumberIds: ['c1'] });
    expect(outcome).toMatchObject({ kind: 'done', operation: { chipIds: ['c2', 'c1'] } });
    expect(host.callTool).toHaveBeenLastCalledWith('update_whatsapp_session', { sessionId: 'g1', primaryNumberId: 'c2', fallbackNumberIds: ['c1'] });
  });

  it('refuses a product list built on products changed elsewhere', async () => {
    const host = hostAnswering(session('c1', [], ['p1', 'p9']));
    const outcome = await writeOperation(host, op(['c1']), 'set_whatsapp_session_products', { productIds: ['p2'] });
    expect(outcome.kind).toBe('drift');
  });
});

