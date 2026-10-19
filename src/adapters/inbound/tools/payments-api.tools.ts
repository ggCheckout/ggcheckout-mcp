import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PaymentsApiClient, DEFAULT_PAYMENTS_API_URL } from '../../outbound/payments-api.client.js';
import { createToolHandler } from '../tool-handler.js';

/**
 * The payments API has its own key (ggpk_…). Without GG_PAYMENTS_API_KEY the tools are not offered, and
 * the ggck_live_ key is never sent there. Returns the base URL when enabled.
 */
export function registerPaymentsApiToolsFromEnv(
  server: McpServer,
  env: NodeJS.ProcessEnv,
  version: string,
  fetchImpl?: typeof fetch,
): string | undefined {
  const key = env.GG_PAYMENTS_API_KEY;
  if (!key) return undefined;
  const url = env.GG_PAYMENTS_API_URL || DEFAULT_PAYMENTS_API_URL;
  registerPaymentsApiTools(server, new PaymentsApiClient(url, key, version, fetchImpl));
  return url;
}

/** Registered only when GG_PAYMENTS_API_KEY is set (see index.ts): these tools never use the ggck_live_ key. */
export function registerPaymentsApiTools(server: McpServer, client: PaymentsApiClient) {
  server.registerTool('list_wallets', {
    description:
      'List the wallets the payments API key may charge: `public_id` (`wal_…`), `name` and '
      + '`active_pix_count` (active PIX gateways; 0 means create_pix_charge fails with wallet_has_no_pix). '
      + 'Use `public_id` as `wallet` in create_pix_charge.',
    inputSchema: {},
  }, createToolHandler('list_wallets', async () => client.listWallets()));

  server.registerTool('create_pix_charge', {
    description:
      'Create a PIX charge on a wallet through the payments API. WITH A LIVE KEY (ggpk_live_) THIS CREATES '
      + 'A REAL CHARGE a buyer can pay with real money; with a test key (ggpk_test_) it creates a SIMULATED '
      + 'charge that charges nobody. The result carries `livemode`: say which mode ran. The PIX is in '
      + '`pix.copy_paste` and `pix.qr_base64`. Confirm amount and buyer (name, email, CPF/CNPJ, phone) with the user before calling it.',
    inputSchema: {
      wallet: z.string().describe('Wallet `public_id` (`wal_…`), from list_wallets'),
      amount: z.number().int().min(100).describe('Amount in cents (BRL): 4990 is R$ 49,90. Minimum 100'),
      description: z.string().optional().describe('What is being charged for'),
      external_reference: z.string().optional()
        .describe('Your own reference (e.g. order id). Unique per account: reusing it fails with external_reference_taken'),
      metadata: z.record(z.string()).optional().describe('String-to-string map stored with the charge'),
      buyer_name: z.string().describe('Buyer full name'),
      buyer_email: z.string().describe('Buyer email'),
      buyer_document: z.string().describe('Buyer CPF or CNPJ, digits or formatted'),
      buyer_phone: z.string().describe('Buyer phone, 10 to 15 digits (required by the API)'),
      idempotency_key: z.string().min(1).max(255).optional()
        .describe('Only to repeat a call that timed out or failed with 5xx: pass the SAME value so no second charge is made. Leave empty otherwise'),
    },
  }, createToolHandler('create_pix_charge', async (a) => client.createPixCharge({
    wallet: a.wallet,
    amount: a.amount,
    description: a.description,
    external_reference: a.external_reference,
    metadata: a.metadata,
    buyer: { name: a.buyer_name, email: a.buyer_email, document: a.buyer_document, phone: a.buyer_phone },
  }, a.idempotency_key)));

  server.registerTool('get_payment_intent', {
    description: 'Get a payment intent (PIX charge) by id (`pi_…`): status, amount, PIX and timestamps.',
    inputSchema: { id: z.string().describe('Payment intent id (`pi_…`)') },
  }, createToolHandler('get_payment_intent', async ({ id }) => client.getPaymentIntent(id)));

  server.registerTool('list_payment_intents', {
    description:
      'List payment intents, newest first, only of the key\'s mode (live or test). Page with '
      + '`next_cursor` as `starting_after` while `has_more` is true.',
    inputSchema: {
      status: z.enum(['requires_action', 'succeeded', 'expired', 'canceled', 'failed']).optional(),
      external_reference: z.string().optional().describe('Find the charge of one order'),
      starting_after: z.string().optional().describe('The `next_cursor` of the previous page'),
      limit: z.number().int().min(1).max(100).optional().describe('Page size, 1-100 (default 20)'),
    },
  }, createToolHandler('list_payment_intents', async (args) => client.listPaymentIntents(args)));

  server.registerTool('cancel_payment_intent', {
    description:
      'Cancel a payment intent that has not been paid yet. Fails with intent_not_cancelable once it succeeded, '
      + 'failed or expired. A PIX paid after the cancel still enters the wallet (the API then sends '
      + '`payment_intent.succeeded_after_cancel`).',
    inputSchema: { id: z.string().describe('Payment intent id (`pi_…`)') },
  }, createToolHandler('cancel_payment_intent', async ({ id }) => client.cancelPaymentIntent(id)));
}
