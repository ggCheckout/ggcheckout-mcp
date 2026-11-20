import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Host, HostSnapshot } from '../host';
import { ChipPicker, OperationsView, ProductPicker } from './OperationsView';

const host = (): Host => ({
  getSnapshot: vi.fn(), subscribe: vi.fn(), callTool: vi.fn(() => new Promise(() => {})), tellModel: vi.fn(), openLink: vi.fn(),
});
const session = { uid: 'g1', name: 'Método Aurora', primaryNumberId: 'c1', fallbackNumberIds: ['c2'], assignedProducts: [], isActive: true };
const snapshot = (toolName: string, payload: unknown, canCallTools = true): HostSnapshot => ({
  toolName, args: {}, colorMode: 'light', canCallTools, generation: 1, payload,
});

// No DOM in the ui workspace: these pin the first render, before any read answers or any click.
describe('OperationsView', () => {
  it('draws the operation with its slots and actions, and sends no write before a confirmation', () => {
    const h = host();
    const html = renderToStaticMarkup(<OperationsView host={h} state={snapshot('get_whatsapp_session', { session })} />);
    expect(html).toContain('Método Aurora');
    expect(html).toContain('Principal');
    expect(html).toContain('Reserva 1');
    expect(html).toContain('Adicionar chip');
    expect(html).toContain('Nenhum produto atribuído');
    expect(html).not.toContain('alertdialog');
    expect(h.callTool).not.toHaveBeenCalled();
  });

  it('offers no edit when the host cannot call tools', () => {
    const html = renderToStaticMarkup(<OperationsView host={host()} state={snapshot('get_whatsapp_session', { session }, false)} />);
    expect(html).not.toContain('Adicionar chip');
    expect(html).not.toContain('Promover');
  });

  it('lists the operations with fallbacks and products counted', () => {
    const html = renderToStaticMarkup(<OperationsView host={host()} state={snapshot('list_whatsapp_sessions', { sessions: [session, { ...session, uid: 'g2', name: 'Mentoria', fallbackNumberIds: [], assignedProducts: ['p1'], isActive: false }] })} />);
    expect(html).toContain('Operações');
    expect(html).toContain('1 reserva');
    expect(html).toContain('Sem reserva');
    expect(html).toContain('1 produto');
    expect(html).toContain('Pausada');
  });
});

// The loading line of each picker sits in a status region that stays mounted, so its text is announced
// when it changes; an empty region is visually hidden by `.status-region:empty`.
describe('picker status regions', () => {
  const op = { id: 'g1', name: 'Op', chipIds: ['c1'], productIds: [], isActive: true };
  const noop = vi.fn();

  it('ChipPicker keeps its status region mounted, with the loading text only while the chips load', () => {
    expect(renderToStaticMarkup(<ChipPicker op={op} chips={null} chipsFailed={false} onPick={noop} onCancel={noop} />))
      .toContain('<p class="ch-hint status-region" role="status">Carregando os chips…</p>');
    expect(renderToStaticMarkup(<ChipPicker op={op} chips={new Map()} chipsFailed={false} onPick={noop} onCancel={noop} />))
      .toContain('<p class="ch-hint status-region" role="status"></p>');
  });

  it('ProductPicker keeps its status region mounted, with the loading text only while the products load', () => {
    expect(renderToStaticMarkup(<ProductPicker products={undefined} assigned={[]} onSave={noop} onCancel={noop} />))
      .toContain('<p class="ch-hint status-region" role="status">Carregando os produtos…</p>');
    expect(renderToStaticMarkup(<ProductPicker products={[]} assigned={[]} onSave={noop} onCancel={noop} />))
      .toContain('<p class="ch-hint status-region" role="status"></p>');
  });
});

