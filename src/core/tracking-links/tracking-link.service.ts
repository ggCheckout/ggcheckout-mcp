import { ValidationError } from '../../shared/errors.js';
import type { Checkout } from '../types/checkout.js';
import type { CustomDomain } from '../types/custom-domain.js';
import type { Funnel } from '../types/funnel.js';
import type { StoreAdminConfig } from '../types/store.js';
import { buildLink, type BuiltLink } from './build-link.js';
import {
  checkoutDestination, funnelDestination, pickDomain, publicUrlOf, storeDestination, urlDestination,
  type Destination, type DomainRef,
} from './destination.js';
import type { ManualParams, Platform } from './templates.js';

/** The reads the generator needs; the real services satisfy these as they are. */
export interface TrackingLinkReads {
  checkouts: { getById(id: string): Promise<Checkout> };
  funnels: { getById(id: string): Promise<Funnel> };
  stores: { getStore(id: string): Promise<StoreAdminConfig> };
  domains: { list(): Promise<{ domains: CustomDomain[] }> };
}

export interface TrackingLinkRequest extends ManualParams {
  checkoutId?: string;
  funnelId?: string;
  storeId?: string;
  productId?: string;
  url?: string;
  platform?: Platform;
}

export interface TrackingLink extends BuiltLink {
  destination: Destination;
  platform: Platform;
}

export class TrackingLinkService {
  /** `appOrigin` is the origin of the GG API base URL, injected by the composition root. */
  constructor(private readonly reads: TrackingLinkReads, private readonly appOrigin: string) {}

  async build(request: TrackingLinkRequest): Promise<TrackingLink> {
    const platform = request.platform ?? 'manual';
    const destination = await this.resolve(request);
    const { notes: destinationNotes, ...rest } = destination;
    const built = buildLink({ destinationUrl: destination.url, platform, manual: request });
    return { destination: rest as Destination, platform, ...built, notes: [...destinationNotes, ...built.notes] };
  }

  private async resolve(request: TrackingLinkRequest): Promise<Destination> {
    const targets = [request.checkoutId, request.funnelId, request.storeId, request.url].filter(Boolean);
    if (targets.length !== 1) {
      throw new ValidationError('Provide exactly one of checkoutId, funnelId, storeId (with an optional productId) or url.');
    }
    if (request.productId && !request.storeId) {
      throw new ValidationError('productId goes together with storeId.');
    }
    if (request.url) return urlDestination(request.url);

    if (request.checkoutId) {
      const checkout = await this.reads.checkouts.getById(request.checkoutId);
      const publicUrl = publicUrlOf(checkout.publicUrl);
      const domain = await this.domainFor(publicUrl ? {} : { name: checkout.customDomain });
      return checkoutDestination({
        origin: this.appOrigin, id: checkout.publicId || checkout.uid || request.checkoutId,
        title: checkout.title, published: checkout.published, domain, publicUrl,
      });
    }
    if (request.funnelId) {
      const funnel = await this.reads.funnels.getById(request.funnelId);
      const publicUrl = publicUrlOf(funnel.publicUrl);
      const domain = await this.domainFor(publicUrl ? {} : { id: funnel.settings?.customDomainId, name: funnel.settings?.customDomain });
      return funnelDestination({
        origin: this.appOrigin, slug: funnel.slug, title: funnel.title,
        published: funnel.deleted ? false : funnel.published, domain, publicUrl,
      });
    }
    const storeId = request.storeId!;
    const store = await this.reads.stores.getStore(storeId);
    const publicUrl = publicUrlOf(store.publicUrl);
    const domain = await this.domainFor(publicUrl ? {} : { id: typeof store.customDomainId === 'string' ? store.customDomainId : null });
    const settings = store.settings as { title?: unknown } | undefined;
    return storeDestination({
      origin: this.appOrigin, storeId, productId: request.productId,
      title: settings?.title, published: store.published, domain, publicUrl,
    });
  }

  /** Reads the account's domains only when a document points at one. */
  private async domainFor(ref: DomainRef) {
    if (!ref.id && !ref.name) return pickDomain(ref, null);
    const { domains } = await this.reads.domains.list();
    return pickDomain(ref, domains);
  }
}
