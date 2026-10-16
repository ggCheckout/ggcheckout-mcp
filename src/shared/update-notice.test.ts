import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkForUpdate, getUpdateNotice, isNewerVersion, resetUpdateNotice } from './update-notice.js';

vi.mock('./logger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

function registry(version: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, json: async () => ({ version }) }) as unknown as typeof fetch;
}

describe('isNewerVersion', () => {
  it('compares numerically, not as text', () => {
    expect(isNewerVersion('0.4.1', '0.4.0')).toBe(true);
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.99.99')).toBe(true);
  });

  it('is false for equal, older and unparseable versions', () => {
    expect(isNewerVersion('0.4.0', '0.4.0')).toBe(false);
    expect(isNewerVersion('0.3.9', '0.4.0')).toBe(false);
    expect(isNewerVersion('latest', '0.4.0')).toBe(false);
    expect(isNewerVersion('0.4.1', 'dev')).toBe(false);
  });
});

describe('checkForUpdate', () => {
  beforeEach(() => resetUpdateNotice());

  it('keeps a notice when the published version is newer', async () => {
    const fetchMock = registry('0.4.1');
    await checkForUpdate('0.4.0', fetchMock);

    expect(getUpdateNotice()).toContain('ggcheckout-mcp 0.4.1 is available (running 0.4.0)');
    expect(getUpdateNotice()).toContain('restart');
    const [url, init] = (fetchMock as any).mock.calls[0];
    expect(url).toBe('https://registry.npmjs.org/ggcheckout-mcp/latest');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('stays silent when the published version is equal or older', async () => {
    await checkForUpdate('0.4.0', registry('0.4.0'));
    expect(getUpdateNotice()).toBeUndefined();
    await checkForUpdate('0.4.0', registry('0.3.0'));
    expect(getUpdateNotice()).toBeUndefined();
  });

  it('stays silent on a bad answer', async () => {
    await checkForUpdate('0.4.0', registry(undefined));
    expect(getUpdateNotice()).toBeUndefined();
    await checkForUpdate('0.4.0', registry('9.9.9', false));
    expect(getUpdateNotice()).toBeUndefined();
  });

  it('stays silent and does not throw when the request fails or times out', async () => {
    await expect(
      checkForUpdate('0.4.0', vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    await expect(
      checkForUpdate('0.4.0', vi.fn().mockRejectedValue(timeout) as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    expect(getUpdateNotice()).toBeUndefined();
  });
});
