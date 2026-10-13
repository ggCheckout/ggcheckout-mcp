import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductApiAdapter } from './product.api.js';
import type { HttpClient } from './http-client.js';
import type { AuthPort } from '../../core/ports/auth.port.js';

function createMockHttp(): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as any;
}

describe('ProductApiAdapter', () => {
  let adapter: ProductApiAdapter;
  let http: ReturnType<typeof createMockHttp>;
  let authPort: AuthPort;

  beforeEach(() => {
    http = createMockHttp();
    authPort = { getMyBusinessId: vi.fn().mockResolvedValue('user-1') };
    adapter = new ProductApiAdapter(http, authPort);
  });

  it('list calls GET /api/product-delivery', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await adapter.list();
    expect(http.get).toHaveBeenCalledWith('/api/product-delivery');
  });

  it('getById calls GET /api/product-delivery/{id}', async () => {
    vi.mocked(http.get).mockResolvedValue({ uid: 'p1' });
    await adapter.getById('p1');
    expect(http.get).toHaveBeenCalledWith('/api/product-delivery/p1');
  });

  it('create returns { success, productId } from API response', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, productId: 'new-id' });
    const result = await adapter.create({ title: 'Test', price: 1990 });
    expect(http.post).toHaveBeenCalledWith('/api/product-delivery', { title: 'Test', price: 1990 });
    expect(result).toEqual({ success: true, productId: 'new-id' });
  });

  it('update calls PATCH with id and uuidOwner in payload', async () => {
    vi.mocked(http.patch).mockResolvedValue({});
    await adapter.update('p1', { title: 'Updated' });
    expect(authPort.getMyBusinessId).toHaveBeenCalled();
    expect(http.patch).toHaveBeenCalledWith('/api/product-delivery/p1', { title: 'Updated', id: 'p1', uuidOwner: 'user-1' });
  });

  it('listUpsells unwraps the { success, upsells, count } envelope', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, upsells: [{ uid: 'u1' }], count: 1 });
    expect(await adapter.listUpsells('p1')).toEqual([{ uid: 'u1' }]);
    expect(http.get).toHaveBeenCalledWith('/api/product-delivery/p1/upsells/list');
  });

  it('listUpsells still accepts a bare array', async () => {
    vi.mocked(http.get).mockResolvedValue([{ uid: 'u1' }]);
    expect(await adapter.listUpsells('p1')).toEqual([{ uid: 'u1' }]);
  });

  it('listDownsells returns an empty list when the response has no downsells', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true });
    expect(await adapter.listDownsells('p1')).toEqual({ downsells: [], count: 0 });
  });

  it('createUpsell POSTs to /upsells/{upsellId} with { upsell: input } body', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, upsell: { uid: 'u1' } });
    const input = { upsellProductId: 'prod-2', title: 'Upsell Offer' };
    const result = await adapter.createUpsell('p1', 'u1', input as any);

    expect(http.post).toHaveBeenCalledWith(
      '/api/product-delivery/p1/upsells/u1',
      { upsell: input },
    );
    expect(result).toEqual({ uid: 'u1' });
  });

  it('deleteUpsell calls DELETE /upsells/{upsellId}', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.deleteUpsell('p1', 'u1');
    expect(http.delete).toHaveBeenCalledWith('/api/product-delivery/p1/upsells/u1');
  });

  // It used to PATCH `/upsells` with whole objects. That route replaces the legacy upsell array
  // instead of reordering, and it does not exist for a product stored in Postgres, where it came
  // back as an opaque 502.
  it('reorderUpsells POSTs the ids to /upsells/reorder and returns the stored order', async () => {
    vi.mocked(http.post).mockResolvedValue({
      success: true,
      message: 'Upsells reordenados com sucesso.',
      newOrder: [{ id: 'u2', order: 1 }, { id: 'u1', order: 2 }],
    });
    const result = await adapter.reorderUpsells('p1', ['u2', 'u1']);
    expect(http.post).toHaveBeenCalledWith(
      '/api/product-delivery/p1/upsells/reorder',
      { upsellIds: ['u2', 'u1'] },
    );
    expect(result).toEqual([{ id: 'u2', order: 1 }, { id: 'u1', order: 2 }]);
    expect(http.patch).not.toHaveBeenCalled();
  });

  it('createDownsell POSTs to /downsells/{downsellId} with { downsell: input } body', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, downsell: { uid: 'd1' } });
    const input = { downsellProductId: 'prod-3', title: 'Downsell', price: 990 };
    const result = await adapter.createDownsell('p1', 'd1', input as any);

    expect(http.post).toHaveBeenCalledWith(
      '/api/product-delivery/p1/downsells/d1',
      { downsell: input },
    );
    expect(result).toEqual({ uid: 'd1' });
  });

  it('listDownsells GETs /downsells/list and returns { downsells, count }', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, downsells: [], count: 0 });
    const result = await adapter.listDownsells('p1');
    expect(http.get).toHaveBeenCalledWith('/api/product-delivery/p1/downsells/list');
    expect(result).toEqual({ downsells: [], count: 0 });
  });

  it('manageTags PATCHes /tags with { name, color }[] format', async () => {
    const tags = [{ name: 'vip', color: '#FF0000' }];
    vi.mocked(http.patch).mockResolvedValue({ message: 'ok', tags });
    const result = await adapter.manageTags('p1', tags);

    expect(http.patch).toHaveBeenCalledWith('/api/product-delivery/p1/tags', { tags });
    expect(result.tags).toEqual(tags);
  });

  // `/api/products/**` does not exist in the API at all — these two called a route that never
  // answered. The real flow is presign, PUT the bytes elsewhere, confirm, then link.
  it('presignDeliverable POSTs to /api/deliverables/presigned-upload with the productId', async () => {
    vi.mocked(http.post).mockResolvedValue({
      success: true,
      data: { uploadUrl: 'https://r2/put?sig', filePath: 'deliverables/s1/p1/uuid-a.pdf', fields: { 'Content-Type': 'application/pdf' } },
    });
    const result = await adapter.presignDeliverable('p1', {
      fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 1024,
    });
    expect(http.post).toHaveBeenCalledWith('/api/deliverables/presigned-upload', {
      fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 1024, productId: 'p1',
    });
    expect(result.uploadUrl).toBe('https://r2/put?sig');
    expect(result.filePath).toBe('deliverables/s1/p1/uuid-a.pdf');
  });

  // Confirming is all this route does: nothing under /api/deliverables links a file to a product,
  // so the service makes the product write separately.
  it('completeDeliverableUpload confirms the upload and returns the stored file', async () => {
    const stored = { filePath: 'deliverables/s1/p1/uuid-a.pdf', fileName: 'a.pdf', fileSize: 1024, fileType: 'application/pdf' };
    vi.mocked(http.post).mockResolvedValue({ success: true, data: stored });

    const result = await adapter.completeDeliverableUpload(stored);

    expect(http.post).toHaveBeenCalledWith('/api/deliverables/complete-upload', stored);
    expect(http.patch).not.toHaveBeenCalled();
    expect(result).toEqual(stored);
  });

  it('deleteDeliverableFile DELETEs the bytes by their encoded path', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.deleteDeliverableFile('deliverables/s1/p1/uuid-a.pdf');
    expect(http.delete).toHaveBeenCalledWith(
      '/api/deliverables/upload?filePath=deliverables%2Fs1%2Fp1%2Fuuid-a.pdf',
    );
  });

  it('setOfferExternalFlow PUTs only the routing and returns it as stored', async () => {
    const flow = {
      onAccept: { kind: 'thank_you' }, onDecline: { kind: 'thank_you' },
      acceptLabel: 'Sim', declineLabel: 'Não', buttonColor: '#22C55E',
    } as const;
    vi.mocked(http.put).mockResolvedValue({ success: true, externalFlow: flow });

    const result = await adapter.setOfferExternalFlow('p1', 'downsell', 'd1', flow);

    expect(http.put).toHaveBeenCalledWith(
      '/api/product-delivery/p1/downsells/d1/external-flow',
      { externalFlow: flow },
    );
    expect(result).toEqual(flow);
  });

  it('reorderDownsells POSTs the ids to /downsells/reorder and returns the stored order', async () => {
    vi.mocked(http.post).mockResolvedValue({
      success: true,
      message: 'ok',
      newOrder: [{ id: 'd2', order: 1 }, { id: 'd1', order: 2 }],
    });
    const result = await adapter.reorderDownsells('p1', ['d2', 'd1']);
    expect(http.post).toHaveBeenCalledWith(
      '/api/product-delivery/p1/downsells/reorder',
      { downsellIds: ['d2', 'd1'] },
    );
    expect(result).toEqual([{ id: 'd2', order: 1 }, { id: 'd1', order: 2 }]);
  });
});
