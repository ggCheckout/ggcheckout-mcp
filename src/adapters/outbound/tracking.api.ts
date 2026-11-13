import type { TrackingPort } from '../../core/ports/tracking.port.js';
import { clip } from '../../core/tracking/text.js';
import {
  TOKEN_TYPE_CHANNEL,
  TRACKING_CHANNELS,
  type ChannelDispatch,
  type ChannelErrorRow,
  type ChannelErrors,
  type DispatchDetail,
  type TokenHealth,
  type TrackingChannel,
  type TrackingCheckout,
  type TrackingFunnel,
  type TrackingMode,
  type TrackingPayment,
  type TrackingToken,
} from '../../core/types/tracking.js';
import { ApiError, NotFoundError } from '../../shared/errors.js';
import type { HttpClient } from './http-client.js';

type Raw = Record<string, unknown>;

const isRaw = (value: unknown): value is Raw => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const rows = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter(isRaw) : []);

/** A route this deployment does not have: 404 or 405, not a refusal. */
function isMissingRoute(error: unknown): boolean {
  return error instanceof ApiError && (error.statusCode === 404 || error.statusCode === 405);
}

const MODES: TrackingMode[] = ['pixel', 'events_api', 'both'];

function toHealth(raw: unknown): TokenHealth | null {
  if (!isRaw(raw)) return null;
  return {
    hasSucceeded: bool(raw.hasSucceeded),
    consecutiveFailures: num(raw.consecutiveFailures) ?? 0,
    disabledReason: clip(raw.disabledReason),
    disabledAt: str(raw.disabledAt),
    lastError: clip(raw.lastError),
  };
}

/**
 * A token without its credential: only what says where it points and how it is doing. `token`,
 * and anything else the route may add, never reaches the core.
 */
function toToken(raw: Raw): TrackingToken | null {
  const type = str(raw.type);
  const channel = type ? TOKEN_TYPE_CHANNEL[type] : undefined;
  const id = str(raw.id);
  if (!type || !channel || !id) return null;
  const mode = str(raw.trackingMode);
  return {
    id,
    title: str(raw.title) ?? id,
    type,
    channel,
    trackingMode: MODES.find((m) => m === mode) ?? null,
    status: str(raw.status),
    pixelId: str(raw.target),
    health: toHealth(raw.health),
  };
}

/** `metricToken` is one id or a list of them, depending on how the checkout was saved. */
function metricTokenIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.map(str).filter((id): id is string => id !== null);
}

function toCheckout(raw: Raw): TrackingCheckout | null {
  // `metricTokensByType` can carry a token ciphertext; it is never read.
  const id = str(raw.uid) ?? str(raw.publicId) ?? str(raw.id);
  if (!id) return null;
  return { id, title: str(raw.title) ?? id, metricTokenIds: metricTokenIds(raw.metricToken) };
}

function toDetail(raw: Raw): DispatchDetail {
  return { title: clip(raw.title, 80), code: str(raw.code), ok: bool(raw.ok), error: clip(raw.error) };
}

function toDispatch(raw: unknown): ChannelDispatch | null {
  if (!isRaw(raw)) return null;
  return {
    ok: bool(raw.ok),
    sent: num(raw.sent),
    failed: num(raw.failed),
    total: num(raw.total),
    event: str(raw.event),
    time: str(raw.time),
    details: rows(raw.details).map(toDetail),
  };
}

const UTM_VALUE_MAX = 120;

function toUtms(raw: Raw): Record<string, string> {
  const params = isRaw(raw.utmify) && isRaw(raw.utmify.params) ? raw.utmify.params : {};
  const utms: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const text = str(value);
    if (text) utms[key] = text.slice(0, UTM_VALUE_MAX);
  }
  return utms;
}

/**
 * A payment row cut down to attribution and event delivery. The row carries the buyer's name,
 * email, phone and document, so nothing is copied across by default: only the fields below are read.
 */
