import { gatewayLogo, gatewayName } from './gateways';

/** A gateway's logo, or its initial when there is none. */
export function GatewayMark({ gateway, size = 28 }: { gateway: string | null; size?: number }) {
  const logo = gatewayLogo(gateway);
  return logo
    ? <img className="gw-logo" src={logo} width={size} height={size} alt="" />
    : <span className="gw-logo gw-logo-fallback" style={{ width: size, height: size }} aria-hidden>{gatewayName(gateway).charAt(0).toUpperCase()}</span>;
}
