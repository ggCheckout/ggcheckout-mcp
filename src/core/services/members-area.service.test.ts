import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MembersAreaService } from './members-area.service.js';
import type { MembersAreaPort } from '../ports/members-area.port.js';
import type { AuthPort } from '../ports/auth.port.js';

describe('MembersAreaService', () => {
  let service: MembersAreaService;
  let mockPort: MembersAreaPort;
  let mockAuthPort: AuthPort;

  beforeEach(() => {
    mockPort = {
      listByOwner: vi.fn().mockResolvedValue([]),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      duplicate: vi.fn(),
      listModules: vi.fn(),
      createModule: vi.fn(),
      reorderModules: vi.fn(),
      listSections: vi.fn(),
      createSection: vi.fn(),
      reorderSections: vi.fn(),
      listLessons: vi.fn(),
      createLesson: vi.fn(),
      reorderLessons: vi.fn(),
      listClasses: vi.fn(),
      createClass: vi.fn(),
      listStudents: vi.fn(),
      getStudent: vi.fn(),
      addStudent: vi.fn(),
      updateStudent: vi.fn(),
      importStudents: vi.fn(),
      createPdfLessons: vi.fn(),
      updateModule: vi.fn(),
      deleteModule: vi.fn(),
      updateSection: vi.fn(),
      deleteSection: vi.fn(),
      updateLesson: vi.fn(),
      deleteLesson: vi.fn(),
      listLessonAttachments: vi.fn(),
      addLessonAttachment: vi.fn(),
      deleteLessonAttachment: vi.fn(),
      uploadImage: vi.fn().mockResolvedValue({ url: '/api/r2-proxy/uploads/u/logo.webp' }),
      uploadVideo: vi.fn().mockResolvedValue({ url: 'https://app/api/r2-proxy/videos/u/a.mp4', filePath: 'videos/u/a.mp4' }),
      uploadAreaFile: vi.fn().mockResolvedValue({ url: 'https://r2/get?sig', filePath: 'deliverables/u/x.pdf' }),
    };
    mockAuthPort = { getMyBusinessId: vi.fn().mockResolvedValue('owner-xyz') };
    service = new MembersAreaService(mockPort, mockAuthPort);
  });

  it('list fetches ownerId from authPort before calling port', async () => {
    await service.list();
    expect(mockAuthPort.getMyBusinessId).toHaveBeenCalled();
    expect(mockPort.listByOwner).toHaveBeenCalledWith('owner-xyz');
  });

  it('createLesson delegates all 4 path params correctly', async () => {
    vi.mocked(mockPort.createLesson).mockResolvedValue({ id: 'l1', title: 'Lesson', sectionId: 's1', order: 0 });
    await service.createLesson('area-1', 'mod-1', 'sec-1', { title: 'Lesson', type: 'video' } as any);
    expect(mockPort.createLesson).toHaveBeenCalledWith('area-1', 'mod-1', 'sec-1', { title: 'Lesson', type: 'video' });
  });

  it('reorderLessons delegates all 4 params', async () => {
    vi.mocked(mockPort.reorderLessons).mockResolvedValue({ updated: 3 });
    await service.reorderLessons('area-1', 'mod-1', 'sec-1', ['l1', 'l2', 'l3']);
    expect(mockPort.reorderLessons).toHaveBeenCalledWith('area-1', 'mod-1', 'sec-1', ['l1', 'l2', 'l3']);
  });

  it('importStudents passes input to port', async () => {
    vi.mocked(mockPort.importStudents).mockResolvedValue({
      summary: { total: 2, success: 2, errors: 0, emailsSent: 2 },
      results: [],
    });
    await service.importStudents('area-1', { students: [{ email: 'a@b.com' }] });
    expect(mockPort.importStudents).toHaveBeenCalledWith('area-1', { students: [{ email: 'a@b.com' }] });
  });
});

describe('MembersAreaService.uploadFile', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ggck-upload-'));
  writeFileSync(join(dir, 'logo.png'), 'png');
  writeFileSync(join(dir, 'aula.mp4'), 'mp4 bytes');
  writeFileSync(join(dir, 'apostila.pdf'), 'pdf');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const port = () => ({
    uploadImage: vi.fn().mockResolvedValue({ url: '/api/r2-proxy/uploads/u/logo.webp' }),
    uploadVideo: vi.fn().mockResolvedValue({ url: 'https://app/api/r2-proxy/videos/u/a.mp4', filePath: 'videos/u/a.mp4' }),
    uploadAreaFile: vi.fn().mockResolvedValue({ url: 'https://r2/get?sig', filePath: 'deliverables/u/x.pdf' }),
  });

  it('sends each kind to its own route and describes the file', async () => {
    const p = port();
    const service = new MembersAreaService(p as any, {} as any);

    expect(await service.uploadFile({ localPath: join(dir, 'logo.png'), kind: 'image', preset: 'banner' })).toEqual({
      kind: 'image', fileName: 'logo.png', fileType: 'image/png', fileSize: 3, url: '/api/r2-proxy/uploads/u/logo.webp',
    });
    expect(p.uploadImage).toHaveBeenCalledWith(expect.objectContaining({ fileType: 'image/png' }), 'banner');

    expect((await service.uploadFile({ localPath: join(dir, 'aula.mp4'), kind: 'video' })).filePath).toBe('videos/u/a.mp4');
    expect(p.uploadVideo).toHaveBeenCalledWith(expect.objectContaining({ fileType: 'video/mp4', fileSize: 9 }));

    const pdf = await service.uploadFile({ localPath: join(dir, 'apostila.pdf'), kind: 'file', areaId: 'a1' });
    expect(pdf).toMatchObject({ kind: 'file', fileType: 'application/pdf', url: 'https://r2/get?sig', filePath: 'deliverables/u/x.pdf' });
    expect(p.uploadAreaFile).toHaveBeenCalledWith('a1', expect.objectContaining({ fileName: 'apostila.pdf' }));
  });

  // A file is stored under its members area, so there is nowhere to put it without one.
  it('refuses a file upload without areaId before touching the disk or the API', async () => {
    const p = port();
    const service = new MembersAreaService(p as any, {} as any);

    await expect(service.uploadFile({ localPath: join(dir, 'apostila.pdf'), kind: 'file' })).rejects.toThrow(/areaId/);
    expect(p.uploadAreaFile).not.toHaveBeenCalled();
  });

  it('refuses a file of the wrong kind before uploading anything', async () => {
    const p = port();
    const service = new MembersAreaService(p as any, {} as any);

    await expect(service.uploadFile({ localPath: join(dir, 'apostila.pdf'), kind: 'video' })).rejects.toThrow(/\.mp4/);
    expect(p.uploadVideo).not.toHaveBeenCalled();
  });
});
