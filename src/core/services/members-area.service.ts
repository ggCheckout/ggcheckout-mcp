import type { AuthPort } from '../ports/auth.port.js';
import type { MembersAreaPort } from '../ports/members-area.port.js';
import type {
  MembersArea, Module, Section, Lesson, Class, Student,
  CreateMembersAreaInput, CreateModuleInput, CreateSectionInput,
  CreateLessonInput, CreateClassInput, AddStudentInput,
  UpdateStudentInput, ImportStudentsInput,
} from '../types/members-area.js';

export class MembersAreaService {
  constructor(
    private readonly port: MembersAreaPort,
    private readonly authPort: AuthPort,
  ) {}

  async list() {
    const ownerId = await this.authPort.getMyBusinessId();
    return this.port.listByOwner(ownerId);
  }

  async getById(areaId: string): Promise<MembersArea> { return this.port.getById(areaId); }
  async create(input: CreateMembersAreaInput) { return this.port.create(input); }
  async update(areaId: string, payload: any) { return this.port.update(areaId, payload); }
  async duplicate(sourceAreaId: string, newProductId: string, newName?: string) { return this.port.duplicate(sourceAreaId, newProductId, newName); }

  async listModules(areaId: string) { return this.port.listModules(areaId); }
  async createModule(areaId: string, input: CreateModuleInput) { return this.port.createModule(areaId, input); }
  async reorderModules(areaId: string, moduleIds: string[]) { return this.port.reorderModules(areaId, moduleIds); }

  async listSections(areaId: string, moduleId: string) { return this.port.listSections(areaId, moduleId); }
  async createSection(areaId: string, moduleId: string, input: CreateSectionInput) { return this.port.createSection(areaId, moduleId, input); }
  async reorderSections(areaId: string, moduleId: string, sectionIds: string[]) { return this.port.reorderSections(areaId, moduleId, sectionIds); }

  async listLessons(areaId: string, moduleId: string, sectionId: string) { return this.port.listLessons(areaId, moduleId, sectionId); }
  async createLesson(areaId: string, moduleId: string, sectionId: string, input: CreateLessonInput) { return this.port.createLesson(areaId, moduleId, sectionId, input); }
  async reorderLessons(areaId: string, moduleId: string, sectionId: string, lessonIds: string[]) { return this.port.reorderLessons(areaId, moduleId, sectionId, lessonIds); }

  async listClasses(areaId: string) { return this.port.listClasses(areaId); }
  async createClass(areaId: string, input: CreateClassInput) { return this.port.createClass(areaId, input); }

  async listStudents(areaId: string) { return this.port.listStudents(areaId); }
  async getStudent(areaId: string, studentId: string) { return this.port.getStudent(areaId, studentId); }
  async addStudent(areaId: string, input: AddStudentInput) { return this.port.addStudent(areaId, input); }
  async updateStudent(areaId: string, studentId: string, input: UpdateStudentInput) { return this.port.updateStudent(areaId, studentId, input); }
  async importStudents(areaId: string, input: ImportStudentsInput) { return this.port.importStudents(areaId, input); }
}
