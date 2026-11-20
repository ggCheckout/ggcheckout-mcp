import { describe, expect, it, vi } from 'vitest';
import type { Host } from '../host';
import { toInput, draftFrom } from './editor';
import { ENABLE_FAILED, createFunnel, saveStoredFunnel, toggledBase } from './funnelCalls';
import { summarizeFunnel, type FunnelDetail } from './model';

/** The funnel as get_whatsapp_funnel answers it. */
const raw = (text: string, extra: Record<string, unknown> = {}) => ({
  funnel: {
    id: 'f1', name: 'Carrinho', trigger: 'abandoned_cart', isEnabled: false, sessionGroupId: null, createdAt: 'x', updatedAt: 'x',
    steps: [{ waitMinutes: 30, text, markSeen: true, showTyping: true }],
    stopOnReply: true, sendWindow: null, signature: '', coupon: '', useEmoji: true, layout: null,
    ...extra,
  },
});

const detail = (text: string, extra: Record<string, unknown> = {}): FunnelDetail => {
  const funnel = summarizeFunnel(raw(text, extra));
  if (!funnel) throw new Error('fixture');
  return funnel;
};

/** A host whose tools answer in order, recording every call. */
function hostAnswering(...answers: Array<unknown | Error>): Host & { callTool: ReturnType<typeof vi.fn> } {
  const callTool = vi.fn();
  for (const answer of answers) {
    if (answer instanceof Error) callTool.mockRejectedValueOnce(answer);
    else callTool.mockResolvedValueOnce(answer);
  }
  return { callTool } as unknown as Host & { callTool: ReturnType<typeof vi.fn> };
}

const toolsCalled = (host: { callTool: ReturnType<typeof vi.fn> }): string[] => host.callTool.mock.calls.map(([name]) => String(name));

describe('saveStoredFunnel', () => {
  it('refuses, writing nothing, when the funnel changed since it was shown', async () => {
    const base = detail('Oi');
    const host = hostAnswering(raw('Mudado no painel'));
    const outcome = await saveStoredFunnel(host, base, toInput(draftFrom(base)));
    expect(outcome).toMatchObject({ kind: 'drift', fresh: { steps: [{ text: 'Mudado no painel' }] } });
    expect(toolsCalled(host)).toEqual(['get_whatsapp_funnel']);
  });

  it('writes the whole funnel when it is as shown, and answers it as stored', async () => {
    const base = detail('Oi');
    const input = { ...toInput(draftFrom(base)), name: 'Carrinho novo' };
    const host = hostAnswering(raw('Oi'), raw('Oi', { name: 'Carrinho novo' }));
    const outcome = await saveStoredFunnel(host, base, input);
    expect(outcome).toMatchObject({ kind: 'saved', funnel: { name: 'Carrinho novo' } });
    expect(host.callTool).toHaveBeenLastCalledWith('update_whatsapp_funnel', { funnelId: 'f1', ...input });
  });

  it('says it saved without a funnel when neither the answer nor a re-read can be read', async () => {
    const base = detail('Oi');
    const host = hostAnswering(raw('Oi'), { nope: true }, new Error('down'));
    expect(await saveStoredFunnel(host, base, toInput(draftFrom(base)))).toEqual({ kind: 'saved', funnel: null });
  });
});

describe('toggledBase (on/off, then Salvar)', () => {
  it('changes only the flag, so an edit made elsewhere still refuses the next save', async () => {
    const base = detail('Oi');
    // The toggle answers the funnel as stored now, with the dashboard's edit in it.
    const afterToggle = toggledBase(base, true);
    expect(afterToggle).toEqual({ ...base, isEnabled: true });

    const host = hostAnswering(raw('Mudado no painel', { isEnabled: true }));
    const outcome = await saveStoredFunnel(host, afterToggle, toInput(draftFrom(base)));
    expect(outcome.kind).toBe('drift');
    expect(toolsCalled(host)).not.toContain('update_whatsapp_funnel');
  });
});

describe('createFunnel', () => {
  const input = toInput(draftFrom(detail('Oi')));

  it('turns the cart funnel on right after creating it when its trigger is free', async () => {
    const host = hostAnswering(raw('Oi'), raw('Oi', { isEnabled: true }));
    expect(await createFunnel(host, input, false)).toMatchObject({ funnel: { isEnabled: true }, enableFailed: false });
    expect(toolsCalled(host)).toEqual(['create_whatsapp_funnel', 'toggle_whatsapp_funnel']);
  });

  it('leaves it off, and says so, when the toggle is refused', async () => {
    const host = hostAnswering(raw('Oi'), new Error('API Error (409): trigger taken'));
    expect(await createFunnel(host, input, false)).toMatchObject({ funnel: { isEnabled: false }, enableFailed: true });
    expect(ENABLE_FAILED).toMatch(/criado/);
  });

  it('does not try to turn it on when another funnel holds the trigger', async () => {
    const host = hostAnswering(raw('Oi'));
    expect(await createFunnel(host, input, true)).toMatchObject({ enableFailed: false });
    expect(toolsCalled(host)).toEqual(['create_whatsapp_funnel']);
  });
});
