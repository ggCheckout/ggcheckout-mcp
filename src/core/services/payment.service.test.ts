import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaymentService } from './payment.service.js';
import { RateLimitError, ValidationError } from '../../shared/errors.js';

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

describe('PaymentService.listAll', () => {
  const pageOf = (n: number, nextCursor: string | null, total = 450) => ({
    payments: [{ id: `p${n}` }], total, nextCursor,
  });
  let port: any;
  let sleep: ReturnType<typeof vi.fn>;
  let service: PaymentService;

  beforeEach(() => {
    port = { getPaginated: vi.fn() };
    sleep = vi.fn().mockResolvedValue(undefined);
    service = new PaymentService(port, { getMyBusinessId: vi.fn() } as any, sleep);
  });

  it('walks pages of 100 until the last one and reports the total of the first page', async () => {
    port.getPaginated
      .mockResolvedValueOnce(pageOf(1, 'c1', 3))
      .mockResolvedValueOnce(pageOf(2, 'c2', 2))
      .mockResolvedValueOnce(pageOf(3, null, 1));

    const answer = await service.listAll('biz');

    expect(answer).toEqual({ payments: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], total: 3, nextCursor: null, complete: true });
    expect(port.getPaginated.mock.calls).toEqual([
      ['biz', { pageSize: 100 }],
      ['biz', { pageSize: 100, lastCreatedAt: 'c1' }],
      ['biz', { pageSize: 100, lastCreatedAt: 'c2' }],
    ]);
  });

  it('stops after 5 pages and hands back the cursor', async () => {
    port.getPaginated.mockImplementation(async (_: string, o: any) => pageOf(1, `after-${o.lastCreatedAt ?? 'start'}`));

    const answer = await service.listAll('biz');

    expect(port.getPaginated).toHaveBeenCalledTimes(5);
    expect(answer.payments).toHaveLength(5);
    expect(answer.complete).toBe(false);
    expect(answer.nextCursor).toBe('after-after-after-after-after-start');
  });

  it('resumes from the given cursor', async () => {
    port.getPaginated.mockResolvedValue(pageOf(1, null));
    await service.listAll('biz', { lastCreatedAt: 'resume' });
    expect(port.getPaginated).toHaveBeenCalledWith('biz', { pageSize: 100, lastCreatedAt: 'resume' });
  });

  it('waits between pages and never before the first', async () => {
    port.getPaginated.mockResolvedValueOnce(pageOf(1, 'c1')).mockResolvedValueOnce(pageOf(2, null));
    sleep.mockImplementation(async () => expect(port.getPaginated).toHaveBeenCalledTimes(1));

    await service.listAll('biz');

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2500);

    sleep.mockClear();
    port.getPaginated.mockReset().mockResolvedValue(pageOf(1, null));
    await service.listAll('biz');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('keeps the pages read when the API rate-limits mid-walk', async () => {
    port.getPaginated
      .mockResolvedValueOnce(pageOf(1, 'c1'))
      .mockRejectedValueOnce(new RateLimitError());

    expect(await service.listAll('biz')).toEqual({
      payments: [{ id: 'p1' }], total: 450, nextCursor: 'c1', complete: false, stoppedBy: 'rate_limit',
    });
  });

  it('propagates a rate limit on the first page and any other error', async () => {
    port.getPaginated.mockRejectedValueOnce(new RateLimitError());
    await expect(service.listAll('biz')).rejects.toBeInstanceOf(RateLimitError);

    port.getPaginated.mockResolvedValueOnce(pageOf(1, 'c1')).mockRejectedValueOnce(new Error('boom'));
    await expect(service.listAll('biz')).rejects.toThrow('boom');
  });
});
