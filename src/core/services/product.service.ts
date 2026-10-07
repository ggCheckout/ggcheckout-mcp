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
} from '../types/product.js';
import { validateCreateProductInput, validateUpdateProductInput } from '../../shared/validation.js';
import { ValidationError } from '../../shared/errors.js';

export class ProductService {
  constructor(private readonly productPort: ProductPort) {}

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

  /**
   * The edit, plus the one field needed to get past the API's deliverable check.
   *
   * Two facts pull in opposite directions, and both are verified against a live account:
   * the PATCH preserves by absence (an omitted `price` keeps the stored price), but the
   * "at least one deliverable" refusal is evaluated against the BODY, not against the merged
   * product — a title-only edit of a product that *has* a `url` is still refused with
   * "Você precisa fornecer um link (url), arquivo (deliverableFile)…".
   *
   * So neither extreme works: sending the whole document loses data on accounts stored in
   * Postgres (the read there answers `hasDeliverableFile` / `stockLineCount`, derived flags, and
   * never the file or the stock lines), and sending the bare delta is refused. What travels is
   * the delta plus the cheapest term that satisfies the check, carried over from the stored
   * product — or an exemption flag, when one applies.
   *
   * When the only deliverable is a file or stock lines, there is nothing to carry over: the
   * content is not readable through any route an API key can call. That edit cannot be made
   * through the API at all, so it fails here with an explanation instead of as a bare 400.
   */
  async update(id: string, input: any): Promise<void> {
    const validated = validateUpdateProductInput(input) as Record<string, unknown>;

    const hasTerm = (body: Record<string, unknown>) =>
      Boolean(body.url || body.deliverableFile || body.deliverableUrl || body.whatsappUrl)
      || (Array.isArray(body.stockLines) && body.stockLines.length > 0);

    if (hasTerm(validated)) return this.productPort.update(id, validated);

    const stored = ((await this.productPort.getById(id)) ?? {}) as unknown as Record<string, unknown>;

    // These three exempt a product from needing a deliverable at all; the fourth exemption (an
    // active members area) is resolved by the API itself and needs nothing from us.
    for (const flag of ['isPhysicalProduct', 'skipDeliveryEmail', 'membersAreaEnabled']) {
      if (stored[flag] === true) {
        return this.productPort.update(id, { ...validated, [flag]: true });
      }
    }

    const carried = ['url', 'deliverableUrl', 'whatsappUrl']
      .find((key) => typeof stored[key] === 'string' && (stored[key] as string).length > 0);
    if (carried) {
      return this.productPort.update(id, { ...validated, [carried]: stored[carried] });
    }

    if (stored.hasDeliverableFile === true || Number(stored.stockLineCount ?? 0) > 0) {
      throw new ValidationError(
        `Product ${id} delivers a file or stock lines, and the API does not expose either one for `
        + 'reading, so an edit cannot be sent without dropping the deliverable — the save would be '
        + 'refused. Edit this product in the dashboard, or pass the deliverable explicitly in this '
        + 'call (deliverableFile / stockLines) together with your change.',
      );
    }

    // No term and no exemption: the product has no deliverable at all, so the API would refuse any
    // save of it. Let it answer, since its message names every accepted field.
    return this.productPort.update(id, validated);
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

  async attachDeliverable(
    productId: string,
    input: { filePath: string; fileName: string; fileSize: number; fileType: string },
  ): Promise<DeliverableFile> {
    return this.productPort.attachDeliverable(productId, input);
  }

  async deleteDeliverable(productId: string, filePath?: string): Promise<void> {
    return this.productPort.deleteDeliverable(productId, filePath);
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

  async reorderDownsells(productId: string, order: string[]): Promise<ReorderResult[]> {
    return this.productPort.reorderDownsells(productId, order);
  }

  async manageTags(productId: string, tags: ProductTag[]): Promise<{ tags: ProductTag[] }> {
    return this.productPort.manageTags(productId, tags);
  }
}

/**
 * One past the highest stored position (1-based, as the editor writes it). The list length would
 * reuse a slot left by a deletion. An item without `order` counts at its 1-based list position.
 */
function nextOrder(items: Array<{ order?: number }>): number {
  return items.reduce((max, item, index) => Math.max(max, item.order ?? index + 1), 0) + 1;
}
