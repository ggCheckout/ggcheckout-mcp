import type { BillingPort } from '../ports/billing.port.js';

export class BillingService {
  constructor(private readonly port: BillingPort) {}

  async getBalance() { return this.port.getBalance(); }
  async getStatus() { return this.port.getStatus(); }
  async getHistory(options?: { limit?: number; type?: string }) { return this.port.getHistory(options); }
  async listInvoices(options?: { status?: string; limit?: number }) { return this.port.listInvoices(options); }
  async getInvoice(id: string) { return this.port.getInvoice(id); }
  async payInvoice(id: string, method: 'pix' | 'card' | 'credits') { return this.port.payInvoice(id, method); }
  async listCredits(options?: { status?: string; limit?: number }) { return this.port.listCredits(options); }
  async addCredit(amountCents: number) { return this.port.addCredit(amountCents); }
  async getCardStatus() { return this.port.getCardStatus(); }
  async removeCard() { return this.port.removeCard(); }
}
