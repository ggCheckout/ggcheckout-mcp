import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiKeyKind, type ApiKeyKind } from './shared/api-key.js';

// Outbound adapters
import { HttpClient } from './adapters/outbound/http-client.js';
import { AuthApiAdapter } from './adapters/outbound/auth.api.js';
import { ProductApiAdapter } from './adapters/outbound/product.api.js';
import { PaymentApiAdapter } from './adapters/outbound/payment.api.js';
import { CheckoutApiAdapter } from './adapters/outbound/checkout.api.js';
import { WebhookApiAdapter } from './adapters/outbound/webhook.api.js';
import { StoreApiAdapter } from './adapters/outbound/store.api.js';
import { FunnelApiAdapter } from './adapters/outbound/funnel.api.js';
import { MediaApiAdapter } from './adapters/outbound/media.api.js';
import { MembersAreaApiAdapter } from './adapters/outbound/members-area.api.js';
import { DiscountApiAdapter } from './adapters/outbound/discount.api.js';
import { WhatsAppApiAdapter } from './adapters/outbound/whatsapp.api.js';
import { WhatsAppFunnelApiAdapter } from './adapters/outbound/whatsapp-funnel.api.js';
import { WhatsAppInboxApiAdapter } from './adapters/outbound/whatsapp-inbox.api.js';
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
import { TrackingApiAdapter } from './adapters/outbound/tracking.api.js';

// Services
import { ProductService } from './core/services/product.service.js';
import { PaymentService } from './core/services/payment.service.js';
import { CheckoutService } from './core/services/checkout.service.js';
import { WebhookService } from './core/services/webhook.service.js';
import { StoreService } from './core/services/store.service.js';
import { FunnelService } from './core/services/funnel.service.js';
import { MediaService } from './core/services/media.service.js';
import { MembersAreaService } from './core/services/members-area.service.js';
import { DiscountService } from './core/services/discount.service.js';
import { WhatsAppService } from './core/services/whatsapp.service.js';
import { WhatsAppFunnelService } from './core/services/whatsapp-funnel.service.js';
import { WhatsAppInboxService } from './core/services/whatsapp-inbox.service.js';
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
import { TrackingService } from './core/services/tracking.service.js';
import { appOriginOf } from './core/tracking-links/index.js';

// Inbound adapters (MCP tools)
import { registerProductTools } from './adapters/inbound/tools/product.tools.js';
import { registerPaymentsApiToolsFromEnv } from './adapters/inbound/tools/payments-api.tools.js';
import { registerPaymentTools } from './adapters/inbound/tools/payment.tools.js';
import { registerCheckoutTools } from './adapters/inbound/tools/checkout.tools.js';
import { registerWebhookTools } from './adapters/inbound/tools/webhook.tools.js';
import { registerStoreTools } from './adapters/inbound/tools/store.tools.js';
import { registerFunnelTools } from './adapters/inbound/tools/funnel.tools.js';
import { registerMediaTools } from './adapters/inbound/tools/media.tools.js';
import { registerMembersAreaTools } from './adapters/inbound/tools/members-area.tools.js';
import { registerDiscountTools } from './adapters/inbound/tools/discount.tools.js';
import { registerWhatsAppTools } from './adapters/inbound/tools/whatsapp.tools.js';
import { registerWhatsAppFunnelTools } from './adapters/inbound/tools/whatsapp-funnel.tools.js';
import { registerWhatsAppInboxTools } from './adapters/inbound/tools/whatsapp-inbox.tools.js';
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
import { registerTrackingTools } from './adapters/inbound/tools/tracking.tools.js';
import { registerTrackingLinkTools } from './adapters/inbound/tools/tracking-link.tools.js';
import { WhatsAppAgentApiAdapter } from './adapters/outbound/whatsapp-agent.api.js';
import { WhatsAppAgentService } from './core/services/whatsapp-agent.service.js';
import { registerWhatsAppAgentTools } from './adapters/inbound/tools/whatsapp-agent.tools.js';
import { contactKey } from './adapters/inbound/tools/whatsapp-schemas.js';
import { registerAppViews } from './adapters/inbound/apps/apps.js';


export interface ServerOptions {
  apiKey: string;
  apiUrl: string;
  version: string;
  env: NodeJS.ProcessEnv;
}

export interface CreatedServer {
  server: McpServer;
  keyKind: ApiKeyKind;
  /** The payments API base URL when its tools are on (seller key with GG_PAYMENTS_API_KEY). */
  paymentsUrl?: string;
}

/**
 * The composition root. The key decides the tool set: a seller key (`ggck_live_`) gets every group
 * and the views; the WhatsApp assistant key (`ggck_agent_`) gets the agent tools and nothing else,
 * not even the payments API tools, so a model that reads customer messages has no other lever.
 * Throws on a malformed key, and on an agent key without a valid GGCHECKOUT_AGENT_CONTACT: the run
 * is pinned to that one conversation.
 */
