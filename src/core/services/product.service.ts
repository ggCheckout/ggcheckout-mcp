import type { ProductPort } from '../ports/product.port.js';
import type {
  Product,
  ProductTag,
  DeliverablePresign,
  DeliverableFile,
  ReorderResult,
  Upsell,
  CreateUpsellInput,
  DownsellSequenceItem,
  CreateDownsellInput,
  ExternalFlow,
  OfferKind,
  OfferProductPage,
} from '../types/product.js';
import { validateCreateProductInput, validateUpdateProductInput } from '../../shared/validation.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { buildExternalOfferSnippet, externalOfferRef, externalPageOf } from '../../shared/external-offer-snippet.js';

export class ProductService {
  /** `appUrl` is the app the seller's page loads the upsell script from (the API base URL). */
  constructor(private readonly productPort: ProductPort, private readonly appUrl: string) {}

  async list(): Promise<Product[]> {
    // delete_product is a soft delete: the API keeps listing the row with `deleted: true`.
    return (await this.productPort.list()).filter((product) => product.deleted !== true);
  }

  async getById(id: string): Promise<Product> {
    return this.productPort.getById(id);
  }

  async create(input: any): Promise<{ success: boolean; productId: string }> {
    const validated = validateCreateProductInput(input);
    return this.productPort.create(validated);
  }

  async update(id: string, input: any): Promise<void> {
    const validated = validateUpdateProductInput(input) as Record<string, unknown>;
    return this.write(id, validated);
  }

  async delete(id: string): Promise<void> {
    return this.productPort.delete(id);
  }

  async presignDeliverable(
    productId: string,
    input: { fileName: string; fileType: string; fileSize: number },
  ): Promise<DeliverablePresign> {
    return this.productPort.presignDeliverable(productId, input);
  }

  /**
   * Confirms the upload, then links it. Nothing under `deliverables/*` links a file to a product,
   * so without the product write the file would sit in storage where no buyer can reach it.
   *
   * A link the product already has is left alone: when a product has both, the file is what gets
   * delivered, and blanking the link would throw away the seller's fallback without a word.
   */
  async attachDeliverable(
    productId: string,
    input: { filePath: string; fileName: string; fileSize: number; fileType: string },
  ): Promise<DeliverableFile> {
    const file = await this.productPort.completeDeliverableUpload(input);
    await this.write(productId, { deliverableFile: file, deliverableFileId: '' });
    return file;
  }

  /**
   * Unlinks the file (`deliverableFile: null` is how both storages express a removal), then, given
   * `filePath`, deletes the bytes — same order the dashboard uses, so a refused unlink never
   * destroys a file that is still linked.
   *
   * The unlink is refused here when nothing would be left to deliver, since the API refuses to save
   * such a product. A failed byte deletion does not undo the unlink, so it comes back as
   * `fileDeleteError` next to a success instead of as an error that would hide the change.
   */
  async deleteDeliverable(
    productId: string,
    filePath?: string,
  ): Promise<{ fileDeleted: boolean; fileDeleteError?: string }> {
    const stored = await this.read(productId);

    // The path is checked against the product before anything changes: the API only confines it to
    // the seller's folder, so a wrong one would unlink this product and delete the file another of
    // their products delivers, and that product's buyers would lose the download.
    if (filePath && isNewStorageRead(stored) && isUnnamedProductKey(filePath)) {
      throw new ValidationError(
        `${filePath} was uploaded in the dashboard before its product was saved, so the key does not `
        + `name a product and this server cannot confirm it belongs to product ${productId}. Nothing was `
        + 'changed. Call delete_deliverable without filePath to unlink the file, and remove the stored '
        + 'file in the dashboard.',
      );
    }
    if (filePath && !isProductFile(stored, productId, filePath)) {
      const linked = linkedFilePath(stored);
      throw new ValidationError(
        `${filePath} is not a file of product ${productId}`
        + `${linked ? ` (the linked one is ${linked})` : ''}. Nothing was changed.`,
      );
    }

    if (!deliversWithoutFile(stored)) {
      throw new ValidationError(
        `Removing the file would leave product ${productId} with nothing to deliver, and the API `
        + 'refuses to save a product without a deliverable. Give it another one first (update_product '
        + 'with `url`), then remove the file. Nothing was changed.',
      );
    }

    await this.write(productId, { deliverableFile: null, deliverableFileId: '' }, stored);
    if (!filePath) return { fileDeleted: false };

    try {
      await this.productPort.deleteDeliverableFile(filePath);
      return { fileDeleted: true };
    } catch (error) {
      return { fileDeleted: false, fileDeleteError: (error as Error).message };
    }
  }

