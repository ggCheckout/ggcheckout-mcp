import type { MembersAreaPort } from '../../core/ports/members-area.port.js';
import type {
  MembersArea, Module, Section, Lesson, Class, Student,
  CreateMembersAreaInput, CreateModuleInput, CreateSectionInput,
  CreateLessonInput, CreateClassInput, AddStudentInput,
  UpdateStudentInput, ImportStudentsInput, ImportStudentsResult,
} from '../../core/types/members-area.js';
import { sanitizeStudent } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

export class MembersAreaApiAdapter implements MembersAreaPort {
  constructor(private readonly http: HttpClient) {}

  async listByOwner(ownerId: string) {
    const data = await this.http.get<{ areas: Array<{ id: string; productId: string; name: string }> }>(
      `/api/members-area/by-owner?ownerId=${ownerId}`,
    );
    return data.areas;
  }

  async getById(areaId: string): Promise<MembersArea> {
    const data = await this.http.get<{ success: boolean; data: MembersArea }>(`/api/members-area/${areaId}`);
    return data.data;
  }

  async create(input: CreateMembersAreaInput): Promise<MembersArea> {
    const data = await this.http.post<{ success: boolean; data: MembersArea }>('/api/members-area/create-v2', input);
    return data.data;
  }

  async update(areaId: string, payload: any): Promise<void> {
    await this.http.patch(`/api/members-area/${areaId}`, payload);
  }

  async duplicate(sourceAreaId: string, newProductId: string, newName?: string) {
    const data = await this.http.post<{ success: boolean; newAreaId: string; stats: { modules: number; sections: number; lessons: number } }>(
      '/api/members-area/duplicate',
      { sourceAreaId, newProductId, newName },
    );
    return { newAreaId: data.newAreaId, stats: data.stats };
  }

  // Modules
  async listModules(areaId: string): Promise<Module[]> {
    const data = await this.http.get<{ success: boolean; data: Module[] }>(`/api/members-area/${areaId}/modules`);
    return data.data;
  }

  async createModule(areaId: string, input: CreateModuleInput) {
    const data = await this.http.post<{ success: boolean; data: { id: string } }>(`/api/members-area/${areaId}/modules`, input);
    return data.data;
  }

  async reorderModules(areaId: string, moduleIds: string[]) {
    const data = await this.http.post<{ success: boolean; data: { updated: number } }>(`/api/members-area/${areaId}/modules/reorder`, { moduleIds });
    return data.data;
  }

  // Sections
  async listSections(areaId: string, moduleId: string): Promise<Section[]> {
    const data = await this.http.get<{ success: boolean; data: Section[] }>(`/api/members-area/${areaId}/modules/${moduleId}/sections`);
    return data.data;
  }

  async createSection(areaId: string, moduleId: string, input: CreateSectionInput) {
    const data = await this.http.post<{ success: boolean; data: { id: string; title: string; moduleId: string; order: number } }>(
      `/api/members-area/${areaId}/modules/${moduleId}/sections`, input,
    );
    return data.data;
  }

  async reorderSections(areaId: string, moduleId: string, sectionIds: string[]) {
    const data = await this.http.post<{ success: boolean; data: { updated: number } }>(
      `/api/members-area/${areaId}/modules/${moduleId}/sections/reorder`, { sectionIds },
    );
    return data.data;
  }

  // Lessons
  async listLessons(areaId: string, moduleId: string, sectionId: string): Promise<Lesson[]> {
    const data = await this.http.get<{ success: boolean; data: Lesson[] }>(
      `/api/members-area/${areaId}/modules/${moduleId}/sections/${sectionId}/lessons`,
    );
    return data.data;
  }

  async createLesson(areaId: string, moduleId: string, sectionId: string, input: CreateLessonInput) {
    const data = await this.http.post<{ success: boolean; data: { id: string; title: string; sectionId: string; order: number } }>(
      `/api/members-area/${areaId}/modules/${moduleId}/sections/${sectionId}/lessons`, input,
    );
    return data.data;
  }

  async reorderLessons(areaId: string, moduleId: string, sectionId: string, lessonIds: string[]) {
    const data = await this.http.post<{ success: boolean; data: { updated: number } }>(
      `/api/members-area/${areaId}/modules/${moduleId}/sections/${sectionId}/lessons/reorder`, { lessonIds },
    );
    return data.data;
  }

  // Classes
  async listClasses(areaId: string): Promise<Class[]> {
    const data = await this.http.get<{ success: boolean; data: Class[] }>(`/api/members-area/${areaId}/classes`);
    return data.data;
  }

  async createClass(areaId: string, input: CreateClassInput): Promise<Class> {
    const data = await this.http.post<{ success: boolean; data: Class }>(`/api/members-area/${areaId}/classes`, input);
    return data.data;
  }

  // Students
  async listStudents(areaId: string): Promise<Student[]> {
    const data = await this.http.get<{ success: boolean; data: Student[] }>(`/api/members-area/${areaId}/students`);
    return data.data.map(sanitizeStudent);
  }

  async getStudent(areaId: string, studentId: string): Promise<Student> {
    const data = await this.http.get<{ success: boolean; data: Student }>(`/api/members-area/${areaId}/students/${studentId}`);
    return sanitizeStudent(data.data);
  }

  async addStudent(areaId: string, input: AddStudentInput) {
    const data = await this.http.post<{ success: boolean; data: { id: string; authUid: string; isExistingUser: boolean; emailSent: boolean } }>(
      `/api/members-area/${areaId}/students`, input,
    );
    return { id: data.data.id, authUid: data.data.authUid, emailSent: data.data.emailSent };
  }

  async updateStudent(areaId: string, studentId: string, input: UpdateStudentInput): Promise<void> {
    await this.http.patch(`/api/members-area/${areaId}/students/${studentId}`, input);
  }

  async importStudents(areaId: string, input: ImportStudentsInput) {
    const data = await this.http.post<{ success: boolean; summary: ImportStudentsResult; results: any[] }>(
      `/api/members-area/${areaId}/students/import`, input,
    );
    return { summary: data.summary, results: data.results };
  }
}
