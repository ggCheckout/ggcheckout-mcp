import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BillingService } from '../../../core/services/billing.service.js';
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
      + 'is the running balance. Page the ledger by passing `before` = the `nextBefore` you got.',
    inputSchema: {
      status: z.enum(['pending', 'confirmed', 'used', 'expired']).optional()
        .describe('Filter the legacy credits by status (does not apply to the ledger)'),
      limit: z.number().min(1).max(100).optional()
        .describe('Max rows (legacy default 20; the ledger defaults to 50 and is capped at 100)'),
      before: z.string().optional()
        .describe('Ledger cursor: the `nextBefore` from the previous page (RFC3339)'),
    },
  }, createToolHandler('list_credits', async (args) => service.listCredits(args)));

  server.registerTool('add_credit', {
    description:
      'Add billing credit via PIX. Returns { creditId, amountCents, pixCode, pixQrBase64, expiresAt, via }: '
      + '`pixCode` is the copy-and-paste string and `pixQrBase64` the QR image (base64, no `data:` prefix). '
      + 'Works on both billing generations — the right route is picked for the account, and `via` says '
      + 'which one answered. The credit only exists once the PIX is actually paid.',
    inputSchema: {
      amountCents: z.number().int().min(325).max(25_000)
        .describe('Credit amount in CENTS, 325 to 25000 (R$ 3,25 to R$ 250,00). R$ 10,00 is 1000'),
      idempotencyKey: z.string().min(1).max(128).optional()
        .describe('Send a stable key to make a retry reuse the same top-up instead of opening another '
          + '(without one the API dedupes by amount within 2 minutes)'),
    },
  }, createToolHandler('add_credit', async ({ amountCents, idempotencyKey }) => service.addCredit(amountCents, idempotencyKey)));

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
