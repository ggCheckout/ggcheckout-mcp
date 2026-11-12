import type { AuthPort } from '../ports/auth.port.js';
import type { PaymentPort } from '../ports/payment.port.js';
import type {
  Payment,
  PaymentsPaginatedResponse,
  PaginationOptions,
  FulfillmentResponse,
  FulfillmentData,
  UpdateFulfillmentInput,
  PaymentStatusCheckResponse,
  AttributionQuery,
  AttributionResponse,
} from '../types/payment.js';
import {
  ATTRIBUTION_DEFAULT_DAYS,
  ATTRIBUTION_MAX_DAYS,
  DEFAULT_ATTRIBUTION_GROUP_BY,
} from '../types/payment.js';
import { ValidationError } from '../../shared/errors.js';

export class PaymentService {
  constructor(
    private readonly paymentPort: PaymentPort,
    private readonly authPort: AuthPort,
  ) {}

  async getMyBusinessId(): Promise<string> {
    return this.authPort.getMyBusinessId();
  }

  async getPaginated(
    businessId: string,
    options?: PaginationOptions,
  ): Promise<PaymentsPaginatedResponse | { total: number }> {
    return this.paymentPort.getPaginated(businessId, options);
  }

  async getById(businessId: string, paymentId: string): Promise<Payment> {
    return this.paymentPort.getById(businessId, paymentId);
  }

  async getFulfillment(businessId: string, paymentId: string): Promise<FulfillmentResponse> {
    return this.paymentPort.getFulfillment(businessId, paymentId);
  }

  async updateFulfillment(
    businessId: string,
    paymentId: string,
    data: UpdateFulfillmentInput,
  ): Promise<{ success: boolean; fulfillment: FulfillmentData }> {
    return this.paymentPort.updateFulfillment(businessId, paymentId, data);
  }

  async checkStatus(paymentId: string): Promise<PaymentStatusCheckResponse> {
    return this.paymentPort.checkStatus(paymentId);
  }

  /**
   * Sales grouped by UTM / click-source keys. The period defaults to the last 7 days and is capped at 90,
   * and the group is 1 to 3 distinct keys: checked here so a bad request fails before the call, with a
   * message that says what to change.
   */
  async getSalesAttribution(businessId: string, query: AttributionQuery = {}): Promise<AttributionResponse> {
    const groupBy = query.groupBy ?? DEFAULT_ATTRIBUTION_GROUP_BY;
    if (groupBy.length < 1 || groupBy.length > 3 || new Set(groupBy).size !== groupBy.length) {
      throw new ValidationError('groupBy takes 1 to 3 distinct keys (utm_source, utm_medium, utm_campaign, utm_content, utm_term, src, sck).');
    }

    const day = 24 * 60 * 60 * 1000;
    const to = parseInstant('to', query.to) ?? new Date();
    const from = parseInstant('from', query.from) ?? new Date(to.getTime() - ATTRIBUTION_DEFAULT_DAYS * day);
    if (from >= to) throw new ValidationError('from must be before to.');
    if (to.getTime() - from.getTime() > ATTRIBUTION_MAX_DAYS * day) {
      throw new ValidationError(`The period is at most ${ATTRIBUTION_MAX_DAYS} days: narrow from and to.`);
    }

    return this.paymentPort.getAttribution(businessId, { from: from.toISOString(), to: to.toISOString(), groupBy });
  }
}

function parseInstant(name: string, value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${name} is not a valid ISO date: "${value}".`);
  return date;
}
