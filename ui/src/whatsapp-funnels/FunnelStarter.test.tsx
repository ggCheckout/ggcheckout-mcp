import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FUNNEL_MODELS } from './editor';
import { FunnelStarter, modelConfirmation } from './FunnelStarter';

const model = (key: string) => {
  const found = FUNNEL_MODELS.find((m) => m.key === key);
  if (!found) throw new Error(`no model ${key}`);
  return found;
};

describe('modelConfirmation', () => {
  it('says the cart funnel is created and starts sending when its trigger is free', () => {
    const asked = modelConfirmation(model('abandoned_cart'), false);
    expect(asked.confirmLabel).toBe('Criar e ligar');
    expect(asked.message).toMatch(/já liga: envia sozinho/);
  });

  it('says the funnel is born off when its trigger is taken or it never turns on by itself', () => {
    for (const [key, taken] of [['abandoned_cart', true], ['pix_unpaid', false], ['manual', false]] as const) {
      const asked = modelConfirmation(model(key), taken);
      expect(asked.confirmLabel, key).toBe('Criar funil');
      expect(asked.message, key).toMatch(/criado desligado/);
    }
  });
});

// No DOM in the ui workspace: this pins the first render, before any click.
describe('FunnelStarter', () => {
  it('opens on the models with "Usar modelo" and no confirmation yet, and creates nothing', () => {
    const onUseModel = vi.fn();
    const html = renderToStaticMarkup(
      <FunnelStarter siblings={[]} operations={[]} busy={false} error={null} onUseModel={onUseModel} onBlank={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(html).toContain('Usar modelo');
    expect(html).not.toContain('alertdialog');
    expect(onUseModel).not.toHaveBeenCalled();
  });
});
