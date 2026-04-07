import { describe, it, expect, vi, beforeEach } from 'vitest';
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