  /**
   * Every product write goes through here, because the two storages read and write in opposite
   * ways and the body that is safe for one loses data on the other.
   *
   * **Old storage (Firestore).** The write puts a DEFAULT into every key the body omits — `url`,
   * `imageUrl` and `deliverableUrl` become `''`, `deliverableFile` becomes `null`,
   * `membersAreaEnabled` / `isPhysicalProduct` / `skipDeliveryEmail` become `false`, and so on. A
   * partial body therefore wipes the product with a 200. The read echoes the stored document,
   * file and stock lines included, so the whole document travels with the change on top.
   * `stockQuantity` stays out: it is a live counter that a sale moves, and an absent one keeps
   * what is stored instead of writing back the number that was read.
   *
   * **New storage (Postgres).** An omitted key keeps what is stored, but the read never carries the
   * file or the stock lines (only `hasDeliverableFile` / `stockLineCount`), and the "at least one
   * deliverable" check reads the BODY, not the merged product: a title-only edit of a product that
   * has a `url` is refused. So the change travels with the cheapest term that satisfies the check,
   * carried over from the stored product (a link first, then an exemption flag), never one the
   * change itself sets. When the only
   * deliverable is a file or stock lines there is nothing to carry, and the change is refused here
   * with an explanation instead of as a bare 400.
   */
  private async write(
    id: string,
    change: Record<string, unknown>,
    stored?: Record<string, unknown>,
  ): Promise<void> {
    // Read even when the change names a deliverable: that is the only way to know the storage.
    const current = stored ?? (await this.read(id));
    if (!isNewStorageRead(current)) return this.productPort.update(id, wholeDocument(current, change));
    if (hasDeliveryTerm(change)) return this.productPort.update(id, change);
    // An exemption the change turns on satisfies the check by itself.
    if (CARRIED_EXEMPTIONS.some((key) => change[key] === true)) return this.productPort.update(id, change);

    // Nothing is carried that the change itself sets: an empty `url` or a `false` flag is the seller
    // removing it, and carrying the stored value would undo the edit with a 200.
    //
    // A link first, because re-sending it changes nothing a buyer sees. Then an exemption the product
    // already has. Never `membersAreaEnabled`: on the new storage it makes the core blank the delivery
    // fields, and an active members area is an exemption the API resolves by itself.
    const link = LINK_FIELDS.find((key) => !(key in change) && isNonEmptyString(current[key]));
    if (link) return this.productPort.update(id, { ...change, [link]: current[link] });

    const flag = CARRIED_EXEMPTIONS.find((key) => !(key in change) && current[key] === true);
    if (flag) return this.productPort.update(id, { ...change, [flag]: true });

    const keepsFile = current.hasDeliverableFile === true && !('deliverableFile' in change);
    if (keepsFile || Number(current.stockLineCount ?? 0) > 0) {
      throw new ValidationError(
        `Product ${id} delivers stock lines or a file, and the API does not expose either one for `
        + 'reading, so this change cannot carry them and the save would be refused. Make it in the '
        + 'dashboard, or pass a `url` with the change if the product should also deliver one.',
      );
    }

    // No term and no exemption: the product delivers nothing, so the API refuses any save of it.
    // Let it answer, since its message names every accepted field.
    return this.productPort.update(id, change);
  }

  private async read(id: string): Promise<Record<string, unknown>> {
    return ((await this.productPort.getById(id)) ?? {}) as unknown as Record<string, unknown>;
  }

  async listUpsells(productId: string): Promise<Upsell[]> {
    return this.productPort.listUpsells(productId);
  }

  /**
   * Writes the offer in the shape the dashboard editor does. The Postgres-backed API requires
   * `order` (it becomes `sortOrder`) and reads the offered products from `upsellProductIds`;
   * without them the write is refused, or saved with no product to sell.
   */
  async createUpsell(productId: string, upsellId: string, input: CreateUpsellInput): Promise<Upsell> {
    const order = input.order ?? nextOrder(await this.productPort.listUpsells(productId));
    return this.productPort.createUpsell(productId, upsellId, {
      ...input,
      uid: upsellId,
      id: upsellId,
      upsellProductIds: [input.upsellProductId],
      order,
    });
  }

  async deleteUpsell(productId: string, upsellId: string): Promise<void> {
    return this.productPort.deleteUpsell(productId, upsellId);
  }