function toPayment(raw: Raw): TrackingPayment {
  const td = isRaw(raw.trackingDispatch) ? raw.trackingDispatch : null;
  let dispatch: TrackingPayment['dispatch'] = null;
  if (td) {
    dispatch = {};
    for (const channel of TRACKING_CHANNELS) {
      const entry = toDispatch(td[channel]);
      if (entry) dispatch[channel] = entry;
    }
  }
  return {
    id: str(raw.id) ?? '',
    status: str(raw.status),
    createdAt: str(raw.createdAt),
    funnelId: str(raw.funnelId) ?? (isRaw(raw.metadata) ? str(raw.metadata.funnelId) : null),
    utms: toUtms(raw),
    clickIds: { fbc: Boolean(str(raw.fbc)), fbp: Boolean(str(raw.fbp)), ttclid: Boolean(str(raw.ttclid)), ttp: Boolean(str(raw.ttp)) },
    dispatch,
    dispatchAt: td ? str(td.at) : null,
    dispatchSuccess: td ? bool(td.success) : null,
    flags: {
      created: td ? bool(td.metrics_create_dispatched) : null,
      paid: td ? bool(td.metrics_paid_dispatched) : null,
      refunded: td ? bool(td.metrics_refunded_dispatched) : null,
      chargedback: td ? bool(td.metrics_chargedback_dispatched) : null,
    },
  };
}

function toErrorRow(channel: TrackingChannel, raw: Raw): ChannelErrorRow {
  return {
    channel,
    paymentId: str(raw.paymentId),
    event: str(raw.event),
    subjectTitle: clip(raw.subjectTitle, 80),
    subjectCode: str(raw.subjectCode),
    errorCode: str(raw.errorCode),
    errorMessage: clip(raw.errorMessage),
    createdAt: str(raw.createdAt),
  };
}

export class TrackingApiAdapter implements TrackingPort {
  constructor(private readonly http: HttpClient) {}

  async listTokens(businessId: string): Promise<TrackingToken[] | null> {
    try {
      const data = await this.http.get<unknown>(`/api/get-clients/business/${encodeURIComponent(businessId)}/tokens`);
      const list = Array.isArray(data) ? data : isRaw(data) ? data.tokens : [];
      return rows(list).map(toToken).filter((t): t is TrackingToken => t !== null);
    } catch (error) {
      if (isMissingRoute(error)) return null;
      throw error;
    }
  }

  async listChannelErrors(channel: TrackingChannel, hours: number, limit: number): Promise<ChannelErrors | null> {
    const query = new URLSearchParams({ channel, hours: String(hours), limit: String(limit) });
    try {
      const data = await this.http.get<unknown>(`/api/integrations/errors?${query}`);
      const list = Array.isArray(data) ? data : isRaw(data) ? (data.errors ?? data.rows) : [];
      return { channel, hours, rows: rows(list).map((row) => toErrorRow(channel, row)) };
    } catch (error) {
      if (isMissingRoute(error)) return null;
      throw error;
    }
  }

  async listCheckouts(businessId: string): Promise<TrackingCheckout[]> {
    const query = new URLSearchParams({ uuidOwner: businessId });
    const data = await this.http.get<unknown>(`/api/checkouts?${query}`);
    return rows(data).map(toCheckout).filter((c): c is TrackingCheckout => c !== null);
  }

  async getFunnel(funnelId: string): Promise<TrackingFunnel> {
    const data = await this.http.get<{ funnel?: Raw }>(`/api/funnels/${encodeURIComponent(funnelId)}`);
    const funnel = data.funnel;
    if (!isRaw(funnel)) throw new NotFoundError('Funnel', funnelId);
    const settings = isRaw(funnel.settings) ? funnel.settings : {};
    const ids = isRaw(settings.pixelTokenIds) ? settings.pixelTokenIds : {};
    const tokenIds: TrackingFunnel['tokenIds'] = {};
    const facebook = str(ids.facebook_ads);
    const tiktok = str(ids.tiktok_ads);
    const google = str(ids.google_ads);
    if (facebook) tokenIds.facebook = facebook;
    if (tiktok) tokenIds.tiktok = tiktok;
    if (google) tokenIds.google = google;
    const utmify = isRaw(settings.utmify) ? settings.utmify : {};
    return {
      id: str(funnel.id) ?? funnelId,
      title: str(funnel.title) ?? funnelId,
      tokenIds,
      utmifyPixelId: str(utmify.pixelId),
    };
  }

  async getPayment(businessId: string, paymentId: string): Promise<TrackingPayment> {
    const data = await this.http.get<{ payments?: unknown }>(
      `/api/get-clients/business/${encodeURIComponent(businessId)}/payments/${encodeURIComponent(paymentId)}`,
    );
    const raw = rows(data.payments)[0];
    if (!raw) throw new NotFoundError('Payment', paymentId);
    return toPayment(raw);
  }
}
