import type { Host } from '../host';
import { bornEnabled, unchangedSince, type FunnelInput } from './editor';
import { summarizeFunnel, summarizeFunnels, type FunnelDetail, type FunnelRow } from './model';

/** list_whatsapp_funnels page size: the tool's maximum. */
const LIST_PAGE = 50;
/**
 * FUNNEL_LIST_MAX_PAGES in the saas: the list comes newest first with no filter on the trigger or the
 * state, so an enabled funnel can sit past the first page. 10 pages are 500 funnels.
 */
export const FUNNEL_LIST_MAX_PAGES = 10;

export interface AllFunnels {
  funnels: FunnelRow[];
  /** false when the read stopped at the page cap or at an unreadable page after the first. */
  complete: boolean;
}

/** Every funnel, page after page up to the cap; null when the first page is unreadable. */
export async function listAllFunnels(host: Host): Promise<AllFunnels | null> {
  const funnels: FunnelRow[] = [];
  let after: string | null = null;
  for (let page = 0; page < FUNNEL_LIST_MAX_PAGES; page++) {
    const read = summarizeFunnels(await host.callTool('list_whatsapp_funnels', { limit: LIST_PAGE, ...(after ? { after } : {}) }));
    if (!read) return page === 0 ? null : { funnels, complete: false };
    funnels.push(...read.funnels);
    after = read.nextAfter;
    if (!after) return { funnels, complete: true };
  }
  return { funnels, complete: false };
}

export async function readFunnel(host: Host, id: string): Promise<FunnelDetail> {
  const fresh = summarizeFunnel(await host.callTool('get_whatsapp_funnel', { funnelId: id }));
  if (!fresh) throw new Error('get_whatsapp_funnel answered no funnel');
  return fresh;
}

export type SaveOutcome =
  | { kind: 'drift'; fresh: FunnelDetail }
  /** `funnel` is null when the write went through but neither its answer nor a re-read could be read. */
  | { kind: 'saved'; funnel: FunnelDetail | null };

/**
 * Salvar of a stored funnel. The route replaces the funnel whole, so the funnel is read first and the
 * write is refused when it changed since `base` was shown (in the dashboard, the chat or another card):
 * saving would undo that change.
 */
export async function saveStoredFunnel(host: Host, base: FunnelDetail, input: FunnelInput): Promise<SaveOutcome> {
  const fresh = await readFunnel(host, base.id);
  if (!unchangedSince(base, fresh)) return { kind: 'drift', fresh };
  const answer = summarizeFunnel(await host.callTool('update_whatsapp_funnel', { funnelId: base.id, ...input }));
  if (answer) return { kind: 'saved', funnel: answer };
  try {
    return { kind: 'saved', funnel: await readFunnel(host, base.id) };
  } catch {
    return { kind: 'saved', funnel: null };
  }
}

/**
 * The base after on/off: only the flag changes. The toggle answers the funnel as stored now, and taking
 * the rest of it as the base would hide an edit made elsewhere from the drift check of the next Salvar,
 * which would then write the draft over it.
 */
export function toggledBase(base: FunnelDetail, enabled: boolean): FunnelDetail {
  return { ...base, isEnabled: enabled };
}

/**
 * The create and, for the abandoned cart, the toggle right after (the dashboard's decision: the cart
 * funnel is born on; the core creates it off). A refused toggle (another funnel holds the trigger, a
 * missing coupon) leaves the funnel created and off, and says so.
 */
export async function createFunnel(host: Host, input: FunnelInput, triggerTaken: boolean): Promise<{ funnel: FunnelDetail; enableFailed: boolean }> {
  const created = summarizeFunnel(await host.callTool('create_whatsapp_funnel', { ...input }));
  if (!created) throw new Error('create_whatsapp_funnel answered no funnel');
  if (!bornEnabled(created.trigger, triggerTaken)) return { funnel: created, enableFailed: false };
  try {
    const enabled = summarizeFunnel(await host.callTool('toggle_whatsapp_funnel', { funnelId: created.id, enabled: true }));
    return { funnel: enabled ?? { ...created, isEnabled: true }, enableFailed: false };
  } catch {
    return { funnel: created, enableFailed: true };
  }
}

/** What the screen says when the funnel was created but the toggle that turns it on was refused. */
export const ENABLE_FAILED = 'Funil criado, mas não foi possível ligar. Ligue pelo interruptor quando quiser começar a enviar.';
