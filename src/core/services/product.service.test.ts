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

  it('update validates and converts price when provided', async () => {
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', { price: '29,90' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', expect.objectContaining({ price: 2990 }));
  });

  it('update accepts empty input (all optional)', async () => {
    vi.mocked(mockPort.update).mockResolvedValue(undefined);

    await service.update('p-1', {});
    expect(mockPort.update).toHaveBeenCalledWith('p-1', expect.any(Object));
  });
});
