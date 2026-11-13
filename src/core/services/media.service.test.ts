import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaService } from './media.service.js';

describe('MediaService', () => {
  it('refuses every upload while no upload folder is set', async () => {
    const port = { uploadImage: vi.fn() };

    await expect(new MediaService(port).uploadImage({ localPath: '/x/a.png' })).rejects.toThrow(/GGCHECKOUT_UPLOAD_ROOT/);
    expect(port.uploadImage).not.toHaveBeenCalled();
  });

  it('refuses a file that is not an image', async () => {
    const root = await mkdtemp(join(tmpdir(), 'media-'));
    await writeFile(join(root, 'a.pdf'), 'x');
    const port = { uploadImage: vi.fn() };

    await expect(new MediaService(port, root).uploadImage({ localPath: join(root, 'a.pdf') })).rejects.toThrow(/image upload accepts/);
    expect(port.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads an image inside the folder and answers url, path and what was sent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'media-'));
    await writeFile(join(root, 'a.png'), 'png-bytes');
    const port = { uploadImage: vi.fn().mockResolvedValue({ url: '/api/r2-proxy/u/a.webp', path: 'u/a.webp' }) };

    const result = await new MediaService(port, root).uploadImage({ localPath: join(root, 'a.png'), preset: 'banner' });

    expect(port.uploadImage).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'a.png', fileType: 'image/png', fileSize: 9 }), 'banner');
    expect(result).toEqual({ url: '/api/r2-proxy/u/a.webp', path: 'u/a.webp', fileName: 'a.png', fileType: 'image/png', fileSize: 9 });
  });
});
