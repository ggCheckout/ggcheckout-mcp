#!/usr/bin/env node

import dotenv from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as logger from './shared/logger.js';

// Outbound adapters
import { HttpClient } from './adapters/outbound/http-client.js';
import { AuthApiAdapter } from './adapters/outbound/auth.api.js';
import { ProductApiAdapter } from './adapters/outbound/product.api.js';
import { PaymentApiAdapter } from './adapters/outbound/payment.api.js';
import { CheckoutApiAdapter } from './adapters/outbound/checkout.api.js';
import { WebhookApiAdapter } from './adapters/outbound/webhook.api.js';
import { StoreApiAdapter } from './adapters/outbound/store.api.js';
import { FunnelApiAdapter } from './adapters/outbound/funnel.api.js';
import { MembersAreaApiAdapter } from './adapters/outbound/members-area.api.js';
import { DiscountApiAdapter } from './adapters/outbound/discount.api.js';
import { WhatsAppApiAdapter } from './adapters/outbound/whatsapp.api.js';
import { BillingApiAdapter } from './adapters/outbound/billing.api.js';
import { ShippingApiAdapter } from './adapters/outbound/shipping.api.js';
import { GatewayApiAdapter } from './adapters/outbound/gateway.api.js';
import { DiscordApiAdapter } from './adapters/outbound/discord.api.js';
import { DashboardApiAdapter } from './adapters/outbound/dashboard.api.js';
import { CustomDomainApiAdapter } from './adapters/outbound/custom-domain.api.js';
import { RewardsApiAdapter } from './adapters/outbound/rewards.api.js';
import { ProfileApiAdapter } from './adapters/outbound/profile.api.js';
import { PushApiAdapter } from './adapters/outbound/push.api.js';
import { TelegramApiAdapter } from './adapters/outbound/telegram.api.js';

// Services
import { ProductService } from './core/services/product.service.js';
import { PaymentService } from './core/services/payment.service.js';
import { CheckoutService } from './core/services/checkout.service.js';
import { WebhookService } from './core/services/webhook.service.js';
import { StoreService } from './core/services/store.service.js';
import { FunnelService } from './core/services/funnel.service.js';
import { MembersAreaService } from './core/services/members-area.service.js';
import { DiscountService } from './core/services/discount.service.js';
import { WhatsAppService } from './core/services/whatsapp.service.js';
import { BillingService } from './core/services/billing.service.js';
import { ShippingService } from './core/services/shipping.service.js';
import { GatewayService } from './core/services/gateway.service.js';
import { DiscordService } from './core/services/discord.service.js';
import { DashboardService } from './core/services/dashboard.service.js';
import { CustomDomainService } from './core/services/custom-domain.service.js';
import { RewardsService } from './core/services/rewards.service.js';
import { ProfileService } from './core/services/profile.service.js';
import { PushService } from './core/services/push.service.js';
import { TelegramService } from './core/services/telegram.service.js';

// Inbound adapters (MCP tools)
import { registerProductTools } from './adapters/inbound/tools/product.tools.js';
import { registerPaymentTools } from './adapters/inbound/tools/payment.tools.js';
import { registerCheckoutTools } from './adapters/inbound/tools/checkout.tools.js';
import { registerWebhookTools } from './adapters/inbound/tools/webhook.tools.js';
import { registerStoreTools } from './adapters/inbound/tools/store.tools.js';
import { registerFunnelTools } from './adapters/inbound/tools/funnel.tools.js';
import { registerMembersAreaTools } from './adapters/inbound/tools/members-area.tools.js';
import { registerDiscountTools } from './adapters/inbound/tools/discount.tools.js';
import { registerWhatsAppTools } from './adapters/inbound/tools/whatsapp.tools.js';
import { registerBillingTools } from './adapters/inbound/tools/billing.tools.js';
import { registerShippingTools } from './adapters/inbound/tools/shipping.tools.js';
import { registerGatewayTools } from './adapters/inbound/tools/gateway.tools.js';
import { registerDiscordTools } from './adapters/inbound/tools/discord.tools.js';
import { registerDashboardTools } from './adapters/inbound/tools/dashboard.tools.js';
import { registerCustomDomainTools } from './adapters/inbound/tools/custom-domain.tools.js';
import { registerRewardsTools } from './adapters/inbound/tools/rewards.tools.js';
import { registerProfileTools } from './adapters/inbound/tools/profile.tools.js';
import { registerPushTools } from './adapters/inbound/tools/push.tools.js';
import { registerTelegramTools } from './adapters/inbound/tools/telegram.tools.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const API_KEY = process.env.GGCHECKOUT_API_KEY;
const API_URL = process.env.GGCHECKOUT_API_URL || 'https://www.ggcheckout.com';

