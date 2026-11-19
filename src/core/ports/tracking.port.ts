import type {
  ChannelErrors,
  TrackingChannel,
  TrackingCheckout,
  TrackingFunnel,
  TrackingPayment,
  TrackingToken,
} from '../types/tracking.js';

/**
 * The reads behind `diagnose_tracking`. A route this deployment does not have yet answers `null`
 * (tokens, errors), so the diagnosis can say "não disponível ainda" instead of failing.
 */
export interface TrackingPort {
  listTokens(businessId: string): Promise<TrackingToken[] | null>;
  listChannelErrors(channel: TrackingChannel, hours: number, limit: number): Promise<ChannelErrors | null>;
  listCheckouts(businessId: string): Promise<TrackingCheckout[]>;
  getFunnel(funnelId: string): Promise<TrackingFunnel>;
  getPayment(businessId: string, paymentId: string): Promise<TrackingPayment>;
}
