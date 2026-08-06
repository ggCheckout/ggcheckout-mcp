import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutService } from './checkout.service.js';
import type { CheckoutPort } from '../ports/checkout.port.js';
import type { AuthPort } from '../ports/auth.port.js';
import type { ProductPort } from '../ports/product.port.js';
import { ApiError, AuthenticationError, RateLimitError, ValidationError } from '../../shared/errors.js';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let mockCheckoutPort: CheckoutPort;
  let mockAuthPort: AuthPort;
  let mockProductPort: ProductPort;

  beforeEach(() => {
    mockCheckoutPort = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      manageTags: vi.fn(),
    };
    mockAuthPort = {
      getMyBusinessId: vi.fn().mockResolvedValue('business-123'),
    };
    mockProductPort = {
      getById: vi.fn().mockResolvedValue({ uid: 'prod-1', title: 'Product' }),
    } as unknown as ProductPort;
    service = new CheckoutService(mockCheckoutPort, mockAuthPort, mockProductPort);
  });

  it('list fetches businessId from authPort then calls checkoutPort.list', async () => {
    vi.mocked(mockCheckoutPort.list).mockResolvedValue([]);
    await service.list();

    expect(mockAuthPort.getMyBusinessId).toHaveBeenCalled();
    expect(mockCheckoutPort.list).toHaveBeenCalledWith('business-123');
  });

  it('create injects uuidOwner from authPort and forwards the productId', async () => {
    vi.mocked(mockCheckoutPort.create).mockResolvedValue({ id: 'prod-1', title: 'Test', uuidOwner: 'business-123', price: 1000 } as any);

    await service.create({ title: 'Test', productId: 'prod-1', checkout: {}, paymentMethods: {}, price: 1000 });

    expect(mockCheckoutPort.create).toHaveBeenCalledWith(
      expect.objectContaining({ uuidOwner: 'business-123', productId: 'prod-1', title: 'Test' }),
    );
    // Never the historical typo, which the API rejects with 403.
    expect(vi.mocked(mockCheckoutPort.create).mock.calls[0][0]).not.toHaveProperty('uuidOwnwer');
  });

  it('create validates the owning product before posting', async () => {
    vi.mocked(mockProductPort.getById).mockRejectedValue(new ApiError(403, 'Não autorizado'));

    await expect(
      service.create({ title: 'Test', productId: 'ghost', checkout: {}, paymentMethods: {}, price: 1000 }),
    ).rejects.toThrow(ValidationError);

    expect(mockProductPort.getById).toHaveBeenCalledWith('ghost');
    expect(mockCheckoutPort.create).not.toHaveBeenCalled();
  });

  it('create rewrites the product 403 into an actionable message', async () => {
    vi.mocked(mockProductPort.getById).mockRejectedValue(new ApiError(403, 'Não autorizado'));

    await expect(
      service.create({ title: 'Test', productId: 'ghost', checkout: {}, paymentMethods: {}, price: 1000 }),
    ).rejects.toThrow(/Product ghost not found or not yours.*create_product/s);
  });

  it.each([
    ['authentication', new AuthenticationError('Invalid API key')],
    ['rate limit', new RateLimitError('Too many requests')],
  ])('create surfaces %s errors untouched instead of blaming the productId', async (_label, thrown) => {
    vi.mocked(mockProductPort.getById).mockRejectedValue(thrown);

    await expect(
      service.create({ title: 'Test', productId: 'prod-1', checkout: {}, paymentMethods: {}, price: 1000 }),
    ).rejects.toBe(thrown);

    expect(mockCheckoutPort.create).not.toHaveBeenCalled();
  });

  it('update merges current checkout with partial input', async () => {
    const currentCheckout = {
      id: 'ck-1',
      uid: 'uid-1',
      title: 'Original',
      uuidOwner: 'owner-1',
      price: 5000,
      paymentMethods: { pix: true },
      checkout: { theme: 'dark' },
      orderBumps: [],
      published: true,
      createBy: 'user',
    };
    vi.mocked(mockCheckoutPort.getById).mockResolvedValue(currentCheckout as any);
    vi.mocked(mockCheckoutPort.update).mockResolvedValue(currentCheckout as any);

    await service.update('ck-1', { title: 'Updated Title' });

    expect(mockCheckoutPort.getById).toHaveBeenCalledWith('ck-1');
    expect(mockCheckoutPort.update).toHaveBeenCalledWith(
      'ck-1',
      expect.objectContaining({
        title: 'Updated Title',
        uuidOwner: 'owner-1',
        price: 5000,
        paymentMethods: { pix: true },
      }),
    );
  });

  it('update preserves PIX fallback gateways format', async () => {
    const currentCheckout = {
      id: 'ck-1',
      uid: 'uid-1',
      title: 'Original',
      uuidOwner: 'owner-1',
      price: 5000,
      paymentMethods: {
        pix: {
          gateways: [
            { tokenId: 'tok-1', type: 'amplopay' },
            { tokenId: 'tok-2', type: 'efibank' },
          ],
        },
      },
      checkout: { theme: 'dark' },
      orderBumps: [],
      published: true,
      createBy: 'user',
    };
    vi.mocked(mockCheckoutPort.getById).mockResolvedValue(currentCheckout as any);
    vi.mocked(mockCheckoutPort.update).mockResolvedValue(currentCheckout as any);

    const newPixConfig = {
      gateways: [
        { tokenId: 'tok-3', type: 'mercadopago' },
        { tokenId: 'tok-1', type: 'amplopay' },
      ],
    };
    await service.update('ck-1', { paymentMethods: { pix: newPixConfig } });

    expect(mockCheckoutPort.update).toHaveBeenCalledWith(
      'ck-1',
      expect.objectContaining({
        paymentMethods: { pix: newPixConfig },
      }),
    );
  });

  it('delete fetches checkout first to get uuidOwner, then calls port.delete with both', async () => {
    vi.mocked(mockCheckoutPort.getById).mockResolvedValue({
      id: 'ck-1',
      title: 'Test',
      uuidOwner: 'owner-abc',
      price: 1000,
    } as any);
    vi.mocked(mockCheckoutPort.delete).mockResolvedValue(undefined);

    await service.delete('ck-1');

    expect(mockCheckoutPort.getById).toHaveBeenCalledWith('ck-1');
    expect(mockCheckoutPort.delete).toHaveBeenCalledWith('ck-1', 'owner-abc');
  });
});
