import { z } from 'zod';

const videoItemSchema = z.object({
  id: z.string().max(100).optional().describe('Stable id of the video; generated when missing'),
  sourceType: z.enum(['url', 'upload', 'embed']).optional()
    .describe('"embed" for a provider player (needs provider + providerId); "url" or "upload" for a file link (needs url)'),
  url: z.string().max(2048).optional().describe('Video file URL (sourceType "url" or "upload")'),
  provider: z.enum(['youtube', 'vturb', 'wistia', 'vimeo', 'panda', '']).optional().describe('Player provider (embed)'),
  providerId: z.string().max(200).optional().describe('Video id at the provider (embed)'),
  libraryId: z.string().max(200).optional().describe('Account/library id (VTurb and Panda)'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional().describe('Default 16:9'),
}).refine(
  (video) => {
    const embed = video.sourceType === 'embed' || (!video.sourceType && Boolean(video.provider));
    return embed ? Boolean(video.provider && video.providerId) : Boolean(video.url);
  },
  'an embed video needs provider and providerId; a url or upload video needs url',
);

/** The offer's videos: the page shows them only when `mediaType` is "video". */
export const videosSectionSchema = z.object({
  enabled: z.boolean().describe('Show the videos'),
  title: z.string().max(200).optional().describe('Title of the section'),
  titleColor: z.string().max(20).optional().describe('Title color, #RRGGBB'),
  videos: z.array(videoItemSchema).max(4).optional()
    .describe('Up to 4 videos, replacing the stored list. videos[0] is the main video of the offer card; the rest show above the footer'),
}).describe('Videos of the offer. Shown only when mediaType is "video" (set automatically when this enables videos and mediaType is not sent)');

export const customImageSchema = z.object({
  enabled: z.boolean().optional().describe('Default true when url is sent'),
  url: z.string().max(2048).optional().describe('Image URL: absolute https, or the /api/r2-proxy/... path from upload_media'),
}).describe('Image of the offer card (what the page shows). imageUrl is a shortcut for this');

/** Fields an upsell takes on create and on update. Prices are in CENTS. */
export const upsellFields = {
  headline: z.string().max(200).optional().describe('Headline above the offer'),
  description: z.string().max(5000).optional().describe('Offer description'),
  price: z.number().int().positive().optional()
    .describe('CHARGED price of the offered product, in cents (> 0). Written to productOverrides[upsellProductId].price, '
      + 'the value the page and the purchase use; without it the product\'s own price is charged. The top-level `price` of '
      + 'the offer is only a display snapshot'),
  originalPrice: z.number().int().min(0).optional().describe('Struck-through price in cents (display only, never charged)'),
  discount: z.string().max(50).optional().describe('Discount label (e.g., "30% OFF"), display only'),
  imageUrl: z.string().max(2048).optional().describe('Image URL (shortcut for customImage { enabled: true, url })'),
  customImage: customImageSchema.optional(),
  mediaType: z.enum(['image', 'video']).optional().describe('Media of the offer card'),
  videosSection: videosSectionSchema.optional(),
  deliveryMethod: z.enum(['url', 'file', 'whatsapp']).optional().describe('Delivery method'),
  chainBehavior: z.enum(['continue', 'stop_on_decline']).optional()
    .describe('After a decline: continue to the next upsell, or stop_on_decline to show the downsells'),
  timerEnabled: z.boolean().optional().describe('Enable countdown timer'),
  timerMinutes: z.number().min(0).max(525600).optional().describe('Timer duration in minutes'),
  status: z.enum(['active', 'inactive']).optional().describe('Upsell status (default: active)'),
  order: z.number().int().min(1).max(1000).optional().describe('Position in the funnel, 1-based (default: after the existing upsells)'),
};

/** Fields a downsell takes on create and on update. Prices are in CENTS. */
export const downsellFields = {
  description: z.string().max(5000).optional().describe('Downsell description'),
  headline: z.string().max(200).optional().describe('Downsell headline'),
  originalPrice: z.number().int().min(0).optional().describe('Struck-through price in cents (display only, never charged)'),
  discount: z.string().max(50).optional().describe('Discount label, display only'),
  customImage: customImageSchema.optional(),
  mediaType: z.enum(['image', 'video']).optional().describe('Media type'),
  videosSection: videosSectionSchema.optional(),
  timerEnabled: z.boolean().optional().describe('Enable countdown timer'),
  timerMinutes: z.number().min(0).max(525600).optional().describe('Timer duration in minutes'),
  status: z.enum(['active', 'inactive']).optional().describe('Downsell status'),
  chainBehavior: z.enum(['continue', 'stop']).optional().describe('Chain behavior after this downsell'),
  order: z.number().int().min(1).max(1000).optional().describe('Position in the sequence, 1-based (default: after the existing downsells)'),
};

export const downsellPrice = z.number().int().positive()
  .describe('CHARGED price of the offered product, in cents (> 0). Written to productOverrides[downsellProductId].price, '
    + 'the value the page and the purchase use. The top-level `price` of the offer is only a display snapshot');
