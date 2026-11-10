import { describe, expect, it } from 'vitest';
import {
  creditLevel, futureDayTime, invoiceAmount, summarizeInvoice, summarizeInvoices, summarizeLedger, summarizeWallet,
  usagePercent, usageTone,
} from './model';

// The shapes QA answered on 2026-11-10 for a seller on the new billing.
const status = {
  status: 'active', isDelinquent: false, graceStage: null, graceEndsAt: null, hasOverdueInvoice: false, isBlocked: false,
  hasValidCard: false, usesBillingGateway: true, isMigratedToPayments: true, paymentsCreditBalanceCents: 5,
  paymentsCreditLevel: 6, paymentsCreditTotalPaidCents: 483292, paymentsClosingAt: '2026-11-13T19:02:59.210836+00:00',
  paymentsOpenInvoice: null, paymentsUnbilledFeeCents: 0, paymentsUnbilledSaleCount: 0, paymentsCreditLimitCents: 10000,
  paymentsCapExposureCents: -5, billingStatus: 'active', usagePercent: 0, netBalanceCents: -5, limitCents: 10000,
};
const balance = {
  currentBalanceCents: 0, creditBalanceCents: 0, netBalanceCents: -5, level: 6, limitCents: 10000,
  limitWithToleranceCents: 11500, usagePercent: 0, usageCents: -5, usageLimitCents: 10000,
  closingAt: '2026-11-17T13:12:10.357Z', cycleStartAt: '2026-11-10T12:12:10.357Z',
};
const paidInvoice = {
  id: '191626b1', status: 'paid', createdAt: '2026-11-06T19:03:03.183Z', dueAt: '2026-11-06T19:02:59.210Z',
  paidAt: '2026-11-06T19:02:59.210Z', periodStart: '2026-10-30T19:02:59.210Z', periodEnd: '2026-11-06T19:02:59.210Z',
  creditAppliedCents: 62, feeGrossCents: 62, grossVolumeCents: 100, totalFeeCents: 62, transactionCount: 2,
  whatsappUsageCents: 0, sacOverageCents: 0,
};

describe('summarizeWallet', () => {
  it('reads the live payments credit from the status, not the frozen balance mirror', () => {
    const wallet = summarizeWallet(status)!;
    expect(wallet.signedNetCents).toBe(5);
    expect(wallet.usedCents).toBe(0);
    expect(wallet.limitWithToleranceCents).toBe(11500);
    expect(wallet.level).toBe(6);
    expect(wallet.closingAt).toBe(status.paymentsClosingAt);
    expect(wallet.overdue).toBe(false);
  });

  it('nets the open invoice instead of the unbilled fee, and flags it as overdue', () => {
    const wallet = summarizeWallet({
      ...status, hasOverdueInvoice: true, paymentsUnbilledFeeCents: 40,
      paymentsOpenInvoice: { invoiceId: 'inv', amountCents: 12000, status: 'overdue' },
    })!;
    expect(wallet.signedNetCents).toBe(5 - 12000);
    expect(wallet.usedCents).toBe(11995);
    expect(wallet.overdue).toBe(true);
    expect(wallet.openInvoiceCents).toBe(12000);
  });

  it('marks a blocked account as overdue too', () => {
    const wallet = summarizeWallet({ ...status, isBlocked: true, billingStatus: 'blocked' })!;
    expect(wallet.blocked).toBe(true);
    expect(wallet.overdue).toBe(true);
  });

  it('trusts netBalanceCents on the balance answer', () => {
    const wallet = summarizeWallet(balance)!;
    expect(wallet.signedNetCents).toBe(5);
    expect(wallet.limitWithToleranceCents).toBe(11500);
    // QA 2026-11-10: the balance said 17/11 (now + 7 days); the payments cycle closes on 13/11.
    expect(wallet.closingAt).toBeNull();
    expect(wallet.fromBalance).toBe(true);
    expect(wallet.totalPaidCents).toBeNull();
  });

  it('ignores other payloads', () => {
    expect(summarizeWallet({ netBalanceCents: 1 })).toBeNull();
    expect(summarizeWallet({ invoices: [] })).toBeNull();
  });
});

describe('usage', () => {
  it('takes the percent against the tolerance and the tone against the base limit', () => {
    const wallet = summarizeWallet({ ...status, paymentsCreditBalanceCents: 0, paymentsUnbilledFeeCents: 8000 })!;
    expect(usagePercent(wallet)).toBe(70);
    expect(usageTone(wallet.usedCents, wallet.limitCents)).toBe('warn');
    expect(usageTone(10000, 10000)).toBe('danger');
    expect(usageTone(100, 10000)).toBe('neutral');
  });
});

