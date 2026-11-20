import type { Host } from '../host';
import { bornEnabled, type FunnelInput } from './editor';
import { summarizeFunnel, type FunnelDetail } from './model';

/**
 * useCreateFunnel: the create and, for the abandoned cart, the toggle right after (decision 5: the
 * cart funnel is born on; the core creates it off). A refused toggle (another funnel holds the
 * trigger, a missing coupon) leaves the funnel created and off, and says so.
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
