import { describe, it, expect, vi } from 'vitest';
import { info, warn, error } from './logger.js';

describe('Logger', () => {
  it('info writes JSON to stderr with correct fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    info('TEST', 'hello');
    expect(spy).toHaveBeenCalledOnce();
    const entry = JSON.parse(spy.mock.calls[0][0]);
    expect(entry.level).toBe('INFO');
    expect(entry.operation).toBe('TEST');
    expect(entry.message).toBe('hello');
    expect(entry.timestamp).toBeDefined();
    spy.mockRestore();
  });

  it('warn writes JSON to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warn('OP', 'warning msg');
    expect(spy).toHaveBeenCalledOnce();
    const entry = JSON.parse(spy.mock.calls[0][0]);
    expect(entry.level).toBe('WARN');
    expect(entry.message).toBe('warning msg');
    spy.mockRestore();
  });

  it('error writes JSON to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('OP', 'error msg');
    expect(spy).toHaveBeenCalledOnce();
    const entry = JSON.parse(spy.mock.calls[0][0]);
    expect(entry.level).toBe('ERROR');
    expect(entry.message).toBe('error msg');
    spy.mockRestore();
  });

  it('includes meta when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    info('TEST', 'with meta', { key: 'value' });
    const entry = JSON.parse(spy.mock.calls[0][0]);
    expect(entry.meta).toEqual({ key: 'value' });
    spy.mockRestore();
  });

  it('omits meta when not provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    info('TEST', 'no meta');
    const entry = JSON.parse(spy.mock.calls[0][0]);
    expect(entry.meta).toBeUndefined();
    spy.mockRestore();
  });
});
