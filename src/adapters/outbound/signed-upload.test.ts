import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { default: { ...actual.default, put: vi.fn() } };
});
vi.mock('node:fs', () => ({ createReadStream: vi.fn(() => 'stream') }));

const axios = (await import('axios')).default;
const { putToSignedUrl } = await import('./signed-upload.js');
const { ApiError, NetworkError } = await import('../../shared/errors.js');

const file = { path: '/tmp/a.mp4', fileName: 'a.mp4', fileType: 'video/mp4', fileSize: 1234 };
const signedUrl = 'https://r2.example/videos/a.mp4?X-Amz-Signature=secret';

describe('putToSignedUrl', () => {
  beforeEach(() => {
    vi.mocked(axios.put).mockReset();
  });

  // The type and the length were signed; an Authorization header would break the signature.
  it('streams the file with its own type and length and no Authorization', async () => {
    vi.mocked(axios.put).mockResolvedValue({ status: 200 });

    await putToSignedUrl(signedUrl, file);

    const [url, body, config] = vi.mocked(axios.put).mock.calls[0];
    expect(url).toBe(signedUrl);
    expect(body).toBe('stream');
    expect(config?.headers).toEqual({ 'Content-Type': 'video/mp4', 'Content-Length': '1234' });
  });

  it('reports a refusal without the signed URL', async () => {
    vi.mocked(axios.put).mockRejectedValue(
      Object.assign(new Error(`Request failed ${signedUrl}`), { isAxiosError: true, response: { status: 403 } }),
    );

    const error = await putToSignedUrl(signedUrl, file).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('a.mp4');
    expect(error.message).not.toContain('secret');
    expect(error.cause).toBeUndefined();
  });

  it('reports a dropped connection as a network error', async () => {
    vi.mocked(axios.put).mockRejectedValue(Object.assign(new Error('socket hang up'), { isAxiosError: true }));

    await expect(putToSignedUrl(signedUrl, file)).rejects.toBeInstanceOf(NetworkError);
  });
});
