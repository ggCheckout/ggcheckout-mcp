import { describe, expect, it } from 'vitest';
import { summarizeLink } from './model';

// Invented data, in the shape build_tracking_link answers.
const meta = {
  destination: { kind: 'checkout', url: 'https://pay.exemplo.com.br/checkout/ck_aurora', title: 'Método Aurora', customDomain: true },
  platform: 'meta',
  finalUrl: 'https://pay.exemplo.com.br/checkout/ck_aurora?utm_source=FB&utm_term={{placement}}',
  adParameters: 'utm_source=FB&utm_term={{placement}}',
  where: ['Cole a URL limpa.', 'Cole os parâmetros.'],
  notes: ['Não use "|".'],
  params: [{ key: 'utm_source', value: 'FB', source: 'template' }, { key: 'utm_term', value: '{{placement}}', source: 'template' }],
};

describe('summarizeLink', () => {
  it('reads a template link: pastes the ad parameters, names the platform and the destination', () => {
    const link = summarizeLink(meta)!;
    expect(link.platformLabel).toBe('Meta Ads');
    expect(link.paste).toEqual({ label: 'Parâmetros de URL', text: 'utm_source=FB&utm_term={{placement}}' });
    expect(link.destination).toMatchObject({ kindLabel: 'Checkout', customDomain: true, title: 'Método Aurora' });
    expect(link.params[1]).toEqual({ key: 'utm_term', value: '{{placement}}', source: 'template' });
  });

  it('google pastes the tracking template', () => {
    const link = summarizeLink({ ...meta, platform: 'google', adParameters: undefined, trackingTemplate: '{lpurl}?utm_source=google' })!;
    expect(link.paste).toEqual({ label: 'Modelo de acompanhamento', text: '{lpurl}?utm_source=google' });
  });

  it('manual pastes the whole link', () => {
    const link = summarizeLink({ ...meta, platform: 'manual', adParameters: 'utm_source=bio' })!;
    expect(link.paste).toEqual({ label: 'Link completo', text: meta.finalUrl });
  });

  it('falls back to the whole link when the answer lacks the platform text', () => {
    expect(summarizeLink({ ...meta, adParameters: undefined })!.paste.label).toBe('Link completo');
  });

  it('drops blank notes and steps and rows without a key or a string value; unknown source reads as manual', () => {
    const link = summarizeLink({
      ...meta,
      where: ['ok', '  ', 3],
      notes: [null, 'nota'],
      params: [{ key: '', value: 'x' }, { key: 'a', value: 5 }, { key: 'b', value: '1', source: 'weird' }],
    })!;
    expect(link.where).toEqual(['ok']);
    expect(link.notes).toEqual(['nota']);
    expect(link.params).toEqual([{ key: 'b', value: '1', source: 'manual' }]);
  });

  it('an unknown destination kind reads as an own link', () => {
    expect(summarizeLink({ ...meta, destination: { ...meta.destination, kind: 'x' } })!.destination.kindLabel).toBe('Link próprio');
  });

  it('is null for another answer', () => {
    expect(summarizeLink(null)).toBeNull();
    expect(summarizeLink({ stats: {} })).toBeNull();
    expect(summarizeLink({ ...meta, platform: 'orkut' })).toBeNull();
    expect(summarizeLink({ ...meta, finalUrl: '' })).toBeNull();
    expect(summarizeLink({ ...meta, destination: {} })).toBeNull();
  });
});
