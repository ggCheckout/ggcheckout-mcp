import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Host, HostSnapshot } from '../host';
import { ChipsView } from './ChipsView';

const host = (): Host => ({
  getSnapshot: vi.fn(), subscribe: vi.fn(), callTool: vi.fn(), tellModel: vi.fn(), openLink: vi.fn(),
});
const chip = (isActive: boolean): HostSnapshot => ({
  toolName: 'get_whatsapp_number', args: { numberId: 'c1' }, colorMode: 'light', canCallTools: true, generation: 1,
  payload: { number: { uid: 'c1', provider: 'waha', displayName: 'Suporte', status: 'authenticated', phoneNumber: '*********4321', isActive, groupsCount: 0 } },
});

// A click cannot be driven here (no DOM in the ui workspace): this pins the closed state the click starts from.
describe('ChipsView detail actions', () => {
  it.each([[true, 'Desativar'], [false, 'Reativar']])('offers %s -> "%s" with no confirmation open and no write sent', (active, label) => {
    const h = host();
    const html = renderToStaticMarkup(<ChipsView host={h} state={chip(active)} />);
    expect(html).toContain(label);
    expect(html).toContain('Reiniciar');
    expect(html).not.toContain('alertdialog');
    expect(h.callTool).not.toHaveBeenCalled();
  });
});

describe('ChipsView list', () => {
  it('mounts the status region of "Verificar status" empty, before any check, so the result is announced', () => {
    const state: HostSnapshot = {
      toolName: 'list_whatsapp_numbers', args: {}, colorMode: 'light', canCallTools: true, generation: 1,
      payload: { numbers: [{ uid: 'c1', provider: 'waha', displayName: 'Suporte', status: 'authenticated', phoneNumber: '*********4321', isActive: true, groupsCount: 0 }] },
    };
    expect(renderToStaticMarkup(<ChipsView host={host()} state={state} />)).toContain('<div class="status-region" role="status"></div>');
  });
});

