import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutService } from './checkout.service.js';
import type { CheckoutPort } from '../ports/checkout.port.js';
import type { AuthPort } from '../ports/auth.port.js';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let mockCheckoutPort: CheckoutPort;
  let mockAuthPort: AuthPort;

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
    service = new CheckoutService(mockCheckoutPort, mockAuthPort);
  });

  it('list fetches businessId from authPort then calls checkoutPort.list', async () => {
    vi.mocked(mockCheckoutPort.list).mockResolvedValue([]);
    await service.list();

    expect(mockAuthPort.getMyBusinessId).toHaveBeenCalled();
    expect(mockCheckoutPort.list).toHaveBeenCalledWith('business-123');
  });

  it('create injects uuidOwnwer from authPort', async () => {
    vi.mocked(mockCheckoutPort.create).mockResolvedValue({ id: 'ck-1', title: 'Test', uuidOwnwer: 'business-123', price: 1000 } as any);

    await service.create({ title: 'Test', id: 'slug', checkout: {}, paymentMethods: {}, price: 1000 });

    expect(mockCheckoutPort.create).toHaveBeenCalledWith(
      expect.objectContaining({ uuidOwnwer: 'business-123', title: 'Test' }),
    );
  });

  it('update merges current checkout with partial input', async () => {
    const currentCheckout = {
      id: 'ck-1',
      uid: 'uid-1',
      title: 'Original',
      uuidOwnwer: 'owner-1',
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
        uuidOwnwer: 'owner-1',
        price: 5000,
        paymentMethods: { pix: true },
      }),
    );
  });

  it('delete fetches checkout first to get uuidOwnwer, then calls port.delete with both', async () => {
    vi.mocked(mockCheckoutPort.getById).mockResolvedValue({
      id: 'ck-1',
      title: 'Test',
      uuidOwnwer: 'owner-abc',
      price: 1000,
    } as any);
    vi.mocked(mockCheckoutPort.delete).mockResolvedValue(undefined);

    await service.delete('ck-1');

    expect(mockCheckoutPort.getById).toHaveBeenCalledWith('ck-1');
    expect(mockCheckoutPort.delete).toHaveBeenCalledWith('ck-1', 'owner-abc');
  });
});