  async reorderUpsells(productId: string, upsellIds: string[]): Promise<ReorderResult[]> {
    return this.productPort.reorderUpsells(productId, upsellIds);
  }

  async listDownsells(productId: string): Promise<{ downsells: DownsellSequenceItem[]; count: number }> {
    return this.productPort.listDownsells(productId);
  }

  /** Same editor shape as {@link createUpsell}: `order` is required, products go in `downsellProductIds`. */
  async createDownsell(productId: string, downsellId: string, input: CreateDownsellInput): Promise<DownsellSequenceItem> {
    const order = input.order ?? nextOrder((await this.productPort.listDownsells(productId)).downsells);
    return this.productPort.createDownsell(productId, downsellId, {
      ...input,
      uid: downsellId,
      id: downsellId,
      downsellProductIds: [input.downsellProductId],
      order,
    });
  }

  async deleteDownsell(productId: string, downsellId: string): Promise<void> {
    return this.productPort.deleteDownsell(productId, downsellId);
  }

  async reorderDownsells(productId: string, downsellIds: string[]): Promise<ReorderResult[]> {
    return this.productPort.reorderDownsells(productId, downsellIds);
  }

  /**
   * Every product of an offer in funnel order, with where it opens and, for those on the seller's
   * page ("Minha página"), the HTML to paste there — the dashboard's "Copiar HTML". Read only: what an
   * agent needs to put the buttons on the seller's landing page.
   *
   * The `data-gg-offer` reference names ONE product, so each external product has its own snippet,
   * and the buyer only reaches it when the funnel order gets to that product.
   */
  async getOfferPages(
    productId: string,
    kind: OfferKind,
    offerId: string,
  ): Promise<{ offerId: string; kind: OfferKind; products: OfferProductPage[] }> {
    const offer = await this.findOffer(productId, kind, offerId);
    return { offerId, kind, products: this.offerPages(productId, kind, offerId, offer) };
  }

  /**
   * Puts ONE product of an offer on the seller's own page (`page`), or back on the GG offer page
   * (`null`), and answers the offer's products as `getOfferPages` does. Where the buyer goes after
   * accepting or declining is not set here: the funnel order decides, on both kinds of page.
   *
   * The API has no per-product write: the offer is read, only that product's override changes, and
   * the whole offer is saved back (the dashboard editor's save). Back on the GG page keeps the stored
   * page, so moving the product to the seller's page again loses nothing — the dashboard does the same.
   */
  async setOfferProductPage(
    productId: string,
    kind: OfferKind,
    offerId: string,
    offeredProductId: string,
    page: ExternalFlow | null,
  ): Promise<{ offerId: string; kind: OfferKind; products: OfferProductPage[] }> {
    const offer = await this.findOffer(productId, kind, offerId);
    if (!offeredProductIds(offer).includes(offeredProductId)) {
      throw new ValidationError(
        `Product ${offeredProductId} is not offered by this ${kind}. Products in the offer: `
          + `${offeredProductIds(offer).join(', ') || 'none'}.`,
      );
    }

    const overrides = { ...(offer.productOverrides ?? {}) };
    const { displayMode: _previous, ...rest } = overrides[offeredProductId] ?? {};
    overrides[offeredProductId] = page
      ? { ...rest, displayMode: 'external', externalFlow: page }
      : rest;

    const saved = await this.productPort.saveOffer(productId, kind, offerId, {
      ...(offer as unknown as Record<string, unknown>),
      productOverrides: overrides,
    });
    const after = saved && 'productOverrides' in saved
      ? (saved as unknown as Upsell | DownsellSequenceItem)
      : { ...offer, productOverrides: overrides };
    return { offerId, kind, products: this.offerPages(productId, kind, offerId, after) };
  }

  private async findOffer(
    productId: string,
    kind: OfferKind,
    offerId: string,
  ): Promise<Upsell | DownsellSequenceItem> {
    const offers = kind === 'upsell'
      ? await this.productPort.listUpsells(productId)
      : (await this.productPort.listDownsells(productId)).downsells;
    const offer = offers.find((item) => item.uid === offerId);
    if (!offer) throw new NotFoundError(kind === 'upsell' ? 'Upsell' : 'Downsell', offerId);
    return offer;
  }