export function createServer({ apiKey, apiUrl, version, env }: ServerOptions): CreatedServer {
  const keyKind = apiKeyKind(apiKey);
  const httpClient = new HttpClient(apiUrl, apiKey, version);
  const server = new McpServer({ name: 'ggcheckout-mcp', version });

  if (keyKind === 'agent') {
    registerWhatsAppAgentTools(server, new WhatsAppAgentService(new WhatsAppAgentApiAdapter(httpClient)), agentContact(env));
    return { server, keyKind };
  }

  registerSellerTools(server, httpClient, apiUrl, env);
  const paymentsUrl = registerPaymentsApiToolsFromEnv(server, env, version);
  return { server, keyKind, paymentsUrl };
}

/** The conversation an agent run is pinned to, in the same format the tools used to take as input. */
function agentContact(env: NodeJS.ProcessEnv): string {
  const parsed = contactKey.safeParse(env.GGCHECKOUT_AGENT_CONTACT);
  if (!parsed.success) {
    throw new Error('GGCHECKOUT_AGENT_CONTACT is required with a ggck_agent_ key: the conversation this run answers, as the inbox keys it '
      + '(the contact phone in digits with country code, a Brazilian mobile without the ninth digit, or a "lid:" WhatsApp id)');
  }
  return parsed.data;
}

function registerSellerTools(server: McpServer, httpClient: HttpClient, apiUrl: string, env: NodeJS.ProcessEnv): void {
  // Outbound adapters (driven)
  const authAdapter = new AuthApiAdapter(httpClient);
  const productAdapter = new ProductApiAdapter(httpClient, authAdapter);
  const paymentAdapter = new PaymentApiAdapter(httpClient);
  const checkoutAdapter = new CheckoutApiAdapter(httpClient);
  const webhookAdapter = new WebhookApiAdapter(httpClient);
  const storeAdapter = new StoreApiAdapter(httpClient);
  const funnelAdapter = new FunnelApiAdapter(httpClient);
  const trackingAdapter = new TrackingApiAdapter(httpClient);
  const mediaAdapter = new MediaApiAdapter(httpClient);
  const membersAreaAdapter = new MembersAreaApiAdapter(httpClient);
  const discountAdapter = new DiscountApiAdapter(httpClient, authAdapter);
  const whatsappAdapter = new WhatsAppApiAdapter(httpClient);
  const whatsappFunnelAdapter = new WhatsAppFunnelApiAdapter(httpClient);
  const whatsappInboxAdapter = new WhatsAppInboxApiAdapter(httpClient);
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
  const productService = new ProductService(productAdapter, apiUrl);
  const paymentService = new PaymentService(paymentAdapter, authAdapter);
  const checkoutService = new CheckoutService(checkoutAdapter, authAdapter, productAdapter);
  const webhookService = new WebhookService(webhookAdapter, authAdapter);
  const storeService = new StoreService(storeAdapter);
  const funnelService = new FunnelService(funnelAdapter);
  const trackingService = new TrackingService(trackingAdapter, authAdapter);
  const membersAreaService = new MembersAreaService(
    membersAreaAdapter,
    authAdapter,
    env.GGCHECKOUT_UPLOAD_ROOT || undefined,
  );
  const mediaService = new MediaService(mediaAdapter, env.GGCHECKOUT_UPLOAD_ROOT || undefined);
  const discountService = new DiscountService(discountAdapter);
  const whatsappService = new WhatsAppService(whatsappAdapter);
  const whatsappFunnelService = new WhatsAppFunnelService(whatsappFunnelAdapter);
  const whatsappInboxService = new WhatsAppInboxService(whatsappInboxAdapter);
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

  // Inbound adapters (driving)
  registerProductTools(server, productService);
  registerPaymentTools(server, paymentService);
  registerCheckoutTools(server, checkoutService);
  registerWebhookTools(server, webhookService);
  registerStoreTools(server, storeService);
  registerFunnelTools(server, funnelService);
  registerTrackingTools(server, trackingService);
  registerMembersAreaTools(server, membersAreaService);
  registerMediaTools(server, mediaService);
  registerDiscountTools(server, discountService);
  registerWhatsAppTools(server, whatsappService);
  registerWhatsAppFunnelTools(server, whatsappFunnelService);
  registerWhatsAppInboxTools(server, whatsappInboxService);
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
  registerTrackingLinkTools(
    server,
    { checkouts: checkoutService, funnels: funnelService, stores: storeService, domains: customDomainService },
    appOriginOf(apiUrl),
  );
  registerAppViews(server);
}
