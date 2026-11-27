import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BuyerMessagingService } from '../../../core/services/buyer-messaging.service.js';
import { BUYER_MESSAGING_URI } from '../docs/buyer-messaging.js';
import { createToolHandler } from '../tool-handler.js';

/** Who messages a buyer at each moment: the "Visão geral" of Recuperar vendas, read-only. */
export function registerBuyerMessagingTools(server: McpServer, service: BuyerMessagingService): void {
  server.registerTool('get_buyer_messaging_overview', {
    description:
      'Who messages a buyer at each moment of a purchase, as the "Visão geral" of Recuperar vendas shows it. The answer to "who '
      + 'messages my buyer, and when". `rows`, always in this order: the notices `pending` (PIX or boleto generated) and `approved` '
      + '(approval and delivery), with `on`; the recovery moments `pix_unpaid`, `pix_expired`, `card_refused`, `card_cancelled`, '
      + '`abandoned_cart` and `purchase_approved`, each with the `owner` funnel (null: nobody messages the buyer at that moment) and '
      + '`assistantSkipped` (the funnel has an "assistant writes" step and the assistant is off, so the step is skipped); the '
      + 'conversation `buyer_replied`, owned by the `assistant` or the `team`. `dailyCap`: recovery or sale messages per person per '
      + 'day; null means no limit is stored yet, so say there is none and never assume one. `url`: the screen to send the seller to. '
      + `The rules behind it are in the resource ${BUYER_MESSAGING_URI}.`,
    inputSchema: {},
  }, createToolHandler('get_buyer_messaging_overview', async () => service.getOverview()));
}
