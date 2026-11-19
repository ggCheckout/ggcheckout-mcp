import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./signed-upload.js', () => ({ putToSignedUrl: vi.fn() }));

const { MediaApiAdapter } = await import('./media.api.js');
const { putToSignedUrl } = await import('./signed-upload.js');

const file = { path: '/i/a.png', fileName: 'a.png', fileType: 'image/png', fileSize: 5 };

describe('MediaApiAdapter', () => {
  const http = { post: vi.fn() } as any;
  const adapter = new MediaApiAdapter(http);

  beforeEach(() => {
    http.post.mockReset();
    vi.mocked(putToSignedUrl).mockReset();
  });

  it('presigns, PUTs to storage, then confirms by filePath and answers url and path', async () => {
    http.post
      .mockResolvedValueOnce({ uploadUrl: 'https://r2/put', filePath: 'uploads/u/a.png', expiresIn: 600 })
      .mockResolvedValueOnce({ success: true, url: '/api/r2-proxy/uploads/u/a.webp', path: 'uploads/u/a.webp' });

    const result = await adapter.uploadImage(file);

    expect(http.post).toHaveBeenNthCalledWith(1, '/api/uploads-r2/presigned-upload', {
      fileName: 'a.png', contentType: 'image/png', size: 5,
    });
    expect(putToSignedUrl).toHaveBeenCalledWith('https://r2/put', file, undefined);
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/uploads-r2/complete-upload', { filePath: 'uploads/u/a.png' });
    expect(result).toEqual({ url: '/api/r2-proxy/uploads/u/a.webp', path: 'uploads/u/a.webp' });
  });

  it('sends the headers the presign lists along with the bytes', async () => {
    http.post
      .mockResolvedValueOnce({ uploadUrl: 'https://r2/put', filePath: 'k', headers: { 'Cache-Control': 'x' } })
      .mockResolvedValueOnce({ success: true, url: '/api/r2-proxy/k', path: 'k' });

    await adapter.uploadImage(file);

    expect(putToSignedUrl).toHaveBeenCalledWith('https://r2/put', file, { 'Cache-Control': 'x' });
  });

  it('never confirms an image whose bytes did not reach storage', async () => {
    http.post.mockResolvedValueOnce({ uploadUrl: 'https://r2/put', filePath: 'k' });
    vi.mocked(putToSignedUrl).mockRejectedValue(new Error('refused'));

    await expect(adapter.uploadImage(file)).rejects.toThrow('refused');
    expect(http.post).toHaveBeenCalledTimes(1);
  });
});
