import type { PaymentPort } from '../../core/ports/payment.port.js';
import type {
  Payment,
  PaymentsListResponse,
  PaymentsPaginatedResponse,
  PaginationOptions,
  FulfillmentResponse,
  FulfillmentData,
  UpdateFulfillmentInput,
  PaymentStatusCheckResponse,
} from '../../core/types/payment.js';
import { NotFoundError } from '../../shared/errors.js';
import { sanitizePayment } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

export class PaymentApiAdapter implements PaymentPort {
  constructor(private readonly http: HttpClient) {}

  async list(businessId: string): Promise<Payment[]> {
    const data = await this.http.get<PaymentsListResponse>(
      `/api/get-clients/business/${businessId}/payments`,
    );
    return data.payments.map(sanitizePayment);
  }

  async getPaginated(
    businessId: string,
    options?: PaginationOptions,
  ): Promise<PaymentsPaginatedResponse | { total: number }> {
    const params = new URLSearchParams();
    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
    if (options?.dateTo) params.append('dateTo', options.dateTo);
    if (options?.lastCreatedAt) params.append('lastCreatedAt', options.lastCreatedAt);
    if (options?.status && options.status !== 'all') params.append('status', options.status);
    if (options?.searchTerm) params.append('searchTerm', options.searchTerm);
    if (options?.countOnly) params.append('countOnly', 'true');

    const queryString = params.toString();
    const url = `/api/get-clients/business/${businessId}/payments/paginated${queryString ? `?${queryString}` : ''}`;

    const result = await this.http.get<PaymentsPaginatedResponse | { total: number }>(url);
    if ('payments' in result) {
      return { ...result, payments: result.payments.map(sanitizePayment) };
    }
    return result;
  }

  async getById(businessId: string, paymentId: string): Promise<Payment> {
    const payment = await this.http.get<Payment>(
      `/api/get-clients/business/${businessId}/payments/${paymentId}`,
    );

    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    return sanitizePayment(payment);
  }

  async getFulfillment(businessId: string, paymentId: string): Promise<FulfillmentResponse> {
    return this.http.get<FulfillmentResponse>(
      `/api/get-clients/business/${businessId}/payments/${paymentId}/fulfillment`,
    );
  }

  async updateFulfillment(
    businessId: string,
    paymentId: string,
    data: UpdateFulfillmentInput,
  ): Promise<{ success: boolean; fulfillment: FulfillmentData }> {
    return this.http.patch<{ success: boolean; fulfillment: FulfillmentData }>(
      `/api/get-clients/business/${businessId}/payments/${paymentId}/fulfillment`,
      data,
    );
  }

  async checkStatus(paymentId: string): Promise<PaymentStatusCheckResponse> {
    return this.http.get<PaymentStatusCheckResponse>(`/api/payments/check-payment/${paymentId}`);
  }
}
