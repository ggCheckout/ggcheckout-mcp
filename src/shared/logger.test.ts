import { describe, it, expect, vi } from 'vitest';
import { info, warn, error } from './logger.js';

describe('Logger', () => {
  it('info writes to stderr (not stdout — MCP uses stdout for protocol)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    info('TEST', 'hello');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('[INFO]');
    expect(spy.mock.calls[0][0]).toContain('[TEST]');
    expect(spy.mock.calls[0][0]).toContain('hello');
    spy.mockRestore();
  });

  it('warn writes to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warn('OP', 'warning msg');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('[WARN]');
    spy.mockRestore();
  });

  it('error writes to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('OP', 'error msg');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('[ERROR]');
    spy.mockRestore();
  });
});
