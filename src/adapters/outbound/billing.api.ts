import type { BillingPort } from '../../core/ports/billing.port.js';
import type {
  BalanceResponse, BillingStatusResponse, BillingHistoryEntry,
  SellerInvoice, BillingCredit, BillingCard, CreditLedgerPage, CreditTopup, PendingCreditTopup,
  InvoicePixPayment,
} from '../../core/types/billing.js';
import { sanitizeBillingCard } from '../../shared/sanitizer.js';
import { ApiError, ValidationError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

const TOPUP_ROUTE = '/api/billing/credit/topup';

/** `/api/billing/pix`: the open invoice's PIX (saas lib/payments/client.ts), or `{ pix: null }` without one. */
interface InvoicePixResponse {
  invoiceId?: string;
  amountCents: number;
  status: InvoicePixPayment['status'];
  pix: { emv: string; qrBase64: string; expiresAt: string } | null;
}

type InvoicePix = NonNullable<InvoicePixResponse['pix']>;

function notTheOpenInvoice(id: string, openId: string): ValidationError {
  return new ValidationError(`Invoice ${id} is not the open one: only ${openId} can be paid now. Call pay_invoice with that id.`);
}

function noPixToPay(id: string, track: string): ValidationError {
  return new ValidationError(`Invoice ${id} has no PIX to pay: it is not the open invoice of the ${track} track, or it was just settled.`);
}

function toPixPayment(answer: InvoicePixResponse, pix: InvoicePix): InvoicePixPayment {
  return {
    invoiceId: answer.invoiceId as string,
    amountCents: answer.amountCents,
    status: answer.status,
    pixCode: pix.emv ?? null,
    pixQrBase64: pix.qrBase64 ?? null,
    expiresAt: pix.expiresAt ?? null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class BillingApiAdapter implements BillingPort {
  constructor(private readonly http: HttpClient) {}

  async getBalance(): Promise<BalanceResponse> {
    return this.http.get<BalanceResponse>('/api/billing/balance');
  }

  async getStatus(): Promise<BillingStatusResponse> {
    return this.http.get<BillingStatusResponse>('/api/billing/status');
  }

  async getHistory(options?: { limit?: number; type?: string }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);
    const qs = params.toString();
    return this.http.get<{ history: BillingHistoryEntry[]; total: number }>(`/api/billing/history${qs ? `?${qs}` : ''}`);
  }

  async listInvoices(options?: { status?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const qs = params.toString();
    return this.http.get<{ invoices: SellerInvoice[]; total: number }>(`/api/billing/invoices${qs ? `?${qs}` : ''}`);
  }

  async getInvoice(id: string): Promise<SellerInvoice> {
    return this.http.get<SellerInvoice>(`/api/billing/invoices/${encodeURIComponent(id)}`);
  }

  /**
   * An invoice is paid by the PIX of the open invoice, as the dashboard's "Pagar Fatura" does: the
   * legacy `/api/billing/invoices/{id}/pay` was retired with the legacy billing (it answers 500
   * LEGACY_BILLING_READ_RETIRED), and credit is applied by payments on its own. The route pays the
   * open invoice of a track, not one by id, so the invoice is read first for its track, and the
   * answer must name that same invoice: a PIX for another one would be paid in its place.
   *
   * The POST is limited to 10 per hour per seller (shared with the dashboard button) and reissues
   * the open invoice's PIX even when `id` is not the open one, so the read-only GET goes first: it
   * names the open invoice without spending the limit. A live PIX for this invoice is returned
   * as is; another invoice is refused; no open invoice at all (the read answers `{ pix: null }`
   * with no `invoiceId`: payments has none open for the track) is refused too, because the POST
   * would 404 the same way and still spend the limit. Only this invoice with no PIX (or an
   * expired one) falls through to the POST.
   */
  async payInvoice(id: string): Promise<InvoicePixPayment> {
    const invoice = await this.getInvoice(id);
    if (invoice.status === 'paid') throw new ValidationError(`Invoice ${id} is already paid.`);

    const track = invoice.track === 'whatsapp' ? 'whatsapp' : 'sales';
    const pixUrl = `/api/billing/pix?track=${track}`;

    const open = await this.http.get<InvoicePixResponse>(pixUrl);
    if (!open.invoiceId) throw noPixToPay(id, track);
    if (open.invoiceId !== id) throw notTheOpenInvoice(id, open.invoiceId);
    if (open.pix && new Date(open.pix.expiresAt).getTime() > Date.now()) {
      return toPixPayment(open, open.pix);
    }

    let answer: InvoicePixResponse;
    try {
      answer = await this.http.post<InvoicePixResponse>(pixUrl);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 429) {
        throw new ValidationError('Too many PIX requests for this invoice (10 per hour). The PIX already issued is still valid: wait and try again.');
      }
      if (error instanceof ApiError && error.statusCode === 422) {
        throw new ValidationError('The payment gateway refused to issue the invoice PIX. Ask the seller to check the e-mail on their profile, then try again.');
      }
      throw error;
    }

    if (!answer.invoiceId || !answer.pix) {
      throw noPixToPay(id, track);
    }
    if (answer.invoiceId !== id) throw notTheOpenInvoice(id, answer.invoiceId);
    return toPixPayment(answer, answer.pix);
  }

  /**
   * Two statements, one answer. `/api/billing/credit` is the legacy one and answers an empty list
   * for a seller on the new generation (a true "no legacy PIX credits", not an error); the real
   * statement for those lives in `/api/billing/credit-ledger`, which answers an empty page for a
   * seller still on the old one. Reading both is what the dashboard does, and it means the caller
   * does not have to know which generation the account is on — the side that has data answers.
   *
   * One side failing does not discard the other: that side comes back empty with its error next
   * to it (`creditsError` / `ledgerError`), so an outage never reads as "no credits".
   */
  async listCredits(options?: { status?: string; limit?: number; before?: string }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const qs = params.toString();

    const ledgerParams = new URLSearchParams();
    if (options?.limit) ledgerParams.append('limit', options.limit.toString());
    if (options?.before) ledgerParams.append('before', options.before);
    const ledgerQs = ledgerParams.toString();

    const [legacy, ledger] = await Promise.allSettled([
      this.http.get<{ credits: BillingCredit[]; total: number }>(`/api/billing/credit${qs ? `?${qs}` : ''}`),
      this.http.get<CreditLedgerPage>(`/api/billing/credit-ledger${ledgerQs ? `?${ledgerQs}` : ''}`),
    ]);
    if (legacy.status === 'rejected' && ledger.status === 'rejected') throw legacy.reason;

    return {
      credits: legacy.status === 'fulfilled' ? legacy.value.credits : [],
      total: legacy.status === 'fulfilled' ? legacy.value.total : 0,
      ...(legacy.status === 'rejected' ? { creditsError: errorMessage(legacy.reason) } : {}),
      ledger: ledger.status === 'fulfilled' ? ledger.value : { entries: [], nextBefore: null },
      ...(ledger.status === 'rejected' ? { ledgerError: errorMessage(ledger.reason) } : {}),
    };
  }

  /**
   * The legacy route refuses a migrated seller with 409 ("use POST /api/billing/credit/topup"),
   * and the new route is the only one that reaches the Postgres balance. Trying the legacy one
   * first and following the 409 keeps both generations working without the MCP having to know
   * which one the account is on; the 409 is a refusal, so nothing was written when it happens.
   * Only a 409 that names the top-up route is followed — any other conflict is the caller's to see.
   */
  async addCredit(amountCents: number, idempotencyKey?: string): Promise<CreditTopup> {
    try {
      const legacy = await this.http.post<{
        success: boolean; creditId: string; qrCode: string; qrCodeImage: string; expiresAt: string;
      }>('/api/billing/credit', { amountCents });
      return {
        creditId: legacy.creditId,
        amountCents,
        pixCode: legacy.qrCode ?? null,
        pixQrBase64: legacy.qrCodeImage ?? null,
        expiresAt: legacy.expiresAt ?? null,
        via: 'legacy',
      };
    } catch (error) {
      const movedToTopup = error instanceof ApiError
        && error.statusCode === 409
        && error.message.includes(TOPUP_ROUTE);
      if (!movedToTopup) throw error;
      const topup = await this.http.post<{
        topupId: string;
        amountCents: number;
        pix: { emv: string; qrBase64: string; expiresAt: string } | null;
      }>(TOPUP_ROUTE, {
        amountCents,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
      return {
        creditId: topup.topupId,
        amountCents: topup.amountCents,
        pixCode: topup.pix?.emv ?? null,
        pixQrBase64: topup.pix?.qrBase64 ?? null,
        expiresAt: topup.pix?.expiresAt ?? null,
        via: 'topup',
      };
    }
  }

  /** The current top-up on the new billing; `{ topup: null }` when there is none. */
  async getCreditTopup(): Promise<PendingCreditTopup | null> {
    const data = await this.http.get<{
      topupId?: string;
      amountCents?: number;
      status?: PendingCreditTopup['status'];
      pix?: { emv: string; qrBase64: string; expiresAt: string } | null;
    }>(TOPUP_ROUTE);
    if (!data.topupId) return null;
    return {
      creditId: data.topupId,
      amountCents: data.amountCents ?? 0,
      status: data.status ?? 'pending',
      pixCode: data.pix?.emv ?? null,
      pixQrBase64: data.pix?.qrBase64 ?? null,
      expiresAt: data.pix?.expiresAt ?? null,
    };
  }

  async getCardStatus() {
    const data = await this.http.get<{ hasCard: boolean; card?: BillingCard; isExpiringSoon: boolean }>('/api/billing/card/status');
    return sanitizeBillingCard(data);
  }

  async removeCard(): Promise<void> {
    await this.http.delete('/api/billing/card/status');
  }
}
