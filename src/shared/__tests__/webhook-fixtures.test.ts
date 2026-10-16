import { describe, it, expect } from 'vitest';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENTS_WITHOUT_EMITTER,
  TESTABLE_WEBHOOK_EVENTS,
  webhookFixtures,
} from '../webhook-fixtures.js';

describe('webhookFixtures', () => {
  it('has an entry for every event it claims to simulate', () => {
    for (const event of TESTABLE_WEBHOOK_EVENTS) {
      expect(webhookFixtures[event], `missing fixture for ${event}`).toBeDefined();
    }
  });

  // The vocabulary is wider than what can be simulated: only payment-shaped events have a body
  // here. Promising a fixture for a subscription or quiz event would mean inventing its shape.
  it('only simulates events that are in the real vocabulary', () => {
    for (const event of TESTABLE_WEBHOOK_EVENTS) {
      expect(WEBHOOK_EVENTS).toContain(event);
    }
  });

  // The old list was `payment.*`, which is the internal vocabulary between services. A webhook
  // registered for those names is accepted and never fires.
  it('does not offer any payment.* name', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(event.startsWith('payment.')).toBe(false);
    }
  });

  it('never suggests simulating an event nothing dispatches', () => {
    for (const dead of WEBHOOK_EVENTS_WITHOUT_EMITTER) {
      expect(TESTABLE_WEBHOOK_EVENTS).not.toContain(dead as never);
    }
  });

  it('every fixture has required top-level fields', () => {
    for (const event of TESTABLE_WEBHOOK_EVENTS) {
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
