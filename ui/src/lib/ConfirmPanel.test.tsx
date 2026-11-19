import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmPanel } from './ConfirmPanel';

const props = { label: 'Desativar chip', message: 'Para de enviar.', confirmLabel: 'Desativar', busyLabel: 'Desativando…', onConfirm: vi.fn(), onCancel: vi.fn() };

describe('ConfirmPanel', () => {
  it('is a named alertdialog with the message, a Cancelar and the confirm button', () => {
    const html = renderToStaticMarkup(<ConfirmPanel {...props} busy={false} />);
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-label="Desativar chip"');
    expect(html).toContain('Para de enviar.');
    expect(html).toMatch(/class="confirm-cancel"[^>]*>Cancelar</);
    expect(html).toMatch(/class="cta"[^>]*>Desativar</);
    expect(html).not.toContain('disabled');
  });

  it('is neutral unless the action warns', () => {
    expect(renderToStaticMarkup(<ConfirmPanel {...props} busy={false} />)).not.toContain('data-tone');
    expect(renderToStaticMarkup(<ConfirmPanel {...props} tone="warning" busy={false} />)).toContain('data-tone="warning"');
  });

  it('shows the title only when given', () => {
    expect(renderToStaticMarkup(<ConfirmPanel {...props} busy={false} />)).not.toContain('confirm-title');
    expect(renderToStaticMarkup(<ConfirmPanel {...props} title="Confirmar" busy={false} />)).toContain('<p class="confirm-title">Confirmar</p>');
  });

  it('locks both buttons and says what it is doing while busy', () => {
    const html = renderToStaticMarkup(<ConfirmPanel {...props} busy />);
    expect(html.match(/disabled/g)).toHaveLength(2);
    expect(html).toContain('Desativando…');
  });
});
