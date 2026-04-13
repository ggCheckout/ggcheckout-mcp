import { describe, it, expect } from 'vitest';
import { WEBHOOK_EVENTS, webhookFixtures } from '../webhook-fixtures.js';

describe('webhookFixtures', () => {
  it('has an entry for every supported event', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(webhookFixtures[event], `missing fixture for ${event}`).toBeDefined();
    }
  });

  it('every fixture has required top-level fields', () => {
    for (const event of WEBHOOK_EVENTS) {
      const fixture = webhookFixtures[event];
      expect(fixture.event).toBe(event);
      expect(typeof fixture.payment.id).toBe('string');
      expect(typeof fixture.payment.status).toBe('string');
      expect(typeof fixture.payment.method).toBe('string');
      expect(typeof fixture.payment.amount).toBe('number');
      expect(fixture.payment.customer).toBeDefined();
      expect(fixture.product).toBeDefined();
    }
  });
});
