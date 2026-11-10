import { describe, expect, it } from 'vitest';
import { formatSeconds, nodePreview, summarizeFlow, summarizeFlowList } from './model';

// QA on 2026-11-10 (trimmed): "Fluxo de estudo", a visual flow.
const qaFlow = {
  flow: {
    id: '4d96', name: 'Fluxo de estudo (saas#1988)', mode: 'visual', published: true, hasUnpublishedChanges: false,
    nodes: [
      { id: 'n_start', type: 'trigger_start', position: { x: 0, y: 0 }, data: { command: '/start' } },
      { id: 'n_welcome', type: 'send_text', position: { x: 0, y: 130 }, data: { parseMode: 'HTML', text: '<b>Olá!</b> 👋 Este é o bot de estudo da GG.' } },
      { id: 'n_menu', type: 'ask_buttons', position: { x: 0, y: 260 }, data: { prompt: 'O que você quer testar?', options: [{ label: 'Grupo VIP', value: 'vip' }, { label: 'PIX', value: 'pix' }] } },
      { id: 'n_pix', type: 'pix_payment', position: { x: 380, y: 550 }, data: { checkoutId: '1d27f362-e183-488c-87f3-b507044b9adf' } },
    ],
    edges: [
      { id: 'e1', source: 'n_start', sourceHandle: 'default', target: 'n_welcome' },
      { id: 'e2', source: 'n_menu', sourceHandle: 'option_1', target: 'n_pix' },
      { id: 'e3', source: 'n_pix', sourceHandle: 'expired', target: 'gone' },
    ],
  },
};

describe('telegram flow', () => {
  it('reads nodes with the editor labels, previews and handles', () => {
    const flow = summarizeFlow(qaFlow)!;
    expect(flow).toMatchObject({ name: 'Fluxo de estudo (saas#1988)', mode: 'visual', published: true, unpublished: false });
    const [start, welcome, menu, pix] = flow.nodes;
    expect(start).toMatchObject({ label: 'Comando /start', preview: '/start', hasInput: false, color: '#22c55e' });
    expect(welcome.preview).toBe('Olá! 👋 Este é o bot de estudo da GG.');
    expect(menu.handles.map((h) => h.label)).toEqual(['Grupo VIP', 'PIX']);
    expect(pix).toMatchObject({ label: 'Pagamento PIX', preview: 'Checkout 1d27f362', x: 380, y: 550 });
    expect(pix.handles.map((h) => [h.id, h.label])).toEqual([['approved', 'Aprovado'], ['expired', 'Expirou']]);
  });

  it('keeps only edges between known nodes', () => {
    expect(summarizeFlow(qaFlow)!.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('previews logic nodes', () => {
    expect(nodePreview('delay', { seconds: 900 })).toBe('15 min');
    expect(nodePreview('tag_user', { tags: ['vip', 'lead'] })).toBe('vip, lead');
    expect(nodePreview('card_payment', { checkoutId: '{{selectedCheckoutId}}' })).toBe('Checkout dinâmico');
    expect(nodePreview('condition', {})).toBe('Configurar condição');
    expect(formatSeconds(3600)).toBe('1 h');
    expect(formatSeconds(45)).toBe('45s');
  });

  it('reads the flows list', () => {
    expect(summarizeFlowList({ flows: [{ id: 'c36c', mode: 'basic', name: 'Fatia 2', nodeCount: 15, published: false }] }))
      .toEqual([{ id: 'c36c', name: 'Fatia 2', mode: 'basic', published: false, nodeCount: 15 }]);
  });

  it('ignores other payloads', () => {
    expect(summarizeFlow({ flows: [] })).toBeNull();
    expect(summarizeFlowList({ flow: {} })).toBeNull();
  });
});
