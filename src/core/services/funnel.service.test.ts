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

  it('names each analytics step by its title in the funnel', async () => {
    mockPort.getLeadAnalytics = vi.fn().mockResolvedValue({
      steps: [
        { stepId: 's-1', visitors: 10, exits: 4, dropOffRate: 40 },
        { stepId: 's-2', visitors: 6, exits: 0, dropOffRate: 0 },
      ],
      totalVisitors: 10, totalCompleted: 6, overallConversionRate: 60,
    });
    mockPort.getById = vi.fn().mockResolvedValue({ id: 'f-1', title: 'Quiz', steps: [{ id: 's-1', title: 'Boas-vindas' }, { id: 's-2', title: '' }] });

    const analytics = await service.getLeadAnalytics('f-1');

    expect(analytics.funnelTitle).toBe('Quiz');
    expect(analytics.steps.map((s) => s.title)).toEqual(['Boas-vindas', 'Etapa 2']);
    expect(analytics.overallConversionRate).toBe(60);
  });

  // The titles only enrich the report: a funnel that cannot be read must not take it down.
  it('still answers the analytics with generic titles when the funnel cannot be read', async () => {
    mockPort.getLeadAnalytics = vi.fn().mockResolvedValue({
      steps: [{ stepId: 's-1', visitors: 10, exits: 4, dropOffRate: 40 }],
      totalVisitors: 10, totalCompleted: 6, overallConversionRate: 60,
    });
    mockPort.getById = vi.fn().mockRejectedValue(new Error('funnel down'));

    const analytics = await service.getLeadAnalytics('f-1');

    expect(analytics.funnelTitle).toBeUndefined();
    expect(analytics.steps.map((s) => s.title)).toEqual(['Etapa 1']);
  });

  it('fails when the analytics cannot be read', async () => {
    mockPort.getLeadAnalytics = vi.fn().mockRejectedValue(new Error('analytics down'));
    mockPort.getById = vi.fn().mockResolvedValue({ id: 'f-1', title: 'Quiz', steps: [] });

    await expect(service.getLeadAnalytics('f-1')).rejects.toThrow('analytics down');
  });
});
