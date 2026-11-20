import { describe, it, expect, vi } from 'vitest';
import { WhatsAppFunnelService } from './whatsapp-funnel.service.js';
import type { WhatsAppFunnelPort } from '../ports/whatsapp-funnel.port.js';
import type { WhatsAppFunnel } from '../types/whatsapp-funnel.js';

const stored: WhatsAppFunnel = {
  id: '2f9d6c3e-4b1a-4c55-9a7e-0a1b2c3d4e5f',
  name: 'Carrinho',
  trigger: 'abandoned_cart',
  isEnabled: true,
  sessionGroupId: null,
  stopOnReply: true,
  sendWindow: { start: 8, end: 20 },
  signature: 'Equipe',
  coupon: '',
  useEmoji: false,
  steps: [
    { waitMinutes: 30, text: 'Oi', markSeen: true, showTyping: true },
    { waitMinutes: 60, text: 'Ainda aí?', markSeen: false, showTyping: false },
  ],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-02T00:00:00Z',
};

function setup() {
  const port = {
    list: vi.fn(), get: vi.fn().mockResolvedValue(stored), create: vi.fn(), replace: vi.fn().mockResolvedValue(stored),
    delete: vi.fn(), toggle: vi.fn(), importContacts: vi.fn(),
  } satisfies WhatsAppFunnelPort;
  return { port, service: new WhatsAppFunnelService(port) };
}

describe('WhatsAppFunnelService.update', () => {
  it('merges the edit into the stored funnel and replaces it whole, without ids, dates or a null session', async () => {
    const { port, service } = setup();
    await service.update(stored.id, { name: 'Carrinho novo', sendWindow: { start: 9, end: 21 } });
    expect(port.replace).toHaveBeenCalledWith(stored.id, {
      name: 'Carrinho novo',
      trigger: 'abandoned_cart',
      stopOnReply: true,
      sendWindow: { start: 9, end: 21 },
      signature: 'Equipe',
      coupon: '',
      useEmoji: false,
      steps: stored.steps,
    });
  });

  it('replaces the steps as a list', async () => {
    const { port, service } = setup();
    const steps = [{ waitMinutes: 15, text: 'Só um', markSeen: true, showTyping: true }];
    await service.update(stored.id, { steps });
    expect((port.replace.mock.calls[0][1] as any).steps).toEqual(steps);
  });

  it('clears the window with null and keeps a session the funnel has', async () => {
    const { port, service } = setup();
    port.get.mockResolvedValue({ ...stored, trigger: 'manual', sessionGroupId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    await service.update(stored.id, { sendWindow: null });
    expect(port.replace.mock.calls[0][1]).toMatchObject({ sendWindow: null, sessionGroupId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  });

  it('replaces the layout as a whole drawing instead of merging it', async () => {
    const { port, service } = setup();
    port.get.mockResolvedValue({ ...stored, layout: { start: { x: 0, y: 0 }, 'message-2': { x: 9, y: 9 } } });
    await service.update(stored.id, { layout: { end: { x: 1, y: 2 } } });
    expect((port.replace.mock.calls[0][1] as any).layout).toEqual({ end: { x: 1, y: 2 } });
  });

  it('drops the positions past the new last step when steps shrink without a layout', async () => {
    const { port, service } = setup();
    port.get.mockResolvedValue({ ...stored, layout: { start: { x: 0, y: 0 }, 'wait-2': { x: 5, y: 5 }, 'message-2': { x: 9, y: 9 } } });
    await service.update(stored.id, { steps: [stored.steps[0]] });
    expect((port.replace.mock.calls[0][1] as any).layout).toEqual({ start: { x: 0, y: 0 } });

    port.get.mockResolvedValue({ ...stored, layout: { 'message-2': { x: 9, y: 9 } } });
    await service.update(stored.id, { steps: [stored.steps[0]] });
    expect((port.replace.mock.calls[1][1] as any).layout).toBeNull();
  });

  it('does not write when the funnel cannot be read', async () => {
    const { port, service } = setup();
    port.get.mockRejectedValue(new Error('not found'));
    await expect(service.update(stored.id, { name: 'x' })).rejects.toThrow('not found');
    expect(port.replace).not.toHaveBeenCalled();
  });
});

describe('WhatsAppFunnelService passthrough', () => {
  it('forwards the other calls untouched', async () => {
    const { port, service } = setup();
    await service.list({ limit: 5 });
    await service.toggle(stored.id, false);
    await service.delete(stored.id);
    await service.importContacts(stored.id, [{ phone: '5531999998888' }]);
    expect(port.list).toHaveBeenCalledWith({ limit: 5 });
    expect(port.toggle).toHaveBeenCalledWith(stored.id, false);
    expect(port.delete).toHaveBeenCalledWith(stored.id);
    expect(port.importContacts).toHaveBeenCalledWith(stored.id, [{ phone: '5531999998888' }]);
  });
});
