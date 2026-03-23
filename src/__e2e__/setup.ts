import dotenv from 'dotenv';
import { HttpClient } from '../adapters/outbound/http-client.js';
import { AuthApiAdapter } from '../adapters/outbound/auth.api.js';
import { ProductApiAdapter } from '../adapters/outbound/product.api.js';
import { PaymentApiAdapter } from '../adapters/outbound/payment.api.js';
import { CheckoutApiAdapter } from '../adapters/outbound/checkout.api.js';
import { WebhookApiAdapter } from '../adapters/outbound/webhook.api.js';
import { StoreApiAdapter } from '../adapters/outbound/store.api.js';
import { FunnelApiAdapter } from '../adapters/outbound/funnel.api.js';
import { DiscountApiAdapter } from '../adapters/outbound/discount.api.js';
import { BillingApiAdapter } from '../adapters/outbound/billing.api.js';
import { DashboardApiAdapter } from '../adapters/outbound/dashboard.api.js';
import { ProfileApiAdapter } from '../adapters/outbound/profile.api.js';

import { ProductService } from '../core/services/product.service.js';
import { PaymentService } from '../core/services/payment.service.js';
import { CheckoutService } from '../core/services/checkout.service.js';
import { WebhookService } from '../core/services/webhook.service.js';
import { StoreService } from '../core/services/store.service.js';
import { FunnelService } from '../core/services/funnel.service.js';
import { DiscountService } from '../core/services/discount.service.js';
import { BillingService } from '../core/services/billing.service.js';
import { DashboardService } from '../core/services/dashboard.service.js';
import { ProfileService } from '../core/services/profile.service.js';

dotenv.config();

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const API_KEY = process.env.GGCHECKOUT_API_KEY;
const API_URL = process.env.GGCHECKOUT_API_URL || 'https://www.ggcheckout.com';

if (!API_KEY || !API_KEY.startsWith('ggck_live_')) {
  throw new Error('E2E tests require GGCHECKOUT_API_KEY in .env');
}

const httpClient = new HttpClient(API_URL, API_KEY);
const authAdapter = new AuthApiAdapter(httpClient);

export const adapters = {
  auth: authAdapter,
  product: new ProductApiAdapter(httpClient),
  payment: new PaymentApiAdapter(httpClient),
  checkout: new CheckoutApiAdapter(httpClient),
  webhook: new WebhookApiAdapter(httpClient),
  store: new StoreApiAdapter(httpClient),
  funnel: new FunnelApiAdapter(httpClient),
  discount: new DiscountApiAdapter(httpClient, authAdapter),
  billing: new BillingApiAdapter(httpClient),
  dashboard: new DashboardApiAdapter(httpClient),
  profile: new ProfileApiAdapter(httpClient),
};

export const services = {
  product: new ProductService(adapters.product),
  payment: new PaymentService(adapters.payment, authAdapter),
  checkout: new CheckoutService(adapters.checkout, authAdapter),
  webhook: new WebhookService(adapters.webhook, authAdapter),
  store: new StoreService(adapters.store),
  funnel: new FunnelService(adapters.funnel),
  discount: new DiscountService(adapters.discount),
  billing: new BillingService(adapters.billing),
  dashboard: new DashboardService(adapters.dashboard),
  profile: new ProfileService(adapters.profile, authAdapter),
};
