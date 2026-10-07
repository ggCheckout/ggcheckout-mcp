import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from './product.service.js';
import type { ProductPort } from '../ports/product.port.js';

describe('ProductService', () => {
  let service: ProductService;
  let mockPort: ProductPort;

  beforeEach(() => {
    mockPort = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      uploadDeliverable: vi.fn(),
      deleteDeliverable: vi.fn(),
      listUpsells: vi.fn(),
      createUpsell: vi.fn(),
      deleteUpsell: vi.fn(),
      reorderUpsells: vi.fn(),
      listDownsells: vi.fn(),
      createDownsell: vi.fn(),
      deleteDownsell: vi.fn(),
      reorderDownsells: vi.fn(),
      manageTags: vi.fn(),
    };
    service = new ProductService(mockPort);
  });

  it('create validates input and converts price to cents before calling port', async () => {
    vi.mocked(mockPort.create).mockResolvedValue({ success: true, productId: 'p-1' });

    const result = await service.create({
      title: 'Test Product',
      description: 'A description',
      price: 49.90,
    });

    expect(mockPort.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Product',
        price: 4990,
      }),
    );
    expect(result.productId).toBe('p-1');
  });

  it('create throws on invalid input (missing title)', async () => {
    await expect(service.create({ description: 'test', price: 10 })).rejects.toThrow();
    expect(mockPort.create).not.toHaveBeenCalled();
  });

  const stored = {
    uid: 'p-1',
    title: 'Old',
    description: 'desc',
    price: 1000,
    discount: 0,
    url: 'https://pay.example.com/x',
    deliverableFile: { fileName: 'a.png' },
    stockLines: [],
    createdAt: '2025-10-31T06:47:51.043Z',
    updatedAt: '2025-12-27T00:21:07.655+00:00',
  };

  it('update validates and converts price when provided', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(stored as any);
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', { price: '29,90' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', expect.objectContaining({ price: 2990 }));
  });

  // The PATCH preserves by absence, but the deliverable check reads the BODY: a title-only edit
  // of a product that has a url is still refused. So the delta travels with one carried-over term.
  it('update carries the stored url so a title-only edit is not refused', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...stored, url: 'https://x.com/a' } as any);
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', { title: 'New' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New', url: 'https://x.com/a' });
  });

  it('update sends the bare delta when the edit already carries a deliverable term', async () => {
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', { title: 'New', url: 'https://x.com/b' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New', url: 'https://x.com/b' });
    expect(mockPort.getById).not.toHaveBeenCalled();
  });

  it('update never forwards the derived read-only fields of the new storage', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...stored, url: 'https://x.com/a', hasDeliverableFile: true, stockLineCount: 12,
    } as any);
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', { title: 'New' });

    const sent = vi.mocked(mockPort.update).mock.calls[0][1] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('hasDeliverableFile');
    expect(sent).not.toHaveProperty('stockLineCount');
  });

  it('update uses an exemption flag instead of a deliverable when the product is physical', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...stored, url: undefined, isPhysicalProduct: true,
    } as any);
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', { title: 'New' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New', isPhysicalProduct: true });
  });

  // Nothing can be carried over: the file and the stock lines are not readable through the API,
  // so the save would be refused for lacking a deliverable. Say that instead of sending a doomed
  // request and surfacing a bare 400.
  it('update refuses with an explanation when the only deliverable is a file', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...stored, url: undefined, deliverableUrl: undefined, whatsappUrl: undefined,
      hasDeliverableFile: true,
    } as any);

    await expect(service.update('p-1', { title: 'New' })).rejects.toThrow(/dashboard/);
    expect(mockPort.update).not.toHaveBeenCalled();
  });

  it('update refuses with an explanation when the only deliverable is stock', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...stored, url: undefined, deliverableUrl: undefined, whatsappUrl: undefined,
      stockLineCount: 12,
    } as any);

    await expect(service.update('p-1', { title: 'New' })).rejects.toThrow(/stock lines/);
    expect(mockPort.update).not.toHaveBeenCalled();
  });

  it('update accepts empty input (all optional)', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...stored, url: 'https://x.com/a' } as any);
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', {});
    expect(mockPort.update).toHaveBeenCalledWith('p-1', expect.any(Object));
  });

  it('list hides soft-deleted products', async () => {
    vi.mocked(mockPort.list).mockResolvedValue([
      { uid: 'a', title: 'live', deleted: false },
      { uid: 'b', title: 'gone', deleted: true },
      { uid: 'c', title: 'legacy' },
    ] as any);

    const products = await service.list();
    expect(products.map((p) => p.uid)).toEqual(['a', 'c']);
  });

  it('createUpsell writes the editor shape and appends after existing upsells', async () => {
    vi.mocked(mockPort.listUpsells).mockResolvedValue([{}, {}] as any);
    vi.mocked(mockPort.createUpsell).mockResolvedValue({} as any);

    await service.createUpsell('p-1', 'u-1', { upsellProductId: 'p-2', title: 'Oferta' });

    expect(mockPort.createUpsell).toHaveBeenCalledWith('p-1', 'u-1', {
      upsellProductId: 'p-2',
      title: 'Oferta',
      uid: 'u-1',
      id: 'u-1',
      upsellProductIds: ['p-2'],
      order: 3,
    });
  });

  it('createUpsell goes past the highest order when a deletion left a gap', async () => {
    vi.mocked(mockPort.listUpsells).mockResolvedValue([{ order: 1 }, { order: 3 }] as any);
    vi.mocked(mockPort.createUpsell).mockResolvedValue({} as any);

    await service.createUpsell('p-1', 'u-1', { upsellProductId: 'p-2', title: 'Oferta' });

    expect(mockPort.createUpsell).toHaveBeenCalledWith('p-1', 'u-1', expect.objectContaining({ order: 4 }));
  });

  it('createUpsell starts at 1 and follows a dense list', async () => {
    vi.mocked(mockPort.createUpsell).mockResolvedValue({} as any);

    vi.mocked(mockPort.listUpsells).mockResolvedValueOnce([]);
    await service.createUpsell('p-1', 'u-1', { upsellProductId: 'p-2', title: 'Oferta' });
    vi.mocked(mockPort.listUpsells).mockResolvedValueOnce([{ order: 1 }, { order: 2 }] as any);
    await service.createUpsell('p-1', 'u-2', { upsellProductId: 'p-2', title: 'Oferta' });

    const orders = vi.mocked(mockPort.createUpsell).mock.calls.map((call) => call[2].order);
    expect(orders).toEqual([1, 3]);
  });

  it('createUpsell keeps an explicit order without listing', async () => {
    vi.mocked(mockPort.createUpsell).mockResolvedValue({} as any);

    await service.createUpsell('p-1', 'u-1', { upsellProductId: 'p-2', title: 'Oferta', order: 1 });

    expect(mockPort.listUpsells).not.toHaveBeenCalled();
    expect(mockPort.createUpsell).toHaveBeenCalledWith('p-1', 'u-1', expect.objectContaining({ order: 1 }));
  });

  it('createDownsell writes the editor shape and appends after existing downsells', async () => {
    vi.mocked(mockPort.listDownsells).mockResolvedValue({ downsells: [{}] as any, count: 1 });
    vi.mocked(mockPort.createDownsell).mockResolvedValue({} as any);

    await service.createDownsell('p-1', 'd-1', { downsellProductId: 'p-3', title: 'Última chance', price: 990 });

    expect(mockPort.createDownsell).toHaveBeenCalledWith('p-1', 'd-1', expect.objectContaining({
      uid: 'd-1',
      id: 'd-1',
      downsellProductIds: ['p-3'],
      order: 2,
    }));
  });

  it('update surfaces the write failure as-is', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...stored, url: 'https://x.com/a' } as any);
    vi.mocked(mockPort.update).mockRejectedValue(new Error('404'));

    await expect(service.update('p-1', { title: 'New' })).rejects.toThrow('404');
  });
});
