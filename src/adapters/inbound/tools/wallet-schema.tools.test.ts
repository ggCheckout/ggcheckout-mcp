import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCheckoutTools } from './checkout.tools.js';
import { registerStoreTools } from './store.tools.js';

vi.mock('../../../shared/logger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const UUID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

function shapeOf(register: (s: McpServer) => void, tool: string) {
  const server = new McpServer({ name: 't', version: '0' });
  register(server);
  const schema = (server as any)._registeredTools[tool].inputSchema;
  return z.object(schema.shape ?? schema).shape;
}

describe('wallet schemas', () => {
  const checkout = (tool: string) => shapeOf((s) => registerCheckoutTools(s, {} as any), tool);

  it.each(['create_checkout', 'update_checkout'])('%s refuses a non-uuid routeId', (tool) => {
    const pm = checkout(tool).paymentMethods;
    expect(pm.safeParse({ pix: { routeId: UUID } }).success).toBe(true);
    expect(pm.safeParse({ pix: { routeId: 'not-a-uuid' } }).success).toBe(false);
    expect(pm.safeParse({ credit_card: { routeId: 'not-a-uuid' } }).success).toBe(false);
  });

  it.each(['create_checkout', 'update_checkout'])('%s takes paypal and refuses an unknown method instead of dropping it', (tool) => {
    const pm = checkout(tool).paymentMethods;
    expect(pm.safeParse({ paypal: { token: 'tok', type: 'paypal' } }).success).toBe(true);
    expect(pm.safeParse({ paypal: null }).success).toBe(true);
    expect(pm.safeParse({ paypal: { token: 'tok', type: 'stripe' } }).success).toBe(false);
    expect(pm.safeParse({ pix: { routeId: UUID }, boleto: { token: 't' } }).success).toBe(false);
  });

  it('update_store refuses the 0.4.x gateways list instead of dropping it', () => {
    const pm = shapeOf((s) => registerStoreTools(s, {} as any), 'update_store').paymentMethods;
    expect(pm.safeParse({ pix: { enabled: true } }).success).toBe(true);
    const r = pm.safeParse({ pix: { enabled: true, gateways: ['tok'] } });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toContain('paymentRouteId');
  });

  it.each([
    [{ pix: { enabled: true }, bank_slip: { enabled: false } }, 'bank_slip'],
    [{ pix: { enabled: true }, creditCard: { enabled: true } }, 'creditCard'],
  ])('update_store refuses an unknown method next to a valid one instead of dropping it (%#)', (body, key) => {
    const pm = shapeOf((s) => registerStoreTools(s, {} as any), 'update_store').paymentMethods;
    const r = pm.safeParse(body);
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toContain(key);
    expect(pm.safeParse({ pix: { enabled: true }, credit_card: { enabled: false } }).success).toBe(true);
  });

  it('update_store accepts paymentRouteId null and refuses a non-uuid', () => {
    const f = shapeOf((s) => registerStoreTools(s, {} as any), 'update_store').paymentRouteId;
    expect(f.safeParse(null).success).toBe(true);
    expect(f.safeParse(UUID).success).toBe(true);
    expect(f.safeParse('nope').success).toBe(false);
  });
});
