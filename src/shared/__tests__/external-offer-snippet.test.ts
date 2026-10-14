import { describe, it, expect } from 'vitest';
import {
  buildExternalOfferSnippet,
  externalOfferRef,
  externalPageOf,
  isSellerPageUrl,
} from '../external-offer-snippet.js';

describe('buildExternalOfferSnippet', () => {
  // Byte for byte what the dashboard's "Copiar HTML" produced for a real test page on 2026-10-12.
  it('matches the markup of the dashboard generator', () => {
    const offerRef = externalOfferRef(
      'upsell',
      'be3ddcd0-993c-5980-8ce8-cfcddde199f1',
      '8536af28-729d-4a7d-b543-f64fe3f7e585',
      '4e0686ec-eabd-58e1-b9ae-1be743f367c1',
    );
    const html = buildExternalOfferSnippet({
      offerRef,
      flow: {
        acceptLabel: 'Sim, eu aceito essa oferta especial!',
        declineLabel: 'Não, eu gostaria de recusar essa oferta',
        buttonColor: '#22C55E',
      },
      appUrl: 'http://localhost:3000/',
    });

    expect(html).toBe([
      '<div data-gg-offer="upsell:be3ddcd0-993c-5980-8ce8-cfcddde199f1:8536af28-729d-4a7d-b543-f64fe3f7e585:4e0686ec-eabd-58e1-b9ae-1be743f367c1" style="text-align:center">',
      '  <button type="button" data-gg-accept style="display:block;width:100%;max-width:480px;margin:0 auto;padding:16px 32px;border:none;border-radius:8px;background-color:#22C55E;color:#ffffff;font-family:inherit;font-size:18px;font-weight:700;line-height:1.3;cursor:pointer;box-shadow:0 4px 14px rgba(0, 0, 0, 0.15)">Sim, eu aceito essa oferta especial!</button>',
      '  <a href="#" data-gg-decline style="display:inline-block;margin-top:16px;color:#6b7280;font-size:14px;font-family:inherit;text-decoration:underline">Não, eu gostaria de recusar essa oferta</a>',
      '</div>',
      '<script src="http://localhost:3000/embed/upsell.js?v=1" async></script>',
    ].join('\n'));
  });

  it('puts dark text on a light button', () => {
    const html = buildExternalOfferSnippet({
      offerRef: 'upsell:a:b:c',
      flow: { acceptLabel: 'Sim', declineLabel: 'Não', buttonColor: '#FACC15' },
      appUrl: 'https://app.test',
    });
    expect(html).toContain('background-color:#FACC15;color:#000000');
  });
});

describe('the seller page of one offered product (the API rule)', () => {
  const page = {
    pageUrl: 'https://seller.example/oferta',
    acceptLabel: 'Sim',
    declineLabel: 'Não',
    buttonColor: '#22C55E',
  };

  it('is external only with displayMode external AND a valid page', () => {
    expect(externalPageOf({ displayMode: 'external', externalFlow: page })).toEqual(page);
    expect(externalPageOf({ externalFlow: page })).toBeNull();
    expect(externalPageOf({ displayMode: 'native', externalFlow: page })).toBeNull();
    expect(externalPageOf({ displayMode: 'external' })).toBeNull();
    expect(externalPageOf(undefined)).toBeNull();
  });

  it('refuses the old routing shape and broken fields', () => {
    const old = { onAccept: { kind: 'thank_you' }, onDecline: { kind: 'thank_you' }, acceptLabel: 'Sim', declineLabel: 'Não', buttonColor: '#22C55E' };
    expect(externalPageOf({ displayMode: 'external', externalFlow: old })).toBeNull();
    expect(externalPageOf({ displayMode: 'external', externalFlow: { ...page, acceptLabel: ' ' } })).toBeNull();
    expect(externalPageOf({ displayMode: 'external', externalFlow: { ...page, buttonColor: 'green' } })).toBeNull();
  });

  it('takes https pages, and http only for localhost', () => {
    expect(isSellerPageUrl('https://seller.example/oferta')).toBe(true);
    expect(isSellerPageUrl('http://localhost:5173/upsell.html')).toBe(true);
    expect(isSellerPageUrl('http://seller.example/oferta')).toBe(false);
    expect(isSellerPageUrl('javascript:alert(1)')).toBe(false);
    expect(isSellerPageUrl('/relative')).toBe(false);
    expect(isSellerPageUrl(`https://seller.example/${'a'.repeat(2048)}`)).toBe(false);
  });
});
