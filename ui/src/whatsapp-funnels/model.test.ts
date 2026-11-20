import { describe, expect, it } from 'vitest';
import {
  applyStoreStyle, formatWait, messageParts, sendWindowLabel, summarizeFunnel, summarizeFunnels, toggleWords, triggerTakenBy, waitLabel, type FunnelRow,
} from './model';

const summary = { id: 'f1', name: 'Carrinho', trigger: 'abandoned_cart', isEnabled: true, sessionGroupId: null, stepCount: 2, createdAt: 'x', updatedAt: 'x' };
const row = (id: string, extra: Partial<FunnelRow>): FunnelRow => ({ id, name: id, trigger: 'abandoned_cart', isEnabled: false, stepCount: 1, sessionId: null, ...extra });

describe('summarizeFunnels / summarizeFunnel', () => {
  it('reads a page of funnels with its cursor', () => {
    expect(summarizeFunnels({ items: [summary, { ...summary, id: 'f2', trigger: 'manual', sessionGroupId: 'g1', name: '' }], nextAfter: '17_abc' })).toEqual({
      funnels: [
        { id: 'f1', name: 'Carrinho', trigger: 'abandoned_cart', isEnabled: true, stepCount: 2, sessionId: null },
        { id: 'f2', name: 'Funil sem nome', trigger: 'manual', isEnabled: true, stepCount: 2, sessionId: 'g1' },
      ],
      nextAfter: '17_abc',
    });
  });

  it('reads one funnel with its steps, window and store style', () => {
    const funnel = summarizeFunnel({ funnel: { ...summary, steps: [{ waitMinutes: 30, text: 'Oi', markSeen: true, showTyping: true }], stopOnReply: true, sendWindow: { start: 8, end: 21 }, signature: 'Equipe', coupon: 'VOLTA10', useEmoji: false } });
    expect(funnel).toMatchObject({ stepCount: 1, steps: [{ waitMinutes: 30, text: 'Oi' }], stopOnReply: true, sendWindow: { start: 8, end: 21 }, style: { signature: 'Equipe', coupon: 'VOLTA10', useEmoji: false } });
  });

  it('refuses shapes that are not funnels (the inbox and the quiz funnel included)', () => {
    expect(summarizeFunnels({ items: [{ id: 'c1', name: 'x' }], nextAfter: null })).toBeNull();
    expect(summarizeFunnels({ items: [] })).toBeNull();
    expect(summarizeFunnel({ funnel: { id: 'f1' } })).toBeNull();
    expect(summarizeFunnel({ steps: [], totalVisitors: 0 })).toBeNull();
  });
});

describe('words of the funnel screen', () => {
  it('formats a wait as the editor does', () => {
    expect([0, 15, 60, 90, 1440, 2880].map(formatWait)).toEqual(['na hora', '15 min', '1 h', '1 h 30 min', '1 dia', '2 dias']);
  });

  it('counts the first wait from the event and the next ones from the previous message', () => {
    expect(waitLabel({ waitMinutes: 30, text: '' }, 0, 'pix_unpaid')).toBe('Espera 30 min depois do PIX gerado');
    expect(waitLabel({ waitMinutes: 1440, text: '' }, 1, 'pix_unpaid')).toBe('Espera 1 dia depois da mensagem anterior');
    expect(waitLabel({ waitMinutes: 0, text: '' }, 0, 'manual')).toBe('Na hora, depois de iniciar pela caixa');
  });

  it('words the send window and the on/off of manual and automatic funnels', () => {
    expect(sendWindowLabel({ start: 8, end: 21 })).toBe('Envia das 8h às 21h (Brasília)');
    expect(sendWindowLabel(null)).toBe('Envia a qualquer hora');
    expect(toggleWords({ trigger: 'manual', isEnabled: true })).toEqual({ state: 'Ligado', action: 'Tirar da caixa' });
    expect(toggleWords({ trigger: 'manual', isEnabled: false })).toEqual({ state: 'Desligado', action: 'Disponível na caixa' });
    expect(toggleWords({ trigger: 'pix_unpaid', isEnabled: false })).toEqual({ state: 'Desligado', action: 'Ligar' });
  });
});

describe('applyStoreStyle / messageParts', () => {
  const style = { signature: 'Equipe Aurora', coupon: 'VOLTA10', useEmoji: true };

  it('fills signature and coupon and keeps the event variables', () => {
    expect(applyStoreStyle('Oi {{customer_name}}, use {{ cupom }}. {{assinatura}}', style)).toBe('Oi {{customer_name}}, use VOLTA10. Equipe Aurora');
    expect(applyStoreStyle('{{assinatura}}', { ...style, signature: ' ' })).toBe('a equipe');
  });

  it('takes the emoji out for a store that does not use them', () => {
    expect(applyStoreStyle('Oi 👀 tudo bem? 🎉', { ...style, useEmoji: false })).toBe('Oi tudo bem?');
  });

  it('marks the variables so they never render as markup', () => {
    expect(messageParts('Oi {{customer_name}}!')).toEqual([
      { text: 'Oi ', isVariable: false }, { text: '{{customer_name}}', isVariable: true }, { text: '!', isVariable: false },
    ]);
  });
});

describe('triggerTakenBy', () => {
  it('names the enabled funnel that holds an automatic trigger', () => {
    const on = row('on', { isEnabled: true });
    expect(triggerTakenBy(row('off', {}), [on, row('off', {})])).toBe(on);
    expect(triggerTakenBy(row('off', { trigger: 'pix_unpaid' }), [on])).toBeNull();
  });

  it('never blocks a manual funnel or turning one off', () => {
    expect(triggerTakenBy(row('m', { trigger: 'manual' }), [row('m2', { trigger: 'manual', isEnabled: true })])).toBeNull();
    expect(triggerTakenBy(row('on2', { isEnabled: true }), [row('on', { isEnabled: true })])).toBeNull();
  });
});
