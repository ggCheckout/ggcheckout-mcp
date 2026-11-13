/** The channels a sale's metrics travel to. `google` is Google Ads, `facebook` is Meta. */
export const TRACKING_CHANNELS = ['facebook', 'tiktok', 'google', 'utmify'] as const;
export type TrackingChannel = (typeof TRACKING_CHANNELS)[number];

/** The vault token types that carry a tracking credential, and the channel each one feeds. */
export const TOKEN_TYPE_CHANNEL: Record<string, TrackingChannel> = {
  facebook_ads: 'facebook',
  tiktok_ads: 'tiktok',
  google_ads: 'google',
  utmify: 'utmify',
};

export type TrackingMode = 'pixel' | 'events_api' | 'both';
export type FindingSeverity = 'critical' | 'warning' | 'info' | 'ok';

export interface TrackingFinding {
  severity: FindingSeverity;
  code: string;
  title: string;
  detail: string;
  /** What to do about it. May hold a short checklist, one "- " line per step. */
  fix: string;
}

export interface TokenHealth {
  hasSucceeded: boolean | null;
  consecutiveFailures: number;
  disabledReason: string | null;
  disabledAt: string | null;
  lastError: string | null;
}

/**
 * A tracking credential without the credential: the id, what it feeds, how it fires and how it is
 * doing. `pixelId` is the pixel the token points to (the vault `target`); it never leaves the core
 * unmasked.
 */
export interface TrackingToken {
  id: string;
  title: string;
  type: string;
  channel: TrackingChannel;
  trackingMode: TrackingMode | null;
  status: string | null;
  pixelId: string | null;
  /** Null when the API does not send health yet. */
  health: TokenHealth | null;
}

export interface TrackingCheckout {
  id: string;
  title: string;
  /** Ids of the tracking tokens the checkout points to, whatever shape the API stored them in. */
  metricTokenIds: string[];
}

export interface TrackingFunnel {
  id: string;
  title: string;
  /** Token ids per platform (`pixelTokenIds` of the funnel settings). */
  tokenIds: Partial<Record<'facebook' | 'tiktok' | 'google', string>>;
  utmifyPixelId: string | null;
}

export interface DispatchDetail {
  title: string | null;
  code: string | null;
  ok: boolean | null;
  error: string | null;
}

export interface ChannelDispatch {
  ok: boolean | null;
  sent: number | null;
  failed: number | null;
  total: number | null;
  event: string | null;
  time: string | null;
  details: DispatchDetail[];
}

export interface DispatchFlags {
  created: boolean | null;
  paid: boolean | null;
  refunded: boolean | null;
  chargedback: boolean | null;
}

/** The tracking side of a payment row: no buyer data, only attribution and delivery of the events. */
export interface TrackingPayment {
  id: string;
  status: string | null;
  createdAt: string | null;
  funnelId: string | null;
  utms: Record<string, string>;
  /** Whether each click id was captured. The values identify a browser and are never returned. */
  clickIds: { fbc: boolean; fbp: boolean; ttclid: boolean; ttp: boolean };
  /** Null when the API does not send `trackingDispatch`. */
  dispatch: Partial<Record<TrackingChannel, ChannelDispatch>> | null;
  dispatchAt: string | null;
  dispatchSuccess: boolean | null;
  flags: DispatchFlags;
}

export interface ChannelErrorRow {
  channel: TrackingChannel;
  paymentId: string | null;
  event: string | null;
  subjectTitle: string | null;
  subjectCode: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string | null;
}

export interface ChannelErrors {
  channel: TrackingChannel;
  hours: number;
  rows: ChannelErrorRow[];
}

export interface DiagnoseTrackingInput {
  checkoutId?: string;
  funnelId?: string;
  paymentId?: string;
}

export type TrackingScopeKind = 'account' | 'checkout' | 'funnel' | 'payment';

export interface TrackingScope {
  kind: TrackingScopeKind;
  checkoutId?: string;
  funnelId?: string;
  paymentId?: string;
  /** What the scope points to: the checkout or funnel title. */
  title?: string;
}

/** Everything the rules read, already fetched. A route the API does not have yet is `null`. */
export interface DiagnosisContext {
  scope: TrackingScope;
  tokens: TrackingToken[] | null;
  /** The checkouts in scope: one, or every checkout on an account overview. */
  checkouts: TrackingCheckout[];
  /** A checkout that was asked for and is not in the seller's list. */
  missingCheckoutId?: string;
  funnel: TrackingFunnel | null;
  payment: TrackingPayment | null;
  errors: Record<TrackingChannel, ChannelErrors | null>;
}

export interface TrackingTokenView {
  id: string;
  title: string;
  channel: TrackingChannel;
  trackingMode: TrackingMode | null;
  status: string | null;
  /** First and last four characters. */
  pixelId: string | null;
  /** `disabledReasonText` is the pt-BR reading of the `disabledReason` code. */
  health: (TokenHealth & { disabledReasonText: string | null }) | null;
}

export interface TrackingErrorSummary {
  available: boolean;
  hours: number;
  total: number;
  subjects: Array<{ title: string | null; code: string | null; count: number; lastError: string | null; lastAt: string | null }>;
}

export interface TrackingDiagnosis {
  scope: TrackingScope;
  findings: TrackingFinding[];
  tokens: TrackingTokenView[];
  payment?: Omit<TrackingPayment, 'funnelId'>;
  errors?: Record<TrackingChannel, TrackingErrorSummary>;
}

export interface GuideItem { title: string; body: string }
export interface GuideSection { id: string; title: string; summary: string; items: GuideItem[] }
export interface GuideProblem { symptom: string; causes: string[]; fixes: string[] }
export type GuideTopic =
  | 'paths' | 'initiate_checkout' | 'purchase' | 'utms' | 'dedup' | 'funnel' | 'store' | 'errors';
export interface TrackingGuide {
  topic: GuideTopic | null;
  sections: GuideSection[];
  problems: GuideProblem[];
}
