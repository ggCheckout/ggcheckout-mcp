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
      limit: z.number().optional().describe('Max entries to return (default: 50)'),
      type: z.string().optional().describe('Filter by history entry type'),
    },
  }, createToolHandler('get_billing_history', async (args) => service.getHistory(args)));

  server.registerTool('list_invoices', {
    description: 'List seller invoices with optional status filter',
    inputSchema: {
      status: z.enum(['pending', 'processing', 'paid', 'failed', 'overdue']).optional().describe('Filter by invoice status'),
      limit: z.number().optional().describe('Max invoices to return (default: 50)'),
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
    description: 'List billing credits',
    inputSchema: {
      status: z.enum(['pending', 'confirmed', 'used', 'expired']).optional().describe('Filter by credit status'),
      limit: z.number().optional().describe('Max credits to return (default: 20)'),
    },
  }, createToolHandler('list_credits', async (args) => service.listCredits(args)));

  server.registerTool('add_credit', {
    description: 'Add billing credit via PIX. Returns QR code for payment.',
    inputSchema: {
      amountCents: z.number().describe('Credit amount in cents'),
    },
  }, createToolHandler('add_credit', async ({ amountCents }) => service.addCredit(amountCents)));

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
