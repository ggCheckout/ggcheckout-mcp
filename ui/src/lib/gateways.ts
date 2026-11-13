// Gateway names and logos as the seller dashboard shows them: a copy of GATEWAY_DISPLAY_NAMES and
// GATEWAY_LOGOS (saas-checkout types/gateway.ts), logos copied unchanged from public/images/gateways.
// A gateway missing here falls back to its id and its initial, like GatewayLogo does.

import cardIcon from '../art/icon-card.avif';
import gatewayIcon from '../art/icon-gateway.avif';
import pixIcon from '../art/icon-pix.avif';

const GATEWAY_NAMES: Record<string, string> = {
  pushinpay: 'PushInPay', amplopay: 'Amplopay', mercadopago: 'Mercado Pago', efibank: 'EfiBank',
  tribopay: 'TriboPay', paradisepags: 'ParadisePags', nitropagamentos: 'Nitro Pagamentos', stripe: 'Stripe',
  trexpay: 'TrexPay', payevo: 'Payevo', abacatepay: 'AbacatePay', buckpay: 'BuckPay', brutalcash: 'Brutal Cash',
  pagouai: 'PagouAI', pagarme: 'Pagar.me', syncpay: 'SyncPay', appmax: 'Appmax', appmaxv2: 'Appmax V2',
  hisounique: 'Hiso Pagamentos', bestfy: 'Bestfy', beehive: 'Beehive', zuckpay: 'ZuckPay', payout: 'Payout',
  ironpay: 'IronPay', sigilopay: 'SigiloPay', asaas: 'Asaas', sillientpay: 'SillientPay', paypal: 'PayPal',
  adyen: 'Adyen',
};

const LOGOS = import.meta.glob<string>('../art/gw-*.avif', { eager: true, import: 'default' });
const GATEWAY_LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(LOGOS).map(([path, src]) => [path.replace(/^.*gw-(.+)\.avif$/, '$1'), src])
);

/** The dashboard's method icons (`DashboardAssetIcon`). */
export const METHOD_ICONS: Record<string, string> = { pix: pixIcon, card: cardIcon, gateway: gatewayIcon };

const ALIASES: Record<string, string> = { efi: 'efibank' };

export function gatewayId(raw: unknown): string {
  const id = String(raw ?? '').trim().toLowerCase();
  return ALIASES[id] ?? id;
}

export function gatewayName(raw: unknown): string {
  const id = gatewayId(raw);
  return GATEWAY_NAMES[id] ?? (id || 'Gateway');
}

export function gatewayLogo(raw: unknown): string | null {
  return GATEWAY_LOGOS[gatewayId(raw)] ?? null;
}
