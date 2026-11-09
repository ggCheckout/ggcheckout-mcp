import { charts, chartsFor, creditTopup, paymentIntent, statsFor } from './fixtures';

export interface Scenario {
  id: string;
  /** What the seller asked, as the model would turn it into this call. */
  question: string;
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

const focus = (name: string) => ({ ...charts, focus: name });

export const SCENARIOS: Scenario[] = [
  { id: 'stats', question: 'Quanto vendi essa semana?', tool: 'get_dashboard_stats', args: { range: 'week' }, result: statsFor('week') },
  { id: 'revenue', question: 'Como foi o faturamento por dia?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'revenue' }, result: focus('revenue') },
  { id: 'approval', question: 'Qual a aprovação por gateway?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'approval' }, result: focus('approval') },
  { id: 'products', question: 'Quais produtos mais venderam?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'products' }, result: focus('products') },
  { id: 'states', question: 'De quais estados vêm as vendas?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'states' }, result: focus('states') },
  { id: 'refunds', question: 'Quantos reembolsos tive?', tool: 'get_dashboard_charts', args: { range: 'week', focus: 'refunds' }, result: focus('refunds') },
  { id: 'panel', question: 'Me mostra o painel completo', tool: 'get_dashboard_charts', args: { range: 'week' }, result: charts },
  { id: 'pix', question: 'Gera um PIX de R$ 49,90 (teste)', tool: 'create_pix_charge', args: { amount: 4990 }, result: paymentIntent('requires_action') },
  { id: 'topup', question: 'Coloca R$ 100 de crédito', tool: 'add_credit', args: { amountCents: 10000 }, result: creditTopup },
  { id: 'invoice-card', question: 'Paga a fatura no cartão', tool: 'pay_invoice', args: { invoiceId: 'inv_42', method: 'card' }, result: { success: true } },
];

/** Answers the app's tools/call like the server would, from the same fixtures. */
export function answerTool(name: string, args: Record<string, unknown>, polls: { count: number }): unknown {
  const range = String(args.range ?? 'week');
  switch (name) {
    case 'get_dashboard_stats': return statsFor(range);
    case 'get_dashboard_charts': return args.focus ? { ...chartsFor(range), focus: args.focus } : chartsFor(range);
    // The charge is paid on the third poll, so the preview shows the switch to "confirmed".
    case 'get_payment_intent': return paymentIntent(++polls.count >= 3 ? 'succeeded' : 'requires_action');
    case 'get_credit_topup': return { topup: { ...creditTopup, status: 'pending' } };
    default: throw new Error(`no fixture for ${name}`);
  }
}
