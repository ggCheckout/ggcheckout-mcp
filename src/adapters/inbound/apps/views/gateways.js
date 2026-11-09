// Gateway names and logos as the seller dashboard shows them: a copy of GATEWAY_DISPLAY_NAMES and
// GATEWAY_LOGOS (saas-checkout types/gateway.ts), logos copied unchanged from public/images/gateways.
// `art:` paths become inline images when the view is built. A gateway missing here falls back to its
// id and its initial, like GatewayLogo does.

export const GATEWAY_NAMES = {
  pushinpay: 'PushInPay', amplopay: 'Amplopay', mercadopago: 'Mercado Pago', efibank: 'EfiBank',
  tribopay: 'TriboPay', paradisepags: 'ParadisePags', nitropagamentos: 'Nitro Pagamentos', stripe: 'Stripe',
  trexpay: 'TrexPay', payevo: 'Payevo', abacatepay: 'AbacatePay', buckpay: 'BuckPay', brutalcash: 'Brutal Cash',
  pagouai: 'PagouAI', pagarme: 'Pagar.me', syncpay: 'SyncPay', appmax: 'Appmax', appmaxv2: 'Appmax V2',
  hisounique: 'Hiso Pagamentos', bestfy: 'Bestfy', beehive: 'Beehive', zuckpay: 'ZuckPay', payout: 'Payout',
  ironpay: 'IronPay', sigilopay: 'SigiloPay', asaas: 'Asaas', sillientpay: 'SillientPay', paypal: 'PayPal',
  adyen: 'Adyen',
};

const GATEWAY_LOGOS = {
  abacatepay: 'art:gw-abacatepay.avif', adyen: 'art:gw-adyen.avif', amplopay: 'art:gw-amplopay.avif',
  appmax: 'art:gw-appmax.avif', appmaxv2: 'art:gw-appmaxv2.avif', asaas: 'art:gw-asaas.avif',
  beehive: 'art:gw-beehive.avif', bestfy: 'art:gw-bestfy.avif', brutalcash: 'art:gw-brutalcash.avif',
  buckpay: 'art:gw-buckpay.avif', efibank: 'art:gw-efibank.avif', hisounique: 'art:gw-hisounique.avif',
  ironpay: 'art:gw-ironpay.avif', mercadopago: 'art:gw-mercadopago.avif',
  nitropagamentos: 'art:gw-nitropagamentos.avif', pagarme: 'art:gw-pagarme.avif', pagouai: 'art:gw-pagouai.avif',
  paradisepags: 'art:gw-paradisepags.avif', payevo: 'art:gw-payevo.avif', payout: 'art:gw-payout.avif',
  paypal: 'art:gw-paypal.avif', pushinpay: 'art:gw-pushinpay.avif', sigilopay: 'art:gw-sigilopay.avif',
  sillientpay: 'art:gw-sillientpay.avif', stripe: 'art:gw-stripe.avif', syncpay: 'art:gw-syncpay.avif',
  trexpay: 'art:gw-trexpay.avif', tribopay: 'art:gw-tribopay.avif', zuckpay: 'art:gw-zuckpay.avif',
};

/** The dashboard's method icons (`DashboardAssetIcon`). */
export const METHOD_ICONS = { pix: 'art:icon-pix.avif', card: 'art:icon-card.avif', gateway: 'art:icon-gateway.avif' };

const ALIASES = { efi: 'efibank' };

export function gatewayId(raw) {
  const id = String(raw ?? '').trim().toLowerCase();
  return ALIASES[id] ?? id;
}

export function gatewayName(raw) {
  const id = gatewayId(raw);
  return GATEWAY_NAMES[id] ?? (id || 'Gateway');
}

export function gatewayLogo(raw) {
  return GATEWAY_LOGOS[gatewayId(raw)] ?? null;
}
