import type { AuthPort } from '../ports/auth.port.js';
import type { TrackingPort } from '../ports/tracking.port.js';
import { diagnoseTracking, topSubjects } from '../tracking/diagnose.js';
import { disabledReasonText, maskId } from '../tracking/text.js';
import {
  TRACKING_CHANNELS,
  type ChannelErrors,
  type DiagnoseTrackingInput,
  type TrackingChannel,
  type TrackingDiagnosis,
  type TrackingErrorSummary,
  type TrackingScope,
  type TrackingToken,
  type TrackingTokenView,
} from '../types/tracking.js';

const ERROR_HOURS = 24;
const ERROR_LIMIT = 50;

function toTokenView(token: TrackingToken): TrackingTokenView {
  return {
    id: token.id,
    title: token.title,
    channel: token.channel,
    trackingMode: token.trackingMode,
    status: token.status,
    pixelId: maskId(token.pixelId),
    health: token.health && { ...token.health, disabledReasonText: disabledReasonText(token.health.disabledReason) },
  };
}

function summarizeErrors(errors: ChannelErrors | null): TrackingErrorSummary {
  if (!errors) return { available: false, hours: ERROR_HOURS, total: 0, subjects: [] };
  return { available: true, hours: errors.hours, total: errors.rows.length, subjects: topSubjects(errors.rows, 5) };
}

export class TrackingService {
  constructor(
    private readonly port: TrackingPort,
    private readonly authPort: AuthPort,
  ) {}

  async diagnose(input: DiagnoseTrackingInput): Promise<TrackingDiagnosis> {
    const { checkoutId, funnelId, paymentId } = input;
    const businessId = await this.authPort.getMyBusinessId();
    const needCheckouts = Boolean(checkoutId) || (!funnelId && !paymentId);

    const [tokens, allCheckouts, funnel, payment, errorList] = await Promise.all([
      this.port.listTokens(businessId),
      needCheckouts ? this.port.listCheckouts(businessId) : Promise.resolve([]),
      funnelId ? this.port.getFunnel(funnelId) : Promise.resolve(null),
      paymentId ? this.port.getPayment(businessId, paymentId) : Promise.resolve(null),
      Promise.all(TRACKING_CHANNELS.map((c) => this.port.listChannelErrors(c, ERROR_HOURS, ERROR_LIMIT))),
    ]);
    const errors = Object.fromEntries(TRACKING_CHANNELS.map((c, i) => [c, errorList[i]])) as Record<TrackingChannel, ChannelErrors | null>;

    const checkout = checkoutId ? allCheckouts.find((c) => c.id === checkoutId) : undefined;
    const checkouts = checkoutId ? (checkout ? [checkout] : []) : allCheckouts;

    const scope: TrackingScope = checkoutId
      ? { kind: 'checkout', checkoutId, title: checkout?.title }
      : funnelId
        ? { kind: 'funnel', funnelId, title: funnel?.title }
        : paymentId
          ? { kind: 'payment', paymentId }
          : { kind: 'account' };
    if (checkoutId && funnelId) scope.funnelId = funnelId;
    if (paymentId && scope.kind !== 'payment') scope.paymentId = paymentId;

    const findings = diagnoseTracking({
      scope,
      tokens,
      checkouts,
      missingCheckoutId: checkoutId && !checkout ? checkoutId : undefined,
      funnel,
      payment,
      errors,
    });

    const result: TrackingDiagnosis = {
      scope,
      findings,
      tokens: (tokens ?? []).map(toTokenView),
      errors: Object.fromEntries(TRACKING_CHANNELS.map((c) => [c, summarizeErrors(errors[c])])) as Record<TrackingChannel, TrackingErrorSummary>,
    };
    if (payment) {
      const { funnelId: _funnel, ...visible } = payment;
      result.payment = visible;
    }
    return result;
  }
}
