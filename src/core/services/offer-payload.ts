import { randomUUID } from 'node:crypto';
import type { OfferKind } from '../types/product.js';
import { ValidationError } from '../../shared/errors.js';
import { mergeDeep } from '../../shared/merge.js';

type Doc = Record<string, unknown>;

function isDoc(value: unknown): value is Doc {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function definedOnly(doc: Doc): Doc {
  return Object.fromEntries(Object.entries(doc).filter(([, value]) => value !== undefined));
}

/**
 * Builds the offer document the API stores from what is already stored (`base`, `{}` on a create)
 * and the fields the caller sets. The pieces the offer page reads, which differ from what an agent
 * naturally sends:
 *
 * - **Price.** The page and the purchase routes charge `productOverrides[offeredProductId].price`
 *   (cents, above zero), else the offered product's own price. The top-level `price` is only a
 *   display snapshot, so the price fields write the override and keep the snapshot in step, as the
 *   dashboard editor does.
 * - **Image.** The page reads `customImage`, never a top-level `imageUrl`: `imageUrl` becomes
 *   `customImage { enabled: true, url }`.
 * - **Videos.** `videosSection` merges into the stored one (the video list replaces), every video
 *   gets an `id`, and the page only shows it when `mediaType` is `video`, so a section that is
 *   enabled with videos switches the offer to video unless the caller names a media type.
 */
export function composeOffer(kind: OfferKind, offeredProductId: string, base: Doc, input: Doc): Doc {
  const { price, originalPrice, discount, imageUrl, customImage, videosSection, ...rest } = input;
  const doc: Doc = { ...base, ...definedOnly(rest) };

  if (price !== undefined && !(Number.isInteger(price) && (price as number) > 0)) {
    throw new ValidationError(
      `price is the amount charged for the ${kind}, in cents (an integer above zero): got ${String(price)}. `
      + 'To charge the product\'s own price, leave price out.',
    );
  }
  const shown = definedOnly({ price, originalPrice, discount });
  if (Object.keys(shown).length > 0) {
    const overrides: Doc = isDoc(base.productOverrides) ? { ...base.productOverrides } : {};
    overrides[offeredProductId] = { ...(isDoc(overrides[offeredProductId]) ? overrides[offeredProductId] : {}), ...shown };
    doc.productOverrides = overrides;
    Object.assign(doc, shown);
  }

  const image = isDoc(customImage) ? customImage : typeof imageUrl === 'string' ? { url: imageUrl } : undefined;
  if (image) {
    const enabled = image.enabled ?? (image.url ? true : undefined);
    doc.customImage = mergeDeep(isDoc(base.customImage) ? base.customImage : {}, { ...image, enabled });
  }

  if (isDoc(videosSection)) {
    const merged = mergeDeep(isDoc(base.videosSection) ? base.videosSection : {}, videosSection) as Doc;
    const videos = (Array.isArray(merged.videos) ? merged.videos : [])
      .map((video: Doc) => ({ ...video, id: video.id || randomUUID() }));
    doc.videosSection = { ...merged, enabled: merged.enabled === true, videos };
    if (merged.enabled === true && videos.length > 0 && rest.mediaType === undefined && base.mediaType !== 'video') {
      doc.mediaType = 'video';
    }
  }

  return doc;
}
