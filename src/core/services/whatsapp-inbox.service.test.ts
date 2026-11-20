import { describe, it, expect, vi } from 'vitest';
import { WhatsAppInboxService } from './whatsapp-inbox.service.js';
import type { WhatsAppInboxPort } from '../ports/whatsapp-inbox.port.js';
import { FeatureUnavailableError, InboxAccessDisabledError, InboxTermsRequiredError } from '../../shared/errors.js';

const conversation = (unread: number) => ({
  contactKey: '5531999998888', name: 'Ana', chipId: 'c', openedByChipId: 'c', lastText: 'oi', lastType: 'text' as const,
  lastAt: '2026-11-20T10:00:00Z', unread, interacted: true,
});

function setup() {
  const port = {
    getSettings: vi.fn().mockResolvedValue({ autoSwitchChip: true, apiAccessEnabled: true, updatedAt: null }),
    listConversations: vi.fn().mockResolvedValue({ items: [conversation(2), conversation(0), conversation(3)], nextBefore: null }),
    listMessages: vi.fn(), sendReply: vi.fn(), markRead: vi.fn().mockResolvedValue({}), getContactRun: vi.fn().mockResolvedValue(null),
    startRun: vi.fn(), stopRun: vi.fn(), setOptOut: vi.fn(),
  } satisfies WhatsAppInboxPort;
  return { port, service: new WhatsAppInboxService(port) };
}

describe('WhatsAppInboxService.summarize', () => {
  it('counts conversations and unread messages, and hands back nothing else', async () => {
    const { service } = setup();
    const { summary, state } = await service.summarize();
    expect(summary).toEqual({ available: true, enabled: true, conversations: 3, unread: 5, truncated: false });
    expect(state).toBe('ready');
  });

  it('reads the next pages until the end, at most four', async () => {
    const { port, service } = setup();
    port.listConversations.mockResolvedValue({ items: [conversation(1)], nextBefore: '9:5531999998888' });
    const { summary } = await service.summarize();
    expect(port.listConversations).toHaveBeenCalledTimes(4);
    expect(port.listConversations).toHaveBeenLastCalledWith({ limit: 50, before: '9:5531999998888' });
    expect(summary).toMatchObject({ conversations: 4, unread: 4, truncated: true });
  });

  it('is not truncated when the last page it reads is the last one', async () => {
    const { port, service } = setup();
    port.listConversations
      .mockResolvedValueOnce({ items: [conversation(1)], nextBefore: '9:5531999998888' })
      .mockResolvedValueOnce({ items: [conversation(1)], nextBefore: null });
    expect((await service.summarize()).summary).toMatchObject({ conversations: 2, truncated: false });
  });

  it('is off, without reading a single conversation, while the switch is off or missing', async () => {
    const { port, service } = setup();
    for (const settings of [{ autoSwitchChip: true, apiAccessEnabled: false, updatedAt: null }, { autoSwitchChip: true, updatedAt: null }]) {
      port.getSettings.mockResolvedValue(settings);
      const { summary, state } = await service.summarize();
      expect(summary).toEqual({ available: true, enabled: false, conversations: 0, unread: 0, truncated: false });
      expect(state).toBe('off');
    }
    expect(port.listConversations).not.toHaveBeenCalled();
  });

  it('is unavailable when the saas has no inbox routes', async () => {
    const { port, service } = setup();
    port.getSettings.mockRejectedValue(new FeatureUnavailableError());
    expect(await service.summarize()).toEqual({ summary: { available: false, enabled: false, conversations: 0, unread: 0, truncated: false }, state: 'unavailable' });
  });

  it('is off when the switch is turned off between the two reads', async () => {
    const { port, service } = setup();
    port.listConversations.mockRejectedValue(new InboxAccessDisabledError());
    expect((await service.summarize()).state).toBe('off');
  });

  it('asks for the term when the core wants it', async () => {
    const { port, service } = setup();
    port.listConversations.mockRejectedValue(new InboxTermsRequiredError());
    expect(await service.summarize()).toEqual({ summary: { available: true, enabled: true, conversations: 0, unread: 0, truncated: false }, state: 'terms_required' });
  });

  it('lets any other failure through', async () => {
    const { port, service } = setup();
    port.getSettings.mockRejectedValue(new Error('boom'));
    await expect(service.summarize()).rejects.toThrow('boom');
  });
});

describe('WhatsAppInboxService passthrough', () => {
  it('wraps the contact run and the read mark the way the tools answer', async () => {
    const { service } = setup();
    expect(await service.getContactRun('5531999998888')).toEqual({ run: null });
    expect(await service.markRead('5531999998888')).toEqual({ success: true });
  });
});
