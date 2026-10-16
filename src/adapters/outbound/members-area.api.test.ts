import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./signed-upload.js', () => ({ putToSignedUrl: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn(async () => Buffer.from('png bytes')) }));

const { MembersAreaApiAdapter } = await import('./members-area.api.js');
const { putToSignedUrl } = await import('./signed-upload.js');
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

const lessons = '/api/members-area/a1/modules/m1/sections/s1/lessons';

describe('MembersAreaApiAdapter', () => {
  let http: ReturnType<typeof createMockHttp>;
  let adapter: InstanceType<typeof MembersAreaApiAdapter>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new MembersAreaApiAdapter(http);
    vi.mocked(putToSignedUrl).mockReset();
  });

  it('uploadVideo presigns, sends the bytes to storage, then confirms', async () => {
    const file = { path: '/v/aula.mp4', fileName: 'aula.mp4', fileType: 'video/mp4', fileSize: 10 };
    vi.mocked(http.post)
      .mockResolvedValueOnce({ success: true, data: { uploadUrl: 'https://r2/put', filePath: 'videos/u/a.mp4' } })
      .mockResolvedValueOnce({ success: true, data: { url: 'https://app/api/r2-proxy/videos/u/a.mp4', filePath: 'videos/u/a.mp4' } });

    const result = await adapter.uploadVideo(file);

    expect(http.post).toHaveBeenNthCalledWith(1, '/api/video/presigned-upload', {
      fileName: 'aula.mp4', fileType: 'video/mp4', fileSize: 10,
    });
    expect(putToSignedUrl).toHaveBeenCalledWith('https://r2/put', file);
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/video/complete-upload', {
      fileName: 'aula.mp4', fileType: 'video/mp4', fileSize: 10, filePath: 'videos/u/a.mp4',
    });
    expect(result).toEqual({ url: 'https://app/api/r2-proxy/videos/u/a.mp4', filePath: 'videos/u/a.mp4' });
  });

  it('uploadVideo never confirms a file whose bytes did not reach storage', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ success: true, data: { uploadUrl: 'https://r2/put', filePath: 'k' } });
    vi.mocked(putToSignedUrl).mockRejectedValue(new Error('refused'));

    await expect(adapter.uploadVideo({ path: '/v.mp4', fileName: 'v.mp4', fileType: 'video/mp4', fileSize: 1 }))
      .rejects.toThrow('refused');
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('uploadAreaFile presigns under the area and keeps the storage key', async () => {
    const file = { path: '/f/apostila.pdf', fileName: 'apostila.pdf', fileType: 'application/pdf', fileSize: 20 };
    vi.mocked(http.post)
      .mockResolvedValueOnce({ success: true, data: { uploadUrl: 'https://r2/put', filePath: 'deliverables/u/members-area-a1/x.pdf' } })
      .mockResolvedValueOnce({ success: true, data: { url: 'https://r2/get?sig', publicUrl: '', filePath: 'deliverables/u/members-area-a1/x.pdf' } });

    const result = await adapter.uploadAreaFile('a1', file);

    expect(http.post).toHaveBeenNthCalledWith(1, '/api/members-area/a1/attachments/presigned-upload', {
      fileName: 'apostila.pdf', fileType: 'application/pdf', fileSize: 20,
    });
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/members-area/a1/attachments/complete-upload', {
      filePath: 'deliverables/u/members-area-a1/x.pdf',
    });
    expect(result).toEqual({ url: 'https://r2/get?sig', filePath: 'deliverables/u/members-area-a1/x.pdf' });
  });

  it('uploadImage sends a multipart form with the file and the preset', async () => {
    vi.mocked(http.postForm).mockResolvedValue({ success: true, url: '/api/r2-proxy/uploads/u/logo.webp', path: 'p' });

    const result = await adapter.uploadImage(
      { path: '/i/logo.png', fileName: 'logo.png', fileType: 'image/png', fileSize: 9 },
      'banner',
    );

    const [url, form] = vi.mocked(http.postForm).mock.calls[0] as [string, FormData];
    expect(url).toBe('/api/uploads-r2');
    expect((form.get('file') as File).name).toBe('logo.png');
    expect((form.get('file') as File).type).toBe('image/png');
    expect(form.get('preset')).toBe('banner');
    expect(result).toEqual({ url: '/api/r2-proxy/uploads/u/logo.webp' });
  });

  it('createPdfLessons posts the batch to lessons/bulk', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, data: { count: 1, lessons: [{ id: 'l1', title: 'A', order: 1 }] } });
    const batch = [{ title: 'A', fileUrl: 'https://r2/a.pdf', fileName: 'a.pdf' }];

    expect(await adapter.createPdfLessons('a1', 'm1', 's1', batch)).toEqual({ count: 1, lessons: [{ id: 'l1', title: 'A', order: 1 }] });
    expect(http.post).toHaveBeenCalledWith(`${lessons}/bulk`, { lessons: batch });
  });

  // These only existed as server actions; the API key reaches them through PATCH/DELETE routes.
  it('edits and deletes modules, sections and lessons on their own paths', async () => {
    vi.mocked(http.patch).mockResolvedValue({ success: true, data: { id: 'l1', updatedAt: 't' } });
    vi.mocked(http.delete)
      .mockResolvedValueOnce({ success: true, data: { deleted: true, deletedSections: 1, deletedLessons: 3 } })
      .mockResolvedValueOnce({ success: true, data: { deleted: true, deletedLessons: 2 } })
      .mockResolvedValueOnce({ success: true, data: { deleted: true } });

    await adapter.updateModule('a1', 'm1', { title: 'M', dripSettings: null });
    await adapter.updateSection('a1', 'm1', 's1', { thumbnailUrl: '' });
    expect(await adapter.updateLesson('a1', 'm1', 's1', 'l1', { title: 'L' })).toEqual({ id: 'l1', updatedAt: 't' });
    expect(await adapter.deleteModule('a1', 'm1')).toEqual({ deleted: true, deletedSections: 1, deletedLessons: 3 });
    expect(await adapter.deleteSection('a1', 'm1', 's1')).toEqual({ deleted: true, deletedLessons: 2 });
    expect(await adapter.deleteLesson('a1', 'm1', 's1', 'l1')).toEqual({ deleted: true });

    expect(http.patch).toHaveBeenNthCalledWith(1, '/api/members-area/a1/modules/m1', { title: 'M', dripSettings: null });
    expect(http.patch).toHaveBeenNthCalledWith(2, '/api/members-area/a1/modules/m1/sections/s1', { thumbnailUrl: '' });
    expect(http.patch).toHaveBeenNthCalledWith(3, `${lessons}/l1`, { title: 'L' });
    expect(http.delete).toHaveBeenNthCalledWith(1, '/api/members-area/a1/modules/m1');
    expect(http.delete).toHaveBeenNthCalledWith(2, '/api/members-area/a1/modules/m1/sections/s1');
    expect(http.delete).toHaveBeenNthCalledWith(3, `${lessons}/l1`);
  });

  it('lesson attachments are listed, added and deleted under the lesson', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, data: [{ id: 'at1' }] });
    vi.mocked(http.post).mockResolvedValue({ success: true, data: { id: 'at2' } });
    const input = { name: 'Apostila', url: 'https://r2/a.pdf', mime: 'application/pdf', sizeBytes: 5, filePath: 'k' };

    expect(await adapter.listLessonAttachments('a1', 'm1', 's1', 'l1')).toEqual([{ id: 'at1' }]);
    expect(await adapter.addLessonAttachment('a1', 'm1', 's1', 'l1', input)).toEqual({ id: 'at2' });
    await adapter.deleteLessonAttachment('a1', 'm1', 's1', 'l1', 'at2');

    expect(http.get).toHaveBeenCalledWith(`${lessons}/l1/attachments`);
    expect(http.post).toHaveBeenCalledWith(`${lessons}/l1/attachments`, input);
    expect(http.delete).toHaveBeenCalledWith(`${lessons}/l1/attachments/at2`);
  });
});
