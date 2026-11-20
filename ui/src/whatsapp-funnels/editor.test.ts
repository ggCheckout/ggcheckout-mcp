import { describe, expect, it } from 'vitest';
import {
  FUNNEL_MODELS, bornEnabled, buildBeats, clipCodePoints, draftFrom, excerpt, funnelProblems, funnelVariables, insertStep, manualWaitMinutes,
  modelInput, modelSchedule, newDraft, sampleText, saveBlocked, shiftLayout, snapshotOf, stepTiming, toInput, unchangedSince, waitInUnit,
  type FunnelDraft,
} from './editor';
import type { FunnelDetail } from './model';

const stored: FunnelDetail = {
  id: 'f1', name: ' Carrinho ', trigger: 'abandoned_cart', isEnabled: true, stepCount: 2, sessionId: 'g1',
  steps: [
    { waitMinutes: 30, text: 'Oi {{customer_name}}', markSeen: true, showTyping: false },
    { waitMinutes: 1440, text: 'Use {{cupom}}', markSeen: false, showTyping: true },
  ],
  stopOnReply: true, sendWindow: { start: 8, end: 21 }, style: { signature: ' Equipe ', coupon: 'VOLTA10', useEmoji: true },
  layout: { start: { x: 0.4, y: 0 }, 'message-2': { x: 300, y: 10 }, 'wait-3': { x: 1, y: 1 } },
};

describe('toInput', () => {
  it('sends the whole funnel as the route stores it: trimmed, the pace of each step, the drawing of the steps that exist', () => {
    expect(toInput(draftFrom(stored))).toEqual({
      name: 'Carrinho', trigger: 'abandoned_cart', stopOnReply: true, sendWindow: { start: 8, end: 21 }, signature: 'Equipe', coupon: 'VOLTA10', useEmoji: true,
      steps: stored.steps, layout: { start: { x: 0, y: 0 }, 'message-2': { x: 300, y: 10 } },
    });
  });

  it('sends the operation only for a manual funnel', () => {
    expect(toInput({ ...draftFrom(stored), trigger: 'manual' }).sessionGroupId).toBe('g1');
    expect(toInput({ ...draftFrom(stored), trigger: 'manual', sessionId: null })).not.toHaveProperty('sessionGroupId');
  });
});

describe('unchangedSince (the re-read before Salvar)', () => {
  it('passes the same funnel, whatever its on/off', () => {
    expect(unchangedSince(stored, { ...stored, isEnabled: false })).toBe(true);
  });

  it('refuses a funnel edited elsewhere since it was shown', () => {
    expect(unchangedSince(stored, { ...stored, steps: [stored.steps[0]] })).toBe(false);
    expect(unchangedSince(stored, { ...stored, style: { ...stored.style, coupon: 'OUTRO' } })).toBe(false);
    expect(unchangedSince(stored, { ...stored, sendWindow: null })).toBe(false);
  });
});

describe('steps coming in and going out', () => {
  it('inserts at the index and keeps the drawing of each block with its step', () => {
    expect(insertStep(['a', 'b'], 1, 'x')).toEqual(['a', 'x', 'b']);
    expect(insertStep(['a'], 9, 'x')).toEqual(['a', 'x']);
    const layout = { start: { x: 0, y: 0 }, 'wait-1': { x: 1, y: 1 }, 'message-2': { x: 2, y: 2 } };
    expect(shiftLayout(layout, 1, 1)).toEqual({ start: { x: 0, y: 0 }, 'wait-1': { x: 1, y: 1 }, 'message-3': { x: 2, y: 2 } });
    expect(shiftLayout(layout, 0, -1)).toEqual({ start: { x: 0, y: 0 }, 'message-1': { x: 2, y: 2 } });
    expect(shiftLayout(null, 0, 1)).toBeNull();
  });

  it('notices a draft that differs from what was stored', () => {
    const draft = draftFrom(stored);
    expect(snapshotOf({ ...draft, steps: draft.steps.map((s) => ({ ...s, key: 'other' })) })).toBe(snapshotOf(draft));
    expect(snapshotOf({ ...draft, stopOnReply: false })).not.toBe(snapshotOf(draft));
  });
});

