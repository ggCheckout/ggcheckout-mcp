import type { PaymentPort } from '../../core/ports/payment.port.js';
import type {
  Payment,
  PaymentsListResponse,
  PaymentsPaginatedResponse,
  PaginationOptions,
  FulfillmentData,
  PaymentStatusCheck,
} from '../../core/types/payment.js';
import { NotFoundError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

export class PaymentApiAdapter implements PaymentPort {
  constructor(private readonly http: HttpClient) {}

  async list(businessId: string): Promise<Payment[]> {
    const data = await this.http.get<PaymentsListResponse>(
      `/api/get-clients/business/${businessId}/payments`,
    );
    return data.payments;
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

    return this.http.get<PaymentsPaginatedResponse | { total: number }>(url);
  }

  async getById(businessId: string, paymentId: string): Promise<Payment> {
    const data = await this.http.get<PaymentsPaginatedResponse>(
      `/api/get-clients/business/${businessId}/payments/paginated?pageSize=1000`,
    );

    if (!data.payments || data.payments.length === 0) {
      throw new NotFoundError('Payment', paymentId);
    }

    const payment = data.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    return payment;
  }

  async getFulfillment(businessId: string, paymentId: string): Promise<FulfillmentData> {
    return this.http.get<FulfillmentData>(
      `/api/get-clients/business/${businessId}/payments/${paymentId}/fulfillment`,
    );
  }

  async updateFulfillment(businessId: string, paymentId: string, data: Partial<FulfillmentData>): Promise<FulfillmentData> {
    return this.http.patch<FulfillmentData>(
      `/api/get-clients/business/${businessId}/payments/${paymentId}/fulfillment`,
      data,
    );
  }

  async checkStatus(paymentId: string): Promise<PaymentStatusCheck> {
    return this.http.post<PaymentStatusCheck>(`/api/payments/check-payment/${paymentId}`);
  }
}
