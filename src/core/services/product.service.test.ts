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

  it('update re-sends the stored product so a one-field edit keeps the rest', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(stored as any);
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', { title: 'New' });

    const { uid: _uid, updatedAt: _updatedAt, ...rest } = stored;
    expect(mockPort.update).toHaveBeenCalledWith('p-1', { ...rest, title: 'New' });
  });

  it('update accepts empty input (all optional)', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(stored as any);
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

  it('update does not write when the product cannot be read', async () => {
    vi.mocked(mockPort.getById).mockRejectedValue(new Error('404'));

    await expect(service.update('p-1', { title: 'New' })).rejects.toThrow('404');
    expect(mockPort.update).not.toHaveBeenCalled();
  });
});
