import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrackingLinkService, type TrackingLinkReads, type TrackingLinkRequest } from '../../../core/tracking-links/index.js';
import { createToolHandler } from '../tool-handler.js';
import { appMeta, withDrawnNote } from '../apps/apps.js';

const manual = (what: string) => z.string().max(200).optional().describe(what);

/**
 * `appOrigin` is the origin of the configured API base URL (`appOriginOf(API_URL)`), which serves
 * the app and its checkout, quiz and store routes.
 */
export function registerTrackingLinkTools(server: McpServer, reads: TrackingLinkReads, appOrigin: string) {
  const service = new TrackingLinkService(reads, appOrigin);

  server.registerTool('build_tracking_link', {
    description: 'Build the link to sell from, with UTMs, and say where to paste it. No API write. Pick exactly one '
      + 'destination: checkoutId, funnelId, storeId (plus productId for one product) or url (any https URL). A '
      + 'checkout, funnel or store opens on the seller\'s verified custom domain when it has one, else on the GG '
      + 'address. `platform`: meta, tiktok, google, kwai (UTMify\'s templates, the platform fills the macros when '
      + 'the ad runs) or manual (default; fill utm_source, utm_medium, utm_campaign, utm_content, utm_term, src, '
      + 'sck). Answers { destination, platform, finalUrl, adParameters | trackingTemplate (google), where, notes, '
      + 'params }. A key the URL already has is not repeated; values you pass win over the URL and over the template.',
    inputSchema: {
      checkoutId: z.string().max(200).optional().describe('Checkout uid from list_checkouts'),
      funnelId: z.string().max(200).optional().describe('Funnel id from list_funnels'),
      storeId: z.string().max(200).optional().describe('Store id from list_stores'),
      productId: z.string().max(200).optional().describe('With storeId: link to one product page of the store'),
      url: z.string().max(2000).optional().describe('Any https URL (the one limit above 200 characters, for the query)'),
      platform: z.enum(['meta', 'tiktok', 'google', 'kwai', 'manual']).default('manual')
        .describe('meta, tiktok, google, kwai or manual'),
      utm_source: manual('Manual: traffic source, e.g. instagram'),
      utm_medium: manual('Manual: medium, e.g. bio'),
      utm_campaign: manual('Manual: campaign name'),
      utm_content: manual('Manual: ad or creative'),
      utm_term: manual('Manual: term or placement'),
      src: manual('Manual: src'),
      sck: manual('Manual: sck'),
    },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('build_tracking_link', async (args: TrackingLinkRequest) =>
    service.build(args))));
}
