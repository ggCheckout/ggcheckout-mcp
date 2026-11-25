import { describe, expect, it } from 'vitest';
import { composeOffer } from './offer-payload.js';

describe('downsell routing overrides', () => {
  const routing = { triggerUpsellProductId: 'up', afterDownsell: 'continue_upsells' };
  const override = { price: 1200, displayMode: 'external', externalFlow: { pageUrl: 'https://example.test' }, ...routing };
  const base = { productOverrides: { down: override, other: { price: 500 } } };

  it('creates routing beside the charged price, never at the document root', () => {
    const doc = composeOffer('downsell', 'down', {}, { price: 1200, ...routing });
    expect(doc.productOverrides).toEqual({ down: { price: 1200, ...routing } });
    expect(doc).not.toHaveProperty('triggerUpsellProductId');
    expect(doc).not.toHaveProperty('afterDownsell');
  });

  it('updates routing alone while preserving price, external page and other overrides', () => {
    const stored = { productOverrides: { down: { ...override, afterDownsell: undefined }, other: { price: 500 } } };
    const doc = composeOffer('downsell', 'down', stored, { afterDownsell: 'continue_upsells' });
    expect(doc.productOverrides).toEqual(base.productOverrides);
    expect(stored.productOverrides.down.afterDownsell).toBeUndefined();
  });

  it('clears explicit defaults without mutating the stored override', () => {
    const doc = composeOffer('downsell', 'down', base, { triggerUpsellProductId: null, afterDownsell: 'end' });
    expect(doc.productOverrides).toEqual({ down: { price: 1200, displayMode: 'external', externalFlow: override.externalFlow }, other: { price: 500 } });
    expect(base.productOverrides.down).toEqual(override);
  });

  it('keeps omitted routing on an unrelated update', () => {
    expect(composeOffer('downsell', 'down', base, { price: 1500 }).productOverrides)
      .toEqual({ ...base.productOverrides, down: { ...override, price: 1500 } });
  });

  it('does not add downsell routing to upsells', () => {
    const doc = composeOffer('upsell', 'up', {}, { price: 1200, ...routing });
    expect(doc.productOverrides).toEqual({ up: { price: 1200 } });
    expect(doc).not.toHaveProperty('triggerUpsellProductId');
    expect(doc).not.toHaveProperty('afterDownsell');
  });
});
