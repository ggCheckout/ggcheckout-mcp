import type { MembersAreaPort } from '../../core/ports/members-area.port.js';
import type {
  MembersArea, Module, Section, Lesson, Class, Student,
  CreateMembersAreaInput, CreateModuleInput, CreateSectionInput,
  CreateLessonInput, CreateClassInput, AddStudentInput,
  UpdateStudentInput, ImportStudentsInput, ImportStudentsResult,
  LessonAttachment, AddLessonAttachmentInput, PdfLessonInput,
  UpdateModuleInput, UpdateSectionInput, UpdateLessonInput,
} from '../../core/types/members-area.js';
import { readFile } from 'node:fs/promises';
import { sanitizeStudent } from '../../shared/sanitizer.js';
import type { LocalFile } from '../../shared/local-file.js';
import type { HttpClient } from './http-client.js';
import { putToSignedUrl } from './signed-upload.js';

/** What a presign route answers: where to PUT the bytes, and the key that names them afterwards. */
type PresignResponse = { success: boolean; data: { uploadUrl: string; filePath: string } };

export class MembersAreaApiAdapter implements MembersAreaPort {
  constructor(private readonly http: HttpClient) {}

  async listByOwner(ownerId: string) {
    const data = await this.http.get<{ areas: Array<{ id: string; productId: string; name: string }> }>(
      `/api/members-area/by-owner?ownerId=${encodeURIComponent(ownerId)}`,
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

  // Editing and deleting the structure: the API answers `{ success, data }`.
  async updateModule(areaId: string, moduleId: string, input: UpdateModuleInput) {
    await this.http.patch(modulePath(areaId, moduleId), input);
  }

  async deleteModule(areaId: string, moduleId: string) {
    const res = await this.http.delete<{ success: boolean; data: { deleted: boolean; deletedSections: number; deletedLessons: number } }>(
      modulePath(areaId, moduleId),
    );
    return res.data;
  }

  async updateSection(areaId: string, moduleId: string, sectionId: string, input: UpdateSectionInput) {
    await this.http.patch(`${modulePath(areaId, moduleId)}/sections/${encodeURIComponent(sectionId)}`, input);
  }

  async deleteSection(areaId: string, moduleId: string, sectionId: string) {
    const res = await this.http.delete<{ success: boolean; data: { deleted: boolean; deletedLessons: number } }>(
      `${modulePath(areaId, moduleId)}/sections/${encodeURIComponent(sectionId)}`,
    );
    return res.data;
  }

  /** The body is the fields to change; the API rebuilds `content` from the stored lesson. */
  async updateLesson(areaId: string, moduleId: string, sectionId: string, lessonId: string, input: UpdateLessonInput) {
    const res = await this.http.patch<{ success: boolean; data: { id: string; updatedAt: string } }>(
      `${lessonPath(areaId, moduleId, sectionId)}/${encodeURIComponent(lessonId)}`, input,
    );
    return res.data;
  }

  async deleteLesson(areaId: string, moduleId: string, sectionId: string, lessonId: string) {
    const res = await this.http.delete<{ success: boolean; data: { deleted: boolean } }>(
      `${lessonPath(areaId, moduleId, sectionId)}/${encodeURIComponent(lessonId)}`,
    );
    return res.data;
  }

  /** The route the dashboard's PDF import uses: one `pdf` lesson per entry, appended in order. */
  async createPdfLessons(areaId: string, moduleId: string, sectionId: string, lessons: PdfLessonInput[]) {
    const data = await this.http.post<{ success: boolean; data: { count: number; lessons: Array<{ id: string; title: string; order: number }> } }>(
      `${lessonPath(areaId, moduleId, sectionId)}/bulk`, { lessons },
    );
    return data.data;
  }

  // Lesson attachments
  async listLessonAttachments(areaId: string, moduleId: string, sectionId: string, lessonId: string) {
    const data = await this.http.get<{ success: boolean; data: LessonAttachment[] }>(
      `${lessonPath(areaId, moduleId, sectionId)}/${encodeURIComponent(lessonId)}/attachments`,
    );
    return data.data ?? [];
  }

  async addLessonAttachment(areaId: string, moduleId: string, sectionId: string, lessonId: string, input: AddLessonAttachmentInput) {
    const data = await this.http.post<{ success: boolean; data: LessonAttachment }>(
      `${lessonPath(areaId, moduleId, sectionId)}/${encodeURIComponent(lessonId)}/attachments`, input,
    );
    return data.data;
  }

  async deleteLessonAttachment(areaId: string, moduleId: string, sectionId: string, lessonId: string, attachmentId: string) {
    await this.http.delete(
      `${lessonPath(areaId, moduleId, sectionId)}/${encodeURIComponent(lessonId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  }

  // Uploads

  /**
   * Images go through the API (it resizes them before storing), as a multipart form. The answer is
   * the app-relative `/api/r2-proxy/...` URL the dashboard stores for logos, banners and covers.
   */
  async uploadImage(file: LocalFile, preset?: 'banner') {
    const form = new FormData();
    form.append('file', new Blob([await readFile(file.path)], { type: file.fileType }), file.fileName);
    if (preset) form.append('preset', preset);
    const data = await this.http.postForm<{ success: boolean; url: string; path: string }>('/api/uploads-r2', form);
    return { url: data.url };
  }

  /** The lesson video upload of the dashboard: presign, PUT the bytes to storage, confirm. */
  async uploadVideo(file: LocalFile) {
    const meta = { fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize };
    const presign = await this.http.post<PresignResponse>('/api/video/presigned-upload', meta);
    await putToSignedUrl(presign.data.uploadUrl, file);
    const done = await this.http.post<{ success: boolean; data: { url: string; filePath: string } }>(
      '/api/video/complete-upload', { ...meta, filePath: presign.data.filePath },
    );
    return { url: done.data.url, filePath: done.data.filePath };
  }

  /**
   * A members-area file (PDF, document, audio…): presign under the area, PUT, confirm. The confirm
   * checks the stored bytes against the declared type and only then hands out a serve URL — the
   * signed one when there is one, as the dashboard does.
   */
  async uploadAreaFile(areaId: string, file: LocalFile) {
    const meta = { fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize };
    const presign = await this.http.post<PresignResponse>(
      `/api/members-area/${encodeURIComponent(areaId)}/attachments/presigned-upload`, meta,
    );
    await putToSignedUrl(presign.data.uploadUrl, file);
    const done = await this.http.post<{ success: boolean; data: { url?: string; publicUrl?: string; filePath: string } }>(
      `/api/members-area/${encodeURIComponent(areaId)}/attachments/complete-upload`, { filePath: presign.data.filePath },
    );
    return { url: done.data.url || done.data.publicUrl || '', filePath: done.data.filePath };
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

function modulePath(areaId: string, moduleId: string): string {
  return `/api/members-area/${encodeURIComponent(areaId)}/modules/${encodeURIComponent(moduleId)}`;
}

function lessonPath(areaId: string, moduleId: string, sectionId: string): string {
  return `${modulePath(areaId, moduleId)}/sections/${encodeURIComponent(sectionId)}/lessons`;
}
