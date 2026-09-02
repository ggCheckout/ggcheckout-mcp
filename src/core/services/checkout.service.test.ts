import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutService } from './checkout.service.js';
import type { CheckoutPort } from '../ports/checkout.port.js';
import type { AuthPort } from '../ports/auth.port.js';
import type { ProductPort } from '../ports/product.port.js';
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../shared/errors.js';

const baseInput = { title: 'Test', productId: 'prod-1', checkout: {}, paymentMethods: {}, price: 10 };

describe('CheckoutService', () => {
  let service: CheckoutService;
  let mockCheckoutPort: CheckoutPort;
  let mockAuthPort: AuthPort;
  let mockProductPort: ProductPort;

  beforeEach(() => {
    mockCheckoutPort = {
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
      manageTags: vi.fn(),
    };
    mockAuthPort = {
      getMyBusinessId: vi.fn().mockResolvedValue('business-123'),
    };
    mockProductPort = {
      getById: vi.fn().mockResolvedValue({
        uid: 'prod-1', title: 'Product', description: 'Desc', price: 4990, imageUrl: 'https://img/1.png',
      }),
    } as unknown as ProductPort;
    service = new CheckoutService(mockCheckoutPort, mockAuthPort, mockProductPort);
  });

  it('list fetches businessId from authPort then calls checkoutPort.list', async () => {
    await service.list();

    expect(mockAuthPort.getMyBusinessId).toHaveBeenCalled();
    expect(mockCheckoutPort.list).toHaveBeenCalledWith('business-123');
  });

  it('create injects uuidOwner from authPort and forwards the productId', async () => {
    await service.create(baseInput);

    expect(mockCheckoutPort.create).toHaveBeenCalledWith(
      expect.objectContaining({ uuidOwner: 'business-123', productId: 'prod-1', title: 'Test' }),
    );
  });

  it('create converts the price from reais to the cents the API stores', async () => {
    await service.create({ ...baseInput, price: 99.9 });

    expect(mockCheckoutPort.create).toHaveBeenCalledWith(expect.objectContaining({ price: 9990 }));
  });

  it('create serializes order bumps into the JSON snapshots the checkout page parses', async () => {
    await service.create({ ...baseInput, orderBumps: ['prod-1'] });

    const payload = vi.mocked(mockCheckoutPort.create).mock.calls[0][0];
    expect(JSON.parse(payload.orderBumps?.[0] as string)).toEqual({
      uid: 'prod-1',
      id: 'prod-1',
      title: 'Product',
      description: 'Desc',
      price: 4990,
      imageUrl: 'https://img/1.png',
      currency: 'BRL',
    });
  });

  it('create validates the owning product before posting', async () => {
    vi.mocked(mockProductPort.getById).mockRejectedValue(new ApiError(403, 'Nao autorizado'));

    await expect(service.create({ ...baseInput, productId: 'ghost' })).rejects.toThrow(NotFoundError);

    expect(mockProductPort.getById).toHaveBeenCalledWith('ghost');
    expect(mockCheckoutPort.create).not.toHaveBeenCalled();
  });

  it('create rewrites the product 403 into an actionable message', async () => {
    vi.mocked(mockProductPort.getById).mockRejectedValue(new ApiError(403, 'Nao autorizado'));

    await expect(
      service.create({ ...baseInput, productId: 'ghost' }),
    ).rejects.toThrow(/Product ghost not found.*create_product/s);
  });

  it.each([
    ['authentication', new AuthenticationError('Invalid API key')],
    ['rate limit', new RateLimitError('Too many requests')],
    ['network', new NetworkError('Cannot connect to GG Checkout API')],
    ['server', new ApiError(502, 'Bad gateway')],
  ])('create surfaces %s errors untouched instead of blaming the productId', async (_label, thrown) => {
    vi.mocked(mockProductPort.getById).mockRejectedValue(thrown);

    await expect(service.create(baseInput)).rejects.toBe(thrown);

    expect(mockCheckoutPort.create).not.toHaveBeenCalled();
  });

  describe('update', () => {
    const currentCheckout = {
      productId: 'prod-1',
      uid: 'uid-1',
      title: 'Original',
      uuidOwner: 'owner-1',
      price: 5000,
      paymentMethods: { pix: true },
      checkout: { theme: 'dark' },
      orderBumps: [],
      published: true,
      createBy: 'user',
      url: 'https://pay.example/offer',
      fields: { haveEmail: true, haveCpf: true },
      sellerName: 'Loja',
      currency: 'USD',
      internationalizeCheckout: true,
    };

    beforeEach(() => {
      vi.mocked(mockCheckoutPort.getById).mockResolvedValue(currentCheckout as any);
      vi.mocked(mockCheckoutPort.update).mockResolvedValue(currentCheckout as any);
    });

    it('merges current checkout with partial input', async () => {
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

    it('resends every field the API resets when it is absent from the body', async () => {
      await service.update('ck-1', { title: 'Updated Title' });

      expect(mockCheckoutPort.update).toHaveBeenCalledWith(
        'ck-1',
        expect.objectContaining({
          url: 'https://pay.example/offer',
          fields: { haveEmail: true, haveCpf: true },
          sellerName: 'Loja',
          currency: 'USD',
          internationalizeCheckout: true,
        }),
      );
    });

    it('converts an updated price from reais to cents', async () => {
      await service.update('ck-1', { price: 12.5 });

      expect(mockCheckoutPort.update).toHaveBeenCalledWith('ck-1', expect.objectContaining({ price: 1250 }));
    });

    it('refuses a checkout with no product pointer instead of letting the API 400', async () => {
      vi.mocked(mockCheckoutPort.getById).mockResolvedValue({ ...currentCheckout, productId: undefined } as any);

      await expect(service.update('ck-1', { title: 'X' })).rejects.toThrow(ValidationError);
      expect(mockCheckoutPort.update).not.toHaveBeenCalled();
    });

    it('preserves PIX fallback gateways format', async () => {
      const newPixConfig = {
        gateways: [
          { tokenId: 'tok-3', type: 'mercadopago' },
          { tokenId: 'tok-1', type: 'amplopay' },
        ],
      };
      await service.update('ck-1', { paymentMethods: { pix: newPixConfig } });

      expect(mockCheckoutPort.update).toHaveBeenCalledWith(
        'ck-1',
        expect.objectContaining({ paymentMethods: { pix: newPixConfig } }),
      );
    });
  });

  it('delete calls port.delete without a preliminary read', async () => {
    await service.delete('ck-1');

    expect(mockCheckoutPort.getById).not.toHaveBeenCalled();
    expect(mockCheckoutPort.delete).toHaveBeenCalledWith('ck-1');
  });
});
