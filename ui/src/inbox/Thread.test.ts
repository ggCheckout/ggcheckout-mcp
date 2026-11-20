import { describe, expect, it, vi } from 'vitest';
import type { Host } from '../host';
import { loadManualFunnels } from './Thread';

const funnel = (id: string, trigger = 'manual') => ({ id, name: id, trigger, isEnabled: true });

function hostWith(pages: unknown[]): Host & { callTool: ReturnType<typeof vi.fn> } {
  const callTool = vi.fn();
  for (const page of pages) callTool.mockResolvedValueOnce(page);
  return { callTool } as unknown as Host & { callTool: ReturnType<typeof vi.fn> };
}

describe('loadManualFunnels', () => {
  it('reads every page, passing nextAfter back as after', async () => {
    const host = hostWith([
      { items: [funnel('f1'), funnel('f2', 'abandoned_cart')], nextAfter: 'c1' },
      { items: [funnel('f3')], nextAfter: null },
    ]);
    expect(await loadManualFunnels(host)).toEqual([{ id: 'f1', name: 'f1' }, { id: 'f3', name: 'f3' }]);
    expect(host.callTool).toHaveBeenNthCalledWith(1, 'list_whatsapp_funnels', { limit: 50 });
    expect(host.callTool).toHaveBeenNthCalledWith(2, 'list_whatsapp_funnels', { limit: 50, after: 'c1' });
  });

  it('is null when the first page is unreadable, and keeps what it has when a later one is', async () => {
    expect(await loadManualFunnels(hostWith([{ nope: true }]))).toBeNull();
    expect(await loadManualFunnels(hostWith([{ items: [funnel('f1')], nextAfter: 'c1' }, { nope: true }])))
      .toEqual([{ id: 'f1', name: 'f1' }]);
  });
});
