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
      presignDeliverable: vi.fn(),
      completeDeliverableUpload: vi.fn(),
      deleteDeliverableFile: vi.fn(),
      listUpsells: vi.fn(),
      createUpsell: vi.fn(),
      deleteUpsell: vi.fn(),
      reorderUpsells: vi.fn(),
      listDownsells: vi.fn(),
      createDownsell: vi.fn(),
      deleteDownsell: vi.fn(),
      reorderDownsells: vi.fn(),
      saveOffer: vi.fn(),
      manageTags: vi.fn(),
    };
    service = new ProductService(mockPort, 'https://app.test');
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

  // What the read answers on the new storage: the file and the stock lines collapsed into two
  // derived flags, and an omitted key on the write keeps what is stored.
  const storedV2 = {
    uid: 'p-1',
    title: 'Old',
    description: 'desc',
    price: 1000,
    discount: 0,
    url: 'https://pay.example.com/x',
    hasDeliverableFile: false,
    stockLineCount: 0,
    createdAt: '2025-10-31T06:47:51.043Z',
    updatedAt: '2025-12-27T00:21:07.655+00:00',
  };

  // What the read answers on the old storage: the stored document as it is, file and stock lines
  // included. Its write puts a default into every key the body omits.
  const storedV1 = {
    uid: 'p-1',
    title: 'Old',
    price: 1000,
    url: '',
    imageUrl: 'https://cdn.example.com/cover.png',
    deliverableFile: { filePath: 'deliverables/s1/p-1/a.pdf', fileName: 'a.pdf' },
    stockLines: [],
    stockQuantity: 7,
    membersAreaEnabled: false,
    createdAt: '2025-10-31T06:47:51.043Z',
    updatedAt: '2025-12-27T00:21:07.655+00:00',
  };

  const sentBody = () => vi.mocked(mockPort.update).mock.calls[0][1] as Record<string, unknown>;

  it('update validates and converts price when provided', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(storedV2 as any);

    await service.update('p-1', { price: '29,90' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', expect.objectContaining({ price: 2990 }));
  });

  // The PATCH preserves by absence, but the deliverable check reads the BODY: a title-only edit
  // of a product that has a url is still refused. So the delta travels with one carried-over term.
  it('update carries the stored url so a title-only edit is not refused', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, url: 'https://x.com/a' } as any);

    await service.update('p-1', { title: 'New' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New', url: 'https://x.com/a' });
  });

  it('update sends the bare delta when the edit already carries a deliverable term', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(storedV2 as any);

    await service.update('p-1', { title: 'New', url: 'https://x.com/b' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New', url: 'https://x.com/b' });
  });

  it('update never forwards the derived read-only fields of the new storage', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...storedV2, hasDeliverableFile: true, stockLineCount: 12,
    } as any);

    await service.update('p-1', { title: 'New' });

    expect(sentBody()).not.toHaveProperty('hasDeliverableFile');
    expect(sentBody()).not.toHaveProperty('stockLineCount');
  });

  it('update uses an exemption flag instead of a deliverable when the product is physical', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...storedV2, url: undefined, isPhysicalProduct: true,
    } as any);

    await service.update('p-1', { title: 'New' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New', isPhysicalProduct: true });
  });

  // Nothing can be carried over: the file and the stock lines are not readable through the API,
  // so the save would be refused for lacking a deliverable. Say that instead of sending a doomed
  // request and surfacing a bare 400.
  it('update refuses with an explanation when the only deliverable is a file', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...storedV2, url: undefined, hasDeliverableFile: true,
    } as any);

    await expect(service.update('p-1', { title: 'New' })).rejects.toThrow(/dashboard/);
    expect(mockPort.update).not.toHaveBeenCalled();
  });

  it('update refuses with an explanation when the only deliverable is stock', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...storedV2, url: undefined, stockLineCount: 12,
    } as any);

    await expect(service.update('p-1', { title: 'New' })).rejects.toThrow(/stock lines/);
    expect(mockPort.update).not.toHaveBeenCalled();
  });

  // The change wins over anything carried: carrying the stored flag back would undo the edit with a 200.
  it('update never re-sends an exemption the change turns off', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...storedV2, url: 'https://x.com/a', isPhysicalProduct: true,
    } as any);

    await service.update('p-1', { isPhysicalProduct: false });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { isPhysicalProduct: false, url: 'https://x.com/a' });
  });

  it('update carries a link before an exemption', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...storedV2, url: 'https://x.com/a', skipDeliveryEmail: true,
    } as any);

    await service.update('p-1', { title: 'New' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New', url: 'https://x.com/a' });
  });

  // `membersAreaEnabled: true` makes the core blank the delivery fields; the API resolves an active
  // area by itself.
  it('update never injects membersAreaEnabled', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, url: '', membersAreaEnabled: true } as any);

    await service.update('p-1', { title: 'New' });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { title: 'New' });
  });

  it('update accepts empty input (all optional)', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(storedV2 as any);

    await service.update('p-1', {});
    expect(mockPort.update).toHaveBeenCalledWith('p-1', expect.any(Object));
  });

  // The old storage writes a default into every omitted key, so a delta would blank the image,
  // drop the file and switch the members area off, all with a 200. Its read carries the whole
  // document, file included, so the whole document goes back with the edit on top.
  it('update re-sends the whole document on the old storage, file included', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(storedV1 as any);

    await service.update('p-1', { title: 'New' });

    expect(sentBody()).toMatchObject({
      title: 'New',
      imageUrl: storedV1.imageUrl,
      deliverableFile: storedV1.deliverableFile,
      membersAreaEnabled: false,
    });
  });

  it('update on the old storage leaves out the live stock counter and the server stamps', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(storedV1 as any);

    await service.update('p-1', { title: 'New' });

    expect(sentBody()).not.toHaveProperty('stockQuantity');
    expect(sentBody()).not.toHaveProperty('uid');
    expect(sentBody()).not.toHaveProperty('updatedAt');
  });

  it('update on the old storage still sends a stock quantity the caller set', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(storedV1 as any);

    await service.update('p-1', { stockQuantity: 3 });

    expect(sentBody()).toMatchObject({ stockQuantity: 3 });
  });

  it('attachDeliverable confirms the upload and links it, keeping the stored link', async () => {
    const file = { filePath: 'deliverables/s1/p-1/b.pdf', fileName: 'b.pdf', fileSize: 10, fileType: 'application/pdf' };
    vi.mocked(mockPort.completeDeliverableUpload).mockResolvedValue(file);
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, deliverableUrl: 'https://x.com/d' } as any);

    expect(await service.attachDeliverable('p-1', file)).toEqual(file);

    expect(mockPort.update).toHaveBeenCalledWith('p-1', { deliverableFile: file, deliverableFileId: '' });
  });

  it('attachDeliverable on the old storage carries the rest of the document', async () => {
    const file = { filePath: 'deliverables/s1/p-1/b.pdf', fileName: 'b.pdf', fileSize: 10, fileType: 'application/pdf' };
    vi.mocked(mockPort.completeDeliverableUpload).mockResolvedValue(file);
    vi.mocked(mockPort.getById).mockResolvedValue(storedV1 as any);

    await service.attachDeliverable('p-1', file);

    expect(sentBody()).toMatchObject({ deliverableFile: file, imageUrl: storedV1.imageUrl });
  });

  // The body `{ deliverableFile: null }` alone carries no deliverable, so the API refuses it. The
  // unlink goes through the same write as an edit, which carries the stored link.
  it('deleteDeliverable carries the stored url so the unlink is accepted', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, hasDeliverableFile: true } as any);

    expect(await service.deleteDeliverable('p-1')).toEqual({ fileDeleted: false });

    expect(mockPort.update).toHaveBeenCalledWith('p-1', {
      deliverableFile: null, deliverableFileId: '', url: storedV2.url,
    });
    expect(mockPort.deleteDeliverableFile).not.toHaveBeenCalled();
  });

  it('deleteDeliverable refuses when the file is the only deliverable', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({
      ...storedV2, url: '', hasDeliverableFile: true,
    } as any);

    await expect(service.deleteDeliverable('p-1')).rejects.toThrow(/nothing to deliver/);
    expect(mockPort.update).not.toHaveBeenCalled();
  });

  it('deleteDeliverable refuses on the old storage too when nothing else delivers', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue(storedV1 as any);

    await expect(service.deleteDeliverable('p-1')).rejects.toThrow(/nothing to deliver/);
    expect(mockPort.update).not.toHaveBeenCalled();
  });

  it('deleteDeliverable on the old storage sends the document with the file removed', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV1, url: 'https://x.com/a' } as any);

    await service.deleteDeliverable('p-1');

    expect(sentBody()).toMatchObject({
      deliverableFile: null, url: 'https://x.com/a', imageUrl: storedV1.imageUrl,
    });
  });

  it('deleteDeliverable refuses a filePath that is not the linked file, before changing anything', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV1, url: 'https://x.com/a' } as any);

    await expect(service.deleteDeliverable('p-1', 'deliverables/s1/other/z.pdf'))
      .rejects.toThrow(/is not a file of product p-1 \(the linked one is/);
    expect(mockPort.update).not.toHaveBeenCalled();
    expect(mockPort.deleteDeliverableFile).not.toHaveBeenCalled();
  });

  // The API only confines the path to the seller's folder: another product's file would be deleted
  // and its buyers would lose the download.
  it('deleteDeliverable on the new storage refuses a file of another product', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, hasDeliverableFile: true } as any);

    await expect(service.deleteDeliverable('p-1', 'deliverables/s1/p-2/b.pdf')).rejects.toThrow(/not a file of product p-1/);
    expect(mockPort.update).not.toHaveBeenCalled();
    expect(mockPort.deleteDeliverableFile).not.toHaveBeenCalled();
  });

  // The dashboard names the key of a file uploaded before the product existed with a generated
  // segment, never the product id: the refusal says so and how to unlink it anyway.
  it('deleteDeliverable on the new storage explains a dashboard key it cannot attribute', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, hasDeliverableFile: true } as any);

    await expect(service.deleteDeliverable('p-1', 'deliverables/s1/new-1760000000000/a.pdf'))
      .rejects.toThrow(/uploaded in the dashboard before its product was saved.*without filePath/s);
    expect(mockPort.update).not.toHaveBeenCalled();
    expect(mockPort.deleteDeliverableFile).not.toHaveBeenCalled();
  });

  it('deleteDeliverable deletes the bytes after the unlink', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV1, url: 'https://x.com/a' } as any);

    const result = await service.deleteDeliverable('p-1', storedV1.deliverableFile.filePath);

    expect(result).toEqual({ fileDeleted: true });
    expect(mockPort.deleteDeliverableFile).toHaveBeenCalledWith(storedV1.deliverableFile.filePath);
    expect(vi.mocked(mockPort.update).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(mockPort.deleteDeliverableFile).mock.invocationCallOrder[0]);
  });

  // The unlink already happened; an error here would read as "nothing changed".
  it('deleteDeliverable reports a failed byte deletion next to the completed unlink', async () => {
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, hasDeliverableFile: true } as any);
    vi.mocked(mockPort.deleteDeliverableFile).mockRejectedValue(new Error('API Error (403): forbidden'));

    const result = await service.deleteDeliverable('p-1', 'deliverables/s1/p-1/a.pdf');

    expect(mockPort.update).toHaveBeenCalled();
    expect(result).toEqual({ fileDeleted: false, fileDeleteError: 'API Error (403): forbidden' });
  });

  const page = {
    pageUrl: 'https://seller.example/oferta',
    acceptLabel: 'Quero <agora>',
    declineLabel: 'Não, obrigado',
    buttonColor: '#22C55E',
  } as const;

  it('getOfferPages lists every product in funnel order, with HTML only for the seller-page ones', async () => {
    vi.mocked(mockPort.listUpsells).mockResolvedValue([
      { uid: 'other', upsellProductId: 'x' },
      {
        uid: 'u-1', upsellProductId: 'p-2', upsellProductIds: ['p-2', 'p-3'],
        productOverrides: { 'p-3': { price: 9700, displayMode: 'external', externalFlow: page } },
      },
    ] as any);

    const result = await service.getOfferPages('p-1', 'upsell', 'u-1');

    expect(result.products.map((p) => [p.position, p.productId, p.displayMode])).toEqual([
      [1, 'p-2', 'native'],
      [2, 'p-3', 'external'],
    ]);
    expect(result.products[0]).toMatchObject({ pageUrl: null, html: null, offerRef: 'upsell:p-1:u-1:p-2' });
    expect(result.products[1].pageUrl).toBe('https://seller.example/oferta');
    expect(result.products[1].html).toContain('data-gg-offer="upsell:p-1:u-1:p-3"');
    expect(result.products[1].html).toContain('Quero &lt;agora&gt;');
    expect(result.products[1].html).toContain('<script src="https://app.test/embed/upsell.js?v=1" async></script>');
    expect(mockPort.saveOffer).not.toHaveBeenCalled();
  });

  // The API's rule: external needs the mode AND a valid page; otherwise the product opens on GG.
  it('getOfferPages hands out no snippet for a product without both the mode and a valid page', async () => {
    vi.mocked(mockPort.listUpsells).mockResolvedValue([{
      uid: 'u-1', upsellProductId: 'p-2', upsellProductIds: ['p-2', 'p-3', 'p-4'],
      productOverrides: {
        'p-2': { externalFlow: page },
        'p-3': { displayMode: 'external', externalFlow: { ...page, pageUrl: 'javascript:alert(1)' } },
        'p-4': { displayMode: 'external', externalFlow: { onAccept: { kind: 'thank_you' } } },
      },
    }] as any);

    const { products } = await service.getOfferPages('p-1', 'upsell', 'u-1');

    expect(products.map((p) => [p.displayMode, p.html])).toEqual([
      ['native', null],
      ['native', null],
      ['native', null],
    ]);
  });

  it('getOfferPages reads a downsell from the downsell list, and an unknown offer is not found', async () => {
    vi.mocked(mockPort.listDownsells).mockResolvedValue({
      downsells: [{ uid: 'd-1', downsellProductId: 'p-4' }], count: 1,
    } as any);

    const result = await service.getOfferPages('p-1', 'downsell', 'd-1');
    expect(result.products.map((p) => p.offerRef)).toEqual(['downsell:p-1:d-1:p-4']);
    expect(mockPort.listUpsells).not.toHaveBeenCalled();

    await expect(service.getOfferPages('p-1', 'downsell', 'nope')).rejects.toThrow('Downsell nope not found');
  });

  it('setOfferProductPage saves the whole offer with only that product moved to the seller page', async () => {
    const offer = {
      uid: 'u-1', upsellProductId: 'p-2', upsellProductIds: ['p-2', 'p-3'], title: 'Oferta',
      productOverrides: { 'p-2': { price: 4700 }, 'p-3': { price: 9700, title: 'Mentoria' } },
    };
    vi.mocked(mockPort.listUpsells).mockResolvedValue([offer] as any);
    vi.mocked(mockPort.saveOffer).mockResolvedValue(null);

    const result = await service.setOfferProductPage('p-1', 'upsell', 'u-1', 'p-3', page);

    expect(mockPort.saveOffer).toHaveBeenCalledWith('p-1', 'upsell', 'u-1', {
      ...offer,
      productOverrides: {
        'p-2': { price: 4700 },
        'p-3': { price: 9700, title: 'Mentoria', displayMode: 'external', externalFlow: page },
      },
    });
    expect(result.products[1]).toMatchObject({ productId: 'p-3', displayMode: 'external' });
    expect(result.products[1].html).toContain('data-gg-offer="upsell:p-1:u-1:p-3"');
  });

  it('setOfferProductPage with null puts the product back on the GG page and keeps the stored page', async () => {
    vi.mocked(mockPort.listDownsells).mockResolvedValue({
      downsells: [{
        uid: 'd-1', downsellProductId: 'p-4',
        productOverrides: { 'p-4': { price: 1900, displayMode: 'external', externalFlow: page } },
      }],
      count: 1,
    } as any);
    vi.mocked(mockPort.saveOffer).mockResolvedValue(null);

    const result = await service.setOfferProductPage('p-1', 'downsell', 'd-1', 'p-4', null);

    expect(vi.mocked(mockPort.saveOffer).mock.calls[0][3].productOverrides).toEqual({
      'p-4': { price: 1900, externalFlow: page },
    });
    expect(result.products).toEqual([
      expect.objectContaining({ productId: 'p-4', displayMode: 'native', html: null }),
    ]);
  });

  it('setOfferProductPage refuses a product the offer does not sell, without saving', async () => {
    vi.mocked(mockPort.listUpsells).mockResolvedValue([
      { uid: 'u-1', upsellProductId: 'p-2', upsellProductIds: ['p-2'] },
    ] as any);

    await expect(service.setOfferProductPage('p-1', 'upsell', 'u-1', 'p-9', page))
      .rejects.toThrow('Product p-9 is not offered by this upsell');
    expect(mockPort.saveOffer).not.toHaveBeenCalled();
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
    vi.mocked(mockPort.getById).mockResolvedValue({ ...storedV2, url: 'https://x.com/a' } as any);
    vi.mocked(mockPort.update).mockRejectedValue(new Error('404'));

    await expect(service.update('p-1', { title: 'New' })).rejects.toThrow('404');
  });
});
