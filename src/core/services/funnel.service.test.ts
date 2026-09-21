import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunnelService } from './funnel.service.js';
import type { FunnelPort } from '../ports/funnel.port.js';

describe('FunnelService', () => {
  let service: FunnelService;
  let mockPort: FunnelPort;

  const stored = {
    id: 'f-1',
    title: 'Quiz',
    design: {
      general: { maxWidth: 600, spacing: 16, borderRadius: 8 },
      colors: { primary: '#000', secondary: '#111', background: '#fff', text: '#222' },
      typography: { headingFont: 'Inter', bodyFont: 'Inter', headingWeight: 700, bodyWeight: 400 },
    },
    settings: {
      seo: { title: 'SEO', description: 'd', ogImage: '', favicon: '' },
      webhookIds: ['w-1'],
      pixelTokenIds: { facebook_ads: 't-1' },
      webhookSecret: 'hidden-by-the-sanitizer',
    },
  };

  beforeEach(() => {
    mockPort = {
      list: vi.fn(),
      getById: vi.fn(),
      getRawForMerge: vi.fn().mockResolvedValue(structuredClone(stored)),
      listCheckouts: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
      duplicate: vi.fn(),
      listLeads: vi.fn(),
      getLeadAnalytics: vi.fn(),
      getLeadStats: vi.fn(),
    } as any;
    service = new FunnelService(mockPort);
  });

  it('passes a top-level-only update straight through without reading', async () => {
    await service.update('f-1', { title: 'Novo' });

    expect(mockPort.getRawForMerge).not.toHaveBeenCalled();
    expect(mockPort.update).toHaveBeenCalledWith('f-1', { title: 'Novo' });
  });

  it('merges a partial design into the stored one instead of replacing it', async () => {
    await service.update('f-1', { design: { colors: { primary: '#f00' } } });

    const sent = vi.mocked(mockPort.update).mock.calls[0][1];
    expect(sent.design).toEqual({
      ...stored.design,
      colors: { ...stored.design.colors, primary: '#f00' },
    });
  });

  it('merges settings from the unsanitized document so hidden fields survive', async () => {
    await service.update('f-1', { settings: { seo: { title: 'Novo SEO' } } });

    expect(mockPort.getById).not.toHaveBeenCalled();
    const sent = vi.mocked(mockPort.update).mock.calls[0][1];
    expect(sent.settings).toEqual({
      ...stored.settings,
      seo: { ...stored.settings.seo, title: 'Novo SEO' },
    });
  });

  it('replaces arrays and lets null clear a value', async () => {
    await service.update('f-1', {
      settings: { webhookIds: ['w-2'], customDomainId: null, postPurchaseUrl: null, pixelTokenIds: { facebook_ads: null } },
    });

    const sent = vi.mocked(mockPort.update).mock.calls[0][1];
    expect(sent.settings?.webhookIds).toEqual(['w-2']);
    expect(sent.settings).toHaveProperty('customDomainId', null);
    expect(sent.settings).toHaveProperty('postPurchaseUrl', null);
    expect(sent.settings?.pixelTokenIds).toEqual({ facebook_ads: null });
  });

  it('keeps steps as a whole replacement alongside a merged design', async () => {
    const steps = [{ id: 's1', title: 'Pergunta', order: 0, components: [], position: { x: 0, y: 0 } }];
    await service.update('f-1', { steps, design: { general: { spacing: 24 } } });

    const sent = vi.mocked(mockPort.update).mock.calls[0][1];
    expect(sent.steps).toBe(steps);
    expect(sent.design?.general).toEqual({ ...stored.design.general, spacing: 24 });
  });

  it('does not write when the funnel cannot be read', async () => {
    vi.mocked(mockPort.getRawForMerge).mockRejectedValue(new Error('404'));

    await expect(service.update('f-1', { design: { colors: { primary: '#f00' } } })).rejects.toThrow('404');
    expect(mockPort.update).not.toHaveBeenCalled();
  });
});
