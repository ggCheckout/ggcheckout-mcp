import { describe, expect, it } from 'vitest';
import {
  formatPeriodDay, initials, methodName, pageWindow, statusLabel, statusVariant, summarizePayment, summarizePaymentsCount, summarizePaymentsPage, countScope, pageSizeOf,
} from './model';
import { parseDate } from '../lib/format';

// Trimmed from what QA answered on 09/11/2026 (masked by the server, internal flags left out).
const paid = {
  id: 'e1f03c81', status: 'paid', paymentMethod: 'pix', gatewayName: 'mercadopago', value: 3.5,
  finalValueInCents: 350, installments: 1, name: 'Cliente Checkout', email: 'f***1@gmail.com',
  emailFormatted: null, payer_name: null, titleOffer: 'Teste novo produto', orderBumps: [],
  createdAt: '2026-11-06T19:34:18.164653+00:00', paidAt: '2026-11-06T19:34:41.088005+00:00',
};
const failed = { ...paid, id: '2685e40d', status: 'failed', gatewayName: 'sigilopay', value: 0.5, finalValueInCents: 50, paidAt: null };

describe('summarizePaymentsPage', () => {
  it('reads a page with its count and cursor', () => {
    const page = summarizePaymentsPage({ payments: [paid, failed], total: 2852, totalCapped: false, nextCursor: '2026-11-05T17:27|d9f6' })!;
    expect(page.payments.map((p) => [p.id, p.status, p.amountCents, p.gateway])).toEqual([
      ['e1f03c81', 'paid', 350, 'mercadopago'],
      ['2685e40d', 'failed', 50, 'sigilopay'],
    ]);
    expect(page).toMatchObject({ total: 2852, totalCapped: false, nextCursor: '2026-11-05T17:27|d9f6' });
  });

  it('takes the cents, and falls back to the reais only without them', () => {
    const { payments } = summarizePaymentsPage({ payments: [{ ...paid, finalValueInCents: undefined, value: 12.34 }] })!;
    expect(payments[0].amountCents).toBe(1234);
  });

  it('has no total when counting was skipped (0 with payments on the page)', () => {
    expect(summarizePaymentsPage({ payments: [paid], total: 0, nextCursor: null })!.total).toBeNull();
    expect(summarizePaymentsPage({ payments: [], total: 0 })!.total).toBe(0);
  });

  it('reads a bare list, with no cursor and no count', () => {
    expect(summarizePaymentsPage({ payments: [paid] })).toMatchObject({ nextCursor: null, total: null });
  });
});

describe('summarizePayment', () => {
  it('reads the get_payment envelope', () => {
    expect(summarizePayment({ payment: paid })).toMatchObject({ customerName: 'Cliente Checkout', offer: 'Teste novo produto', paidAt: paid.paidAt });
    expect(summarizePayment({ payments: [] })).toBeNull();
  });
});

describe('labels', () => {
  it('tones the badge like the dashboard, a raw failed staying neutral', () => {
    expect(['paid', 'expired', 'refunded', 'charged_back', 'failed', 'pending'].map(statusVariant))
      .toEqual(['paid', 'expired', 'failed', 'failed', 'pending', 'pending']);
  });

  it('names statuses with the legacy spellings mapped and unknown ones upper-cased', () => {
    expect([statusLabel('paid'), statusLabel('refounded'), statusLabel('canceled'), statusLabel('weird')])
      .toEqual(['Pago', 'Reembolsado', 'Cancelado', 'WEIRD']);
  });

  it('names methods', () => {
    expect([methodName('pix'), methodName('credit_card'), methodName(null), methodName('crypto')])
      .toEqual(['PIX', 'Cartão', 'Não informado', 'crypto']);
  });

  it('takes initials from the name, else from the e-mail', () => {
    expect([initials('Ana Souza', null), initials(null, 'joao.silva@x.com'), initials(null, 'f***1@gmail.com'), initials(null, null)])
      .toEqual(['AS', 'JS', 'F*', '?']);
  });

  it('reads the API dates, which carry microseconds', () => {
    expect(parseDate(paid.createdAt)?.toISOString()).toBe('2026-11-06T19:34:18.164Z');
  });

  it('reads order bump prices as cents', () => {
    expect(summarizePayment({ payment: { ...paid, orderBumps: [{ title: 'Planilha', priceCents: 1990 }, { name: 'Guia', price: 990 }] } })!.orderBumps)
      .toEqual([{ title: 'Planilha', amountCents: 1990 }, { title: 'Guia', amountCents: 990 }]);
  });
});

describe('pageWindow', () => {
  it('keeps the ends and the neighbors, with gaps as ellipses', () => {
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });
});

describe('formatPeriodDay', () => {
  it('keeps a bare date on its calendar day', () => {
    expect(formatPeriodDay('2026-11-01')).toBe('01/11/2026');
  });

  it('shows a timestamp in Sao Paulo time', () => {
    expect(formatPeriodDay('2026-11-01T01:00:00.000Z')).toBe('31/10/2026');
  });

  it('is null for anything else', () => {
    expect(formatPeriodDay('')).toBeNull();
    expect(formatPeriodDay(undefined)).toBeNull();
    expect(formatPeriodDay('garbage')).toBeNull();
  });
});

describe('summarizePaymentsCount', () => {
  it('reads a countOnly answer, which has a total and no payments', () => {
    expect(summarizePaymentsCount({ total: 42 })).toEqual({ total: 42, capped: false });
    expect(summarizePaymentsCount({ total: 5000, totalCapped: true })).toEqual({ total: 5000, capped: true });
    expect(summarizePaymentsPage({ total: 42 })).toBeNull();
  });

  it('ignores pages and other payloads', () => {
    expect(summarizePaymentsCount({ payments: [], total: 0 })).toBeNull();
    expect(summarizePaymentsCount({ total: 'x' })).toBeNull();
    expect(summarizePaymentsCount(null)).toBeNull();
  });

  it('describes what was counted from the args', () => {
    expect(countScope({ dateFrom: '2026-11-01', dateTo: '2026-11-10', status: 'paid', searchTerm: 'ana' }))
      .toEqual(['Período: 01/11/2026 - 10/11/2026', 'Status: Pago', 'Busca: "ana"']);
    expect(countScope({ status: 'all' })).toEqual([]);
  });
});

describe('pageSizeOf', () => {
  it('uses the default of the tool that was called', () => {
    expect(pageSizeOf('list_payments', {})).toBe(50);
    expect(pageSizeOf('get_payments_paginated', {})).toBe(10);
    expect(pageSizeOf(undefined, {})).toBe(10);
  });

  it('lets an explicit pageSize win, and reads an all walk at 100', () => {
    expect(pageSizeOf('list_payments', { pageSize: 20 })).toBe(20);
    expect(pageSizeOf('get_payments_paginated', { pageSize: 30 })).toBe(30);
    expect(pageSizeOf('list_payments', { all: true, pageSize: 20 })).toBe(100);
  });
});
