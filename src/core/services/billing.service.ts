import type { BillingPort } from '../ports/billing.port.js';
import { NetworkError, TemporarilyUnavailableError } from '../../shared/errors.js';

/** Both top-up routes enforce the same range, inclusive, in whole cents. */
export const MIN_TOPUP_CENTS = 325;
export const MAX_TOPUP_CENTS = 25_000;

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
   * A timeout or a 502 does not mean the PIX was not opened: the API may have created it and lost
   * only the answer. A caller that simply retries would then open a second charge, so the error
   * says how to retry without one.
   */
  async addCredit(amountCents: number, idempotencyKey?: string) {
    try {
      return await this.port.addCredit(amountCents, idempotencyKey);
    } catch (error) {
      if (!mayHaveLanded(error)) throw error;
      throw new TemporarilyUnavailableError(
        error.statusCode ?? 502,
        `${error.message} The top-up may have been opened anyway. Before calling add_credit again, `
        + 'wait a minute and look for it in list_credits. A retry with the same amount and the same '
        + 'idempotencyKey reuses a top-up already opened on the new billing; on the legacy billing the '
        + 'same amount reuses the PIX already opened, for 30 minutes after it was created.',
        error,
      );
    }
  }

  async getCardStatus() { return this.port.getCardStatus(); }
  async removeCard() { return this.port.removeCard(); }
}

/** A 502, or a request that timed out after reaching the API — not one that never got there. */
function mayHaveLanded(error: unknown): error is TemporarilyUnavailableError | NetworkError {
  if (error instanceof TemporarilyUnavailableError) return error.statusCode === 502;
  return error instanceof NetworkError
    && (error.cause as { code?: string } | undefined)?.code === 'ECONNABORTED';
}