describe('creditLevel', () => {
  it('names the gem and the next one', () => {
    expect(creditLevel(2)).toEqual({ name: 'Bronze', autoScale: false, next: { name: 'Silver', limitCents: 2000, requiredPaidCents: 1500 } });
    expect(creditLevel(6)).toEqual({ name: 'Diamond', autoScale: true, next: null });
    expect(creditLevel(9)?.name).toBe('Diamond');
    expect(creditLevel(null)).toBeNull();
  });
});

describe('invoices', () => {
  it('shows the gross fee of a paid invoice and splits what credit paid', () => {
    const [row] = summarizeInvoices({ invoices: [paidInvoice], total: 1 })!;
    expect(row).toMatchObject({ grossCents: 62, creditAppliedCents: 62, netCents: 0, salesCount: 2, salesVolumeCents: 100 });
    expect(invoiceAmount(row)).toBe(62);
  });

  it('shows what is left to pay on an open invoice without feeGrossCents', () => {
    const { feeGrossCents: _, ...legacy } = paidInvoice;
    const row = summarizeInvoice({ invoice: { ...legacy, status: 'overdue', paidAt: null, totalFeeCents: 300, creditAppliedCents: 50 } })!;
    expect(row).toMatchObject({ grossCents: 350, creditAppliedCents: 50, netCents: 300 });
    expect(invoiceAmount(row)).toBe(300);
  });

  it('reads a born-paid invoice as paid entirely by credit', () => {
    const { feeGrossCents: _, ...legacy } = paidInvoice;
    expect(summarizeInvoice({ invoice: legacy })).toMatchObject({ grossCents: 62, creditAppliedCents: 62, netCents: 0 });
  });

  it('does not take a payment for an invoice', () => {
    expect(summarizeInvoice({ invoice: { id: 'x', status: 'paid' } })).toBeNull();
    expect(summarizeInvoices({ payments: [] })).toBeNull();
  });
});

describe('summarizeLedger', () => {
  const ledger = {
    credits: [], total: 0,
    ledger: {
      entries: [
        {
          id: 'l1', kind: 'cycle_debit', amountCents: -62, balanceAfterCents: 5, createdAt: '2026-11-06T19:03:03.183191+00:00',
          invoice: { invoiceId: 'i1', closedAt: '2026-11-06T19:02:59.210836+00:00', closeTrigger: 'time', grossCents: 62, creditAppliedCents: 62, remainingCents: 0 },
          pendingInvoice: null,
        },
        {
          id: 'l2', kind: 'debt_settled', amountCents: -252, balanceAfterCents: 248, createdAt: '2026-09-09T13:32:26.670084+00:00',
          invoice: { invoiceId: 'i2', closedAt: '2026-07-31T19:02:59.210836+00:00', closeTrigger: null, grossCents: null, creditAppliedCents: null, remainingCents: null },
          pendingInvoice: null,
        },
        {
          id: 'l3', kind: 'topup', amountCents: 500, balanceAfterCents: 500, createdAt: '2026-09-09T13:32:26.632351+00:00',
          invoice: null, pendingInvoice: { invoiceId: 'i2', amountCents: 252, shortfallCents: 0 },
        },
      ],
      nextBefore: '2026-09-09T13:32:26.632351+00:00|l3',
    },
  };

  it('draws a closing as its receipt, a settled debt by its invoice date and a top-up with its invoice', () => {
    const { rows, nextBefore } = summarizeLedger(ledger)!;
    expect(rows.map((r) => r.label)).toEqual(['Fatura fechada', 'Abatimento de débito', 'Crédito adicionado']);
    expect(rows[0].receipt).toEqual({ trigger: 'time', grossCents: 62, creditAppliedCents: 62, remainingCents: 0 });
    expect(rows[1].settledInvoiceAt).toBe('2026-07-31T19:02:59.210836+00:00');
    expect(rows[2].pending).toEqual({ amountCents: 252, shortfallCents: 0 });
    expect(nextBefore).toBe(ledger.ledger.nextBefore);
  });

  it('falls back to the legacy credits when the ledger is empty', () => {
    const legacy = summarizeLedger({
      credits: [{ id: 'c1', amountCents: 1000, status: 'confirmed', createdAt: '2026-01-01T10:00:00Z', confirmedAt: null }],
      total: 1, ledger: { entries: [], nextBefore: null },
    })!;
    expect(legacy.rows[0]).toMatchObject({ label: 'Crédito via PIX', amountCents: 1000, legacyStatus: 'Confirmado', balanceAfterCents: null });
    expect(legacy.nextBefore).toBeNull();
  });

  it('reports the side that failed', () => {
    expect(summarizeLedger({ credits: [], total: 0, ledger: { entries: [], nextBefore: null }, ledgerError: 'ledger down' })!.error).toBe('ledger down');
  });
});

describe('futureDayTime', () => {
  it('drops a deadline that already passed', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(futureDayTime('2026-11-09T12:00:00Z', now)).toBeNull();
    expect(futureDayTime('2026-11-11T12:00:00Z', now)).toMatch(/^11\/11\/2026 às \d{2}:00$/);
  });
});
