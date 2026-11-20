import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Host, HostSnapshot } from '../host';
import { WhatsAppFunnelsView } from './WhatsAppFunnelsView';

const host = (): Host => ({
  getSnapshot: vi.fn(), subscribe: vi.fn(), callTool: vi.fn(() => new Promise(() => {})), tellModel: vi.fn(), openLink: vi.fn(),
});
const base = { id: 'f1', name: 'Carrinho abandonado', trigger: 'abandoned_cart', isEnabled: true, sessionGroupId: null, createdAt: 'x', updatedAt: 'x' };
const funnel = {
  ...base, stopOnReply: true, sendWindow: { start: 8, end: 21 }, signature: 'Equipe', coupon: 'VOLTA10', useEmoji: true,
  steps: [{ waitMinutes: 30, text: 'Oi {{customer_name}} <b>x</b>', markSeen: true, showTyping: true }],
};
const snapshot = (toolName: string, payload: unknown, canCallTools = true): HostSnapshot => ({
  toolName, args: {}, colorMode: 'light', canCallTools, generation: 1, payload,
});

// No DOM in the ui workspace: these pin the first render, before any read answers or any click.
describe('WhatsAppFunnelsView', () => {
  it('draws the funnel with its messages as text, and sends no write before a confirmation', () => {
    const h = host();
    const html = renderToStaticMarkup(<WhatsAppFunnelsView host={h} state={snapshot('get_whatsapp_funnel', { funnel })} />);
    expect(html).toContain('Carrinho abandonado');
    expect(html).toContain('Espera 30 min depois do carrinho abandonado');
    expect(html).toContain('Envia das 8h às 21h (Brasília)');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('Desligar');
    expect(html).not.toContain('alertdialog');
    expect(h.callTool).not.toHaveBeenCalledWith('toggle_whatsapp_funnel', expect.anything());
    expect(h.callTool).not.toHaveBeenCalledWith('delete_whatsapp_funnel', expect.anything());
  });

  it('offers no write when the host cannot call tools', () => {
    const html = renderToStaticMarkup(<WhatsAppFunnelsView host={host()} state={snapshot('get_whatsapp_funnel', { funnel }, false)} />);
    expect(html).not.toContain('Desligar');
    expect(html).not.toContain('Excluir');
  });

  it('lists the funnels with their trigger, messages and operation', () => {
    const items = [{ ...base, stepCount: 2 }, { ...base, id: 'f2', name: 'Boas-vindas', trigger: 'manual', isEnabled: false, sessionGroupId: 'g1', stepCount: 1 }];
    const html = renderToStaticMarkup(<WhatsAppFunnelsView host={host()} state={snapshot('list_whatsapp_funnels', { items, nextAfter: null })} />);
    expect(html).toContain('Seus funis');
    expect(html).toContain('2 mensagens');
    expect(html).toContain('Pela operação do produto');
    expect(html).toContain('Desligado');
  });

  it('says how to create the first funnel when there is none', () => {
    const html = renderToStaticMarkup(<WhatsAppFunnelsView host={host()} state={snapshot('list_whatsapp_funnels', { items: [], nextAfter: null })} />);
    expect(html).toContain('Nenhum funil criado');
  });
});
