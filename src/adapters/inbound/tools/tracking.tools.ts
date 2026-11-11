import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TrackingService } from '../../../core/services/tracking.service.js';
import { explainTracking } from '../../../core/tracking/guide.js';
import { createToolHandler } from '../tool-handler.js';
import { appMeta, withDrawnNote } from '../apps/apps.js';

export function registerTrackingTools(server: McpServer, service: TrackingService) {
  server.registerTool('explain_tracking', {
    description:
      'Explain, in pt-BR, how a sale\'s metrics travel to Meta, TikTok, Google Ads and UTMify, and why they '
      + 'go missing: the browser and server paths, InitiateCheckout, Purchase, UTMs, deduplication, the '
      + 'funnel, the store and the errors. No API call. Pass `topic` for one part; leave it out for the '
      + 'whole guide. For the seller\'s own account use `diagnose_tracking`.',
    inputSchema: {
      topic: z.enum(['paths', 'initiate_checkout', 'purchase', 'utms', 'dedup', 'funnel', 'store', 'errors']).optional()
        .describe('The part to explain (default: the whole guide)'),
    },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('explain_tracking', async ({ topic }) => explainTracking(topic))));

  server.registerTool('diagnose_tracking', {
    description:
      'Diagnose why sales metrics do not arrive (Meta, TikTok, Google Ads, UTMify): reads the tracking '
      + 'tokens with their health, the checkout\'s or funnel\'s token links, a payment\'s UTMs and event '
      + 'dispatch, and the integration errors of the last 24 hours. Findings come sorted critical, warning, '
      + 'info, ok, each with what to do. With none of `checkoutId`, `funnelId`, `paymentId` it is an account '
      + 'overview. To link a pixel to a checkout, `update_checkout` takes a single token id in `metricToken`. Never returns credentials. A part the API cannot answer yet shows up as a '
      + '"não disponível ainda" finding.',
    inputSchema: {
      checkoutId: z.string().optional().describe('Checkout to check (uid from list_checkouts)'),
      funnelId: z.string().optional().describe('Funnel to check (id from list_funnels)'),
      paymentId: z.string().optional().describe('Payment to check: UTMs, click ids and event dispatch'),
    },
    _meta: appMeta(),
  }, withDrawnNote(server, createToolHandler('diagnose_tracking', async (args) => service.diagnose(args))));
}