if (!API_KEY) {
  console.error('[MCP] Error: Missing required environment variable');
  console.error('[MCP] Please set GGCHECKOUT_API_KEY');
  console.error('[MCP] Example:');
  console.error('[MCP]   GGCHECKOUT_API_KEY=ggck_live_your_key_here');
  console.error('[MCP] Get your API key at: https://www.ggcheckout.com/');
  process.exit(1);
}

if (!API_KEY.startsWith('ggck_live_')) {
  console.error('[MCP] Error: Invalid API key format');
  console.error('[MCP] API key must start with "ggck_live_"');
  process.exit(1);
}

logger.info('STARTUP', 'Initializing GG Checkout MCP Server');
logger.info('STARTUP', `API URL: ${API_URL}`);

// --- Composition Root ---

// Infrastructure
const httpClient = new HttpClient(API_URL, API_KEY);

// Outbound adapters (driven)
const authAdapter = new AuthApiAdapter(httpClient);
const productAdapter = new ProductApiAdapter(httpClient, authAdapter);
const paymentAdapter = new PaymentApiAdapter(httpClient);
const checkoutAdapter = new CheckoutApiAdapter(httpClient);
const webhookAdapter = new WebhookApiAdapter(httpClient);
const storeAdapter = new StoreApiAdapter(httpClient);
const funnelAdapter = new FunnelApiAdapter(httpClient);
const membersAreaAdapter = new MembersAreaApiAdapter(httpClient);
const discountAdapter = new DiscountApiAdapter(httpClient, authAdapter);
const whatsappAdapter = new WhatsAppApiAdapter(httpClient);
const billingAdapter = new BillingApiAdapter(httpClient);
const shippingAdapter = new ShippingApiAdapter(httpClient);
const gatewayAdapter = new GatewayApiAdapter(httpClient, authAdapter);
const discordAdapter = new DiscordApiAdapter(httpClient);
const dashboardAdapter = new DashboardApiAdapter(httpClient);
const customDomainAdapter = new CustomDomainApiAdapter(httpClient);
const rewardsAdapter = new RewardsApiAdapter(httpClient);
const profileAdapter = new ProfileApiAdapter(httpClient);
const pushAdapter = new PushApiAdapter(httpClient);
const telegramAdapter = new TelegramApiAdapter(httpClient);

// Services (use cases)
const productService = new ProductService(productAdapter);
const paymentService = new PaymentService(paymentAdapter, authAdapter);
const checkoutService = new CheckoutService(checkoutAdapter, authAdapter);
const webhookService = new WebhookService(webhookAdapter, authAdapter);
const storeService = new StoreService(storeAdapter);
const funnelService = new FunnelService(funnelAdapter);
const membersAreaService = new MembersAreaService(membersAreaAdapter, authAdapter);
const discountService = new DiscountService(discountAdapter);
const whatsappService = new WhatsAppService(whatsappAdapter);
const billingService = new BillingService(billingAdapter);
const shippingService = new ShippingService(shippingAdapter);
const gatewayService = new GatewayService(gatewayAdapter);
const discordService = new DiscordService(discordAdapter);
const dashboardService = new DashboardService(dashboardAdapter);
const customDomainService = new CustomDomainService(customDomainAdapter);
const rewardsService = new RewardsService(rewardsAdapter);
const profileService = new ProfileService(profileAdapter, authAdapter);
const pushService = new PushService(pushAdapter, authAdapter);
const telegramService = new TelegramService(telegramAdapter);

// MCP Server
const server = new McpServer({
  name: 'ggcheckout-mcp',
  version: pkg.version,
});

// Inbound adapters (driving)
registerProductTools(server, productService);
registerPaymentTools(server, paymentService);
registerCheckoutTools(server, checkoutService);
registerWebhookTools(server, webhookService);
registerStoreTools(server, storeService);
registerFunnelTools(server, funnelService);
registerMembersAreaTools(server, membersAreaService);
registerDiscountTools(server, discountService);
registerWhatsAppTools(server, whatsappService);
registerBillingTools(server, billingService);
registerShippingTools(server, shippingService);
registerGatewayTools(server, gatewayService);
registerDiscordTools(server, discordService);
registerDashboardTools(server, dashboardService);
registerCustomDomainTools(server, customDomainService);
registerRewardsTools(server, rewardsService);
registerProfileTools(server, profileService);
registerPushTools(server, pushService);
registerTelegramTools(server, telegramService);

logger.info('STARTUP', 'All tools registered');

// Transport
const transport = new StdioServerTransport();
await server.connect(transport);

logger.info('STARTUP', 'Server started successfully');

async function shutdown(signal: string) {
  logger.info('SHUTDOWN', `Received ${signal}, shutting down gracefully`);
  const forceTimeout = setTimeout(() => {
    logger.error('SHUTDOWN', 'Graceful shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  try {
    await server.close();
    process.exit(0);
  } catch (err: any) {
    logger.error('SHUTDOWN', 'Error during shutdown', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
