import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreService } from './store.service.js';
import type { StorePort } from '../ports/store.port.js';

describe('StoreService.updateLayout', () => {
  let service: StoreService;
  let mockPort: StorePort;

  const stored = {
    id: 'draft',
    storeId: 's-1',
    version: 3,
    status: 'draft',
    createdAt: '2026-09-01T00:00:00Z',
    theme: { colors: { primary: '#000', background: '#fff' }, fontFamily: 'Inter' },
    blocks: [{ id: 'b1', type: 'hero' }],
    pageSettings: { title: 'Loja', favicon: 'x.png' },
  };

  beforeEach(() => {
    mockPort = {
      getLayout: vi.fn().mockResolvedValue({ layout: structuredClone(stored), isNewStore: false }),
      saveLayoutDraft: vi.fn().mockResolvedValue(undefined),
    } as any;
    service = new StoreService(mockPort);
  });

  it('merges theme and sends only the four writable keys', async () => {
    await service.updateLayout('s-1', { theme: { colors: { primary: '#f00' } } });

    expect(mockPort.saveLayoutDraft).toHaveBeenCalledWith('s-1', {
      theme: { colors: { primary: '#f00', background: '#fff' }, fontFamily: 'Inter' },
      blocks: stored.blocks,
      pageSettings: stored.pageSettings,
    });
  });

  it('replaces blocks whole and merges pageSettings', async () => {
    const blocks = [{ id: 'b2', type: 'products' }];
    await service.updateLayout('s-1', { blocks, pageSettings: { title: 'Nova' } });

    const sent = vi.mocked(mockPort.saveLayoutDraft).mock.calls[0][1];
    expect(sent.blocks).toBe(blocks);
    expect(sent.pageSettings).toEqual({ title: 'Nova', favicon: 'x.png' });
  });

  it('requires theme and blocks on the first save of a new store', async () => {
    vi.mocked(mockPort.getLayout).mockResolvedValue({ layout: null, isNewStore: true });

    await expect(service.updateLayout('s-1', { theme: { fontFamily: 'Inter' } })).rejects.toThrow(/theme and blocks/);
    expect(mockPort.saveLayoutDraft).not.toHaveBeenCalled();
  });

  it('updateStoreReview refuses a partial content edit before calling the API', async () => {
    mockPort.updateStoreReview = vi.fn();

    await expect(service.updateStoreReview('s-1', 'f-1', { rating: 5 })).rejects.toThrow(/together/);
    await expect(service.updateStoreReview('s-1', 'f-1', {})).rejects.toThrow(/approved/);
    expect(mockPort.updateStoreReview).not.toHaveBeenCalled();

    await service.updateStoreReview('s-1', 'f-1', { approved: true });
    expect(mockPort.updateStoreReview).toHaveBeenCalledWith('s-1', 'f-1', { approved: true });
  });

  it('updateStore refuses an empty patch', async () => {
    mockPort.updateStore = vi.fn();
    await expect(service.updateStore('s-1', {})).rejects.toThrow(/at least one field/);
    expect(mockPort.updateStore).not.toHaveBeenCalled();
  });

  it('accepts a full first save of a new store', async () => {
    vi.mocked(mockPort.getLayout).mockResolvedValue({ layout: null, isNewStore: true });

    await service.updateLayout('s-1', { theme: { fontFamily: 'Inter' }, blocks: [] });
    expect(mockPort.saveLayoutDraft).toHaveBeenCalledWith('s-1', { theme: { fontFamily: 'Inter' }, blocks: [] });
  });
});
