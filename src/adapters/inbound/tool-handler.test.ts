import { describe, it, expect, vi, afterEach } from 'vitest';
import { createToolHandler } from './tool-handler.js';
import { observeVersionHeaders, resetUpdateNotice } from '../../shared/update-notice.js';

vi.mock('../../shared/logger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

describe('createToolHandler', () => {
  it('returns structured success response', async () => {
    const handler = createToolHandler('test_tool', async () => ({ items: [1, 2, 3] }));
    const result = await handler({});

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ items: [1, 2, 3] });
    expect(result.structuredContent).toEqual({ items: [1, 2, 3] });
  });

  it('returns error response on failure', async () => {
    const handler = createToolHandler('test_tool', async () => {
      throw new Error('Something went wrong');
    });
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: Something went wrong');
    expect(result.structuredContent).toBeUndefined();
  });

  it('passes args to handler', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true });
    const handler = createToolHandler('test_tool', spy);
    await handler({ productId: 'abc' });

    expect(spy).toHaveBeenCalledWith({ productId: 'abc' });
  });

  describe('update notice', () => {
    afterEach(() => resetUpdateNotice());

    const behind = () =>
      observeVersionHeaders((n) => ({ 'x-gg-mcp-latest': '0.5.0', 'x-gg-mcp-update': 'u' } as Record<string, string>)[n], '0.4.0');

    it('adds a short update line to a success while the install is behind', async () => {
      behind();
      const result = await createToolHandler('test_tool', async () => ({ ok: true }))({});

      expect(result.content).toHaveLength(2);
      expect(JSON.parse(result.content[0].text)).toEqual({ ok: true });
      expect(result.content[1].text).toMatch(/^update: ggcheckout-mcp 0\.5\.0 is available \(running 0\.4\.0\)/);
      expect(result.content[1].text).toContain('`npx -y ggcheckout-mcp@latest`');
      expect(result.structuredContent).toEqual({ ok: true });
    });

    it('adds it to an error too', async () => {
      behind();
      const result = await createToolHandler('test_tool', async () => { throw new Error('boom'); })({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: boom');
      expect(result.content[1].text).toContain('0.5.0 is available');
    });

    it('adds nothing when the install is current', async () => {
      const result = await createToolHandler('test_tool', async () => ({ ok: true }))({});
      expect(result.content).toHaveLength(1);
    });
  });
});