describe('waits', () => {
  it('takes only whole waits from 15 min to 2 days, in the largest exact unit', () => {
    expect([manualWaitMinutes('14', 'minutes'), manualWaitMinutes('15', 'minutes'), manualWaitMinutes('2', 'days'), manualWaitMinutes('3', 'days'), manualWaitMinutes('1.5', 'hours')])
      .toEqual([null, 15, 2880, null, null]);
    expect([90, 120, 2880].map(waitInUnit)).toEqual([{ amount: 90, unit: 'minutes' }, { amount: 2, unit: 'hours' }, { amount: 2, unit: 'days' }]);
    expect(stepTiming({ waitMinutes: 30 }, 0, 'pix_unpaid', 30)).toBe('30 min depois do PIX gerado · esperas somadas 30 min');
    expect(stepTiming({ waitMinutes: 1440 }, 1, 'pix_unpaid', 1470)).toBe('1 dia depois · esperas somadas 24 h 30 min');
  });
});

describe('what is missing', () => {
  const draft: FunnelDraft = { ...newDraft(null), name: ' ', trigger: 'manual' };

  it('names each problem, and a missing coupon only stops turning on', () => {
    expect(funnelProblems(draft)).toEqual(['Dê um nome ao funil.', 'A mensagem 1 está vazia.', 'Escolha a operação que envia.']);
    expect(saveBlocked(draft)).toBe(true);
    const withCoupon: FunnelDraft = { ...newDraft('g1'), steps: [{ ...newDraft('g1').steps[0], text: 'Use {{cupom}}' }] };
    expect(funnelProblems(withCoupon)).toEqual(['A mensagem 1 usa {{cupom}} e a loja não tem cupom.']);
    expect(saveBlocked(withCoupon)).toBe(false);
  });
});

describe('variables and the preview', () => {
  it('offers the event variables and the store ones; a manual funnel only knows the name', () => {
    expect(funnelVariables('manual').map((v) => v.key)).toEqual(['customer_name', 'assinatura', 'cupom']);
    expect(funnelVariables('pix_unpaid').map((v) => v.key)).toContain('pix_copia_cola');
    expect(funnelVariables('abandoned_cart').map((v) => v.label)).toEqual(['Nome do cliente', 'Nome do Produto', 'Valor', 'Link do Checkout', 'Link com Cupom', 'Assinatura', 'Cupom']);
    expect(sampleText('Oi {{ customer_name }}, {{desconhecida}}', funnelVariables('manual'))).toBe('Oi João Silva, {{desconhecida}}');
  });

  it('plays each wait, pushes a send outside the window to the next opening and ends the funnel', () => {
    const draft: FunnelDraft = { ...newDraft(null), sendWindow: { start: 8, end: 21 }, steps: [
      { key: 'a', waitMinutes: 30, text: 'A', markSeen: true, showTyping: true },
      { key: 'b', waitMinutes: 360, text: 'B', markSeen: true, showTyping: true },
    ] };
    expect(buildBeats(draft, (t) => t)).toEqual([
      { kind: 'pill', text: 'Carrinho abandonado · 30 min depois' },
      { kind: 'message', text: 'A', time: '15:42' },
      { kind: 'pill', text: '6 h depois' },
      { kind: 'pill', text: 'Fora do horário · espera mais 10 h 18 min até a próxima abertura' },
      { kind: 'message', text: 'B', time: '08:00' },
      { kind: 'end', text: 'Fim do funil' },
    ]);
  });

  it('cuts by code points, so an emoji is never split', () => {
    expect(clipCodePoints('ab👋c', 3)).toBe('ab👋');
    expect(excerpt('linha um\nlinha dois', 10)).toBe('linha um l…');
    expect(excerpt('dez letras', 10)).toBe('dez letras');
  });
});

describe('ready-made funnels', () => {
  it('creates a model off, sending 8h to 21h, with the pace on and the operation only when manual', () => {
    const cart = modelInput(FUNNEL_MODELS[0], 'g1');
    expect(cart).toMatchObject({ name: 'Carrinho abandonado', trigger: 'abandoned_cart', sendWindow: { start: 8, end: 21 }, layout: null });
    expect(cart).not.toHaveProperty('sessionGroupId');
    expect(cart.steps.every((s) => s.markSeen && s.showTyping)).toBe(true);
    expect(modelInput(FUNNEL_MODELS[3], 'g1').sessionGroupId).toBe('g1');
    expect(modelSchedule(FUNNEL_MODELS[0])).toBe('1ª 30 min depois do carrinho abandonado · próximas 3 h, 1 dia');
  });

  it('turns only the cart funnel on, and only when its trigger is free', () => {
    expect([bornEnabled('abandoned_cart', false), bornEnabled('abandoned_cart', true), bornEnabled('pix_unpaid', false)]).toEqual([true, false, false]);
  });
});
