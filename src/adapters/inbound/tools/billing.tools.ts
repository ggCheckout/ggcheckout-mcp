import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  MAX_TOPUP_CENTS,
  MIN_TOPUP_CENTS,
  type BillingService,
} from '../../../core/services/billing.service.js';
import { createToolHandler } from '../tool-handler.js';

export function registerBillingTools(server: McpServer, service: BillingService) {
  server.tool('get_billing_balance', 'Get current billing balance, credit, usage %, and next charge date',
    createToolHandler('get_billing_balance', async () => service.getBalance()),
  );

  server.tool('get_billing_status', 'Get billing status (active, pending_card, grace_period, blocked)',
    createToolHandler('get_billing_status', async () => service.getStatus()),
  );

  server.registerTool('get_billing_history', {
    description: 'Get billing history (charges, credits, payments)',
    inputSchema: {
      limit: z.number().min(1).max(1000).optional().describe('Max entries to return (default: 50)'),
      type: z.string().max(200).optional().describe('Filter by history entry type'),
    },
  }, createToolHandler('get_billing_history', async (args) => service.getHistory(args)));

  server.registerTool('list_invoices', {
    description: 'List seller invoices with optional status filter',
    inputSchema: {
      status: z.enum(['pending', 'processing', 'paid', 'failed', 'overdue']).optional().describe('Filter by invoice status'),
      limit: z.number().min(1).max(1000).optional().describe('Max invoices to return (default: 50)'),
    },
  }, createToolHandler('list_invoices', async (args) => service.listInvoices(args)));

  server.registerTool('get_invoice', {
    description: 'Get details of a specific invoice (fees, transaction count, volume, status)',
    inputSchema: { invoiceId: z.string().describe('Invoice ID') },
  }, createToolHandler('get_invoice', async ({ invoiceId }) => {
    const invoice = await service.getInvoice(invoiceId);
    return { invoice };
  }));

  server.registerTool('pay_invoice', {
    description: 'Pay an invoice via PIX, card, or credits',
    inputSchema: {
      invoiceId: z.string().describe('Invoice ID'),
      method: z.enum(['pix', 'card', 'credits']).describe('Payment method'),
    },
  }, createToolHandler('pay_invoice', async ({ invoiceId, method }) => service.payInvoice(invoiceId, method)));

  server.registerTool('list_credits', {
    description:
      'The credit statement. Returns `credits` (legacy PIX credits, with `status`) and `ledger` '
      + '({ entries, nextBefore }), which is the statement for an account on the new billing. One of '
      + 'the two is empty depending on the account, and that is the true answer, not an error: read '
      + 'whichever has rows. Ledger `amountCents` is signed (credit +, debit −) and `balanceAfterCents` '
      + 'is the running balance. Page the ledger by passing `before` = the `nextBefore` you got. If one '
      + 'side could not be read, its list is empty and `creditsError` / `ledgerError` says why.',
    inputSchema: {
      status: z.enum(['pending', 'confirmed', 'used', 'expired']).optional()
        .describe('Filter the legacy credits by status (does not apply to the ledger)'),
      limit: z.number().int().min(1).max(200).optional()
        .describe('Max rows (legacy default 20, ledger default 50; 200 is the lowest cap of the two routes)'),
      before: z.string().optional()
        .describe('Ledger cursor: the `nextBefore` from the previous page (RFC3339)'),
    },
  }, createToolHandler('list_credits', async (args) => service.listCredits(args)));

  server.registerTool('add_credit', {
    description:
      'Add billing credit via PIX. Returns { creditId, amountCents, pixCode, pixQrBase64, expiresAt, via }: '
      + '`pixCode` is the copy-and-paste string and `pixQrBase64` the QR image (base64, no `data:` prefix). '
      + 'Works on both billing generations — the right route is picked for the account, and `via` says '
      + 'which one answered. The credit only exists once the PIX is actually paid. On a timeout, a 502 '
      + 'or a 504 the PIX may have been opened anyway: check get_credit_topup (new billing) or the pending '
      + 'entries of list_credits (legacy) before calling this again.',
    inputSchema: {
      amountCents: z.number()
        .int('amountCents is a whole number of CENTS: R$ 10,00 is 1000')
        .min(MIN_TOPUP_CENTS, `amountCents is at least ${MIN_TOPUP_CENTS} CENTS (R$ 3,25)`)
        .max(MAX_TOPUP_CENTS, `amountCents is at most ${MAX_TOPUP_CENTS} CENTS (R$ 250,00)`)
        .describe(`Credit amount in CENTS, ${MIN_TOPUP_CENTS} to ${MAX_TOPUP_CENTS} (R$ 3,25 to R$ 250,00). R$ 10,00 is 1000`),
      idempotencyKey: z.string().min(1).max(128).optional()
        .describe('A stable key that makes a retry reuse the same top-up instead of opening another. Only '
          + 'the new billing reads it (without one it dedupes by amount within 2 minutes); the legacy '
          + 'billing ignores it and reuses the PIX already opened for the same amount, for 30 minutes.'),
    },
  }, createToolHandler('add_credit', async ({ amountCents, idempotencyKey }) => service.addCredit(amountCents, idempotencyKey)));

  server.tool('get_credit_topup',
    'The current credit top-up on the new billing: { creditId, amountCents, status (pending, paid, '
    + 'expired), pixCode, pixQrBase64, expiresAt }, or null when there is none. A pending top-up is not '
    + 'in the list_credits ledger until it is paid, so this is where to find one opened by add_credit.',
    createToolHandler('get_credit_topup', async () => ({ topup: await service.getCreditTopup() })),
  );

  server.tool('get_card_status', 'Get saved card status (validated, brand, last four, expiring soon)',
    createToolHandler('get_card_status', async () => service.getCardStatus()),
  );

  server.tool('remove_card', 'Remove the saved billing card',
    createToolHandler('remove_card', async () => {
      await service.removeCard();
      return { success: true, message: 'Card removed' };
    }),
  );
}