  private offerPages(
    productId: string,
    kind: OfferKind,
    offerId: string,
    offer: Upsell | DownsellSequenceItem,
  ): OfferProductPage[] {
    return offeredProductIds(offer).map((offeredId, index) => {
      const offerRef = externalOfferRef(kind, productId, offerId, offeredId);
      const page = externalPageOf(offer.productOverrides?.[offeredId]);
      return {
        productId: offeredId,
        position: index + 1,
        displayMode: page ? 'external' : 'native',
        pageUrl: page?.pageUrl ?? null,
        offerRef,
        html: page ? buildExternalOfferSnippet({ offerRef, flow: page, appUrl: this.appUrl }) : null,
      };
    });
  }

  async manageTags(productId: string, tags: ProductTag[]): Promise<{ tags: ProductTag[] }> {
    return this.productPort.manageTags(productId, tags);
  }
}

/** Every product an offer sells, whichever kind it is. */
function offeredProductIds(offer: Upsell | DownsellSequenceItem): string[] {
  const ids = 'upsellProductId' in offer
    ? offer.upsellProductIds ?? [offer.upsellProductId]
    : offer.downsellProductIds ?? [offer.downsellProductId];
  return ids.filter(Boolean);
}

/** These exempt a product from needing a deliverable at all. */
const EXEMPTION_FLAGS = ['isPhysicalProduct', 'skipDeliveryEmail', 'membersAreaEnabled'] as const;

/** The exemptions safe to re-send: `membersAreaEnabled` is left out, see `write`. */
const CARRIED_EXEMPTIONS = ['isPhysicalProduct', 'skipDeliveryEmail'] as const;

/** The deliverables a read returns as plain strings, so they can be carried over. */
const LINK_FIELDS = ['url', 'deliverableUrl', 'whatsappUrl'] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * The read on the new storage collapses the file and the stock lines into these two derived
 * flags; the read on the old one echoes the stored document, which never has them. It is the
 * only signal of the storage this client gets.
 */
function isNewStorageRead(stored: Record<string, unknown>): boolean {
  return 'hasDeliverableFile' in stored || 'stockLineCount' in stored;
}

/** The API's own "at least one deliverable" test, applied to a request body. */
function hasDeliveryTerm(body: Record<string, unknown>): boolean {
  return LINK_FIELDS.some((key) => Boolean(body[key]))
    || Boolean(body.deliverableFile)
    || (Array.isArray(body.stockLines) && body.stockLines.length > 0);
}

function linkedFilePath(stored: Record<string, unknown>): string | undefined {
  const path = (stored.deliverableFile as { filePath?: unknown } | null | undefined)?.filePath;
  return typeof path === 'string' ? path : undefined;
}

/**
 * Whether `filePath` is this product's file. The old storage's read carries the linked file, so the
 * path must be exactly it. The new one never returns the path, so the key itself is checked: the
 * upload names it `deliverables/<seller>/<productId>/<file>`.
 */
function isProductFile(stored: Record<string, unknown>, productId: string, filePath: string): boolean {
  if (!isNewStorageRead(stored)) return linkedFilePath(stored) === filePath;
  const segments = filePath.split('/');
  return segments.length >= 4 && segments[0] === 'deliverables' && segments[2] === productId;
}

/**
 * A key the dashboard minted while the product had no id yet: the API names that segment
 * `new-<timestamp>` instead of the product id, so the key itself cannot say whose file it is.
 */
function isUnnamedProductKey(filePath: string): boolean {
  return /^new-\d+$/.test(filePath.split('/')[2] ?? '');
}

/** Whether the stored product, in either storage's shape, still delivers once its file is gone. */
function deliversWithoutFile(stored: Record<string, unknown>): boolean {
  return EXEMPTION_FLAGS.some((key) => stored[key] === true)
    || LINK_FIELDS.some((key) => isNonEmptyString(stored[key]))
    || (Array.isArray(stored.stockLines) && stored.stockLines.length > 0)
    || Number(stored.stockLineCount ?? 0) > 0;
}

/** The old storage's body: the stored document with the change on top. See `write`. */
function wholeDocument(stored: Record<string, unknown>, change: Record<string, unknown>) {
  const { uid: _uid, updatedAt: _updatedAt, stockQuantity: _stockQuantity, ...document } = stored;
  return { ...document, ...change };
}

/**
 * One past the highest stored position (1-based, as the editor writes it). The list length would
 * reuse a slot left by a deletion. An item without `order` counts at its 1-based list position.
 */
function nextOrder(items: Array<{ order?: number }>): number {
  return items.reduce((max, item, index) => Math.max(max, item.order ?? index + 1), 0) + 1;
}
