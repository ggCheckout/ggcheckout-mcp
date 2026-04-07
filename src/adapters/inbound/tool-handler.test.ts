import { describe, it, expect, vi } from 'vitest';
import { createToolHandler } from './tool-handler.js';

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
});
