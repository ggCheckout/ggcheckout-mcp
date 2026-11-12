import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaymentService } from './payment.service.js';
import { ValidationError } from '../../shared/errors.js';

describe('PaymentService.getSalesAttribution', () => {
  const answer = { from: 'f', to: 't', groupBy: [], rows: [], totals: {}, truncated: false };
  let port: any;
  let service: PaymentService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T12:00:00.000Z'));
    port = { getAttribution: vi.fn().mockResolvedValue(answer) };
    service = new PaymentService(port, { getMyBusinessId: vi.fn() });
  });
  afterEach(() => vi.useRealTimers());

  it('defaults to the last 7 days and to source, campaign and content', async () => {
    await service.getSalesAttribution('biz-1');

    expect(port.getAttribution).toHaveBeenCalledWith('biz-1', {
      from: '2026-11-05T12:00:00.000Z',
      to: '2026-11-12T12:00:00.000Z',
      groupBy: ['utm_source', 'utm_campaign', 'utm_content'],
    });
  });

  it('measures a missing `from` from the given `to`', async () => {
    await service.getSalesAttribution('biz-1', { to: '2026-10-10T00:00:00Z', groupBy: ['src'] });

    expect(port.getAttribution).toHaveBeenCalledWith('biz-1', {
      from: '2026-10-03T00:00:00.000Z', to: '2026-10-10T00:00:00.000Z', groupBy: ['src'],
    });
  });

  it('accepts exactly 90 days and refuses more, before calling the API', async () => {
    await service.getSalesAttribution('b', { from: '2026-08-14T12:00:00Z', to: '2026-11-12T12:00:00Z' });
    expect(port.getAttribution).toHaveBeenCalledTimes(1);

    await expect(service.getSalesAttribution('b', { from: '2026-08-13T12:00:00Z', to: '2026-11-12T12:00:00Z' }))
      .rejects.toThrow(/at most 90 days/);
    expect(port.getAttribution).toHaveBeenCalledTimes(1);
  });

  it('refuses an inverted or invalid period', async () => {
    await expect(service.getSalesAttribution('b', { from: '2026-11-12T00:00:00Z', to: '2026-11-01T00:00:00Z' }))
      .rejects.toThrow(/before/);
    await expect(service.getSalesAttribution('b', { from: 'yesterday' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses an empty, repeated or oversized groupBy', async () => {
    await expect(service.getSalesAttribution('b', { groupBy: [] })).rejects.toThrow(/1 to 3 distinct/);
    await expect(service.getSalesAttribution('b', { groupBy: ['src', 'src'] })).rejects.toThrow(/distinct/);
    await expect(service.getSalesAttribution('b', { groupBy: ['src', 'sck', 'utm_term', 'utm_source'] })).rejects.toThrow(/1 to 3/);
    expect(port.getAttribution).not.toHaveBeenCalled();
  });

  it('answers what the route answers', async () => {
    expect(await service.getSalesAttribution('b')).toBe(answer);
  });
});
