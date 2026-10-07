import type { BillingPort } from '../ports/billing.port.js';
import { ValidationError } from '../../shared/errors.js';

/** Both top-up routes enforce the same range, inclusive, in whole cents. */
const MIN_TOPUP_CENTS = 325;
const MAX_TOPUP_CENTS = 25_000;

export class BillingService {
  constructor(private readonly port: BillingPort) {}

  async getBalance() { return this.port.getBalance(); }
  async getStatus() { return this.port.getStatus(); }
  async getHistory(options?: { limit?: number; type?: string }) { return this.port.getHistory(options); }
  async listInvoices(options?: { status?: string; limit?: number }) { return this.port.listInvoices(options); }
  async getInvoice(id: string) { return this.port.getInvoice(id); }
  async payInvoice(id: string, method: 'pix' | 'card' | 'credits') { return this.port.payInvoice(id, method); }
  async listCredits(options?: { status?: string; limit?: number; before?: string }) {
    return this.port.listCredits(options);
  }

  /**
   * Checked here rather than left to the API because the range is the same on both routes, and a
   * refusal that costs a round trip teaches the caller nothing: the API answers "Valor mínimo é
   * R$ 3,25" without saying the field is in cents.
   */
  async addCredit(amountCents: number, idempotencyKey?: string) {
    if (!Number.isInteger(amountCents)) {
      throw new ValidationError(
        `amountCents must be a whole number of CENTS, got ${amountCents}. R$ 10,00 is 1000.`,
      );
    }
    if (amountCents < MIN_TOPUP_CENTS || amountCents > MAX_TOPUP_CENTS) {
      throw new ValidationError(
        `amountCents must be between ${MIN_TOPUP_CENTS} and ${MAX_TOPUP_CENTS} cents `
        + `(R$ 3,25 to R$ 250,00), got ${amountCents}.`,
      );
    }
    return this.port.addCredit(amountCents, idempotencyKey);
  }
  async getCardStatus() { return this.port.getCardStatus(); }
  async removeCard() { return this.port.removeCard(); }
}
