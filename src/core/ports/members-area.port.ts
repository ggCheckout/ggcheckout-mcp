import type {
  MembersArea, Module, Section, Lesson, Class, Student,
  CreateMembersAreaInput, CreateModuleInput, CreateSectionInput,
  CreateLessonInput, CreateClassInput, AddStudentInput,
  UpdateStudentInput, ImportStudentsInput, ImportStudentsResult,
  LessonAttachment, AddLessonAttachmentInput, PdfLessonInput,
} from '../types/members-area.js';
import type { LocalFile } from '../../shared/local-file.js';

export interface MembersAreaPort {
  listByOwner(ownerId: string): Promise<Array<{ id: string; productId: string; name: string }>>;
  getById(areaId: string): Promise<MembersArea>;
  create(input: CreateMembersAreaInput): Promise<MembersArea>;
  update(areaId: string, payload: any): Promise<void>;
  duplicate(sourceAreaId: string, newProductId: string, newName?: string): Promise<{ newAreaId: string; stats: { modules: number; sections: number; lessons: number } }>;

  listModules(areaId: string): Promise<Module[]>;
  createModule(areaId: string, input: CreateModuleInput): Promise<{ id: string }>;
  reorderModules(areaId: string, moduleIds: string[]): Promise<{ updated: number }>;

  listSections(areaId: string, moduleId: string): Promise<Section[]>;
  createSection(areaId: string, moduleId: string, input: CreateSectionInput): Promise<{ id: string; title: string; moduleId: string; order: number }>;
  reorderSections(areaId: string, moduleId: string, sectionIds: string[]): Promise<{ updated: number }>;

  listLessons(areaId: string, moduleId: string, sectionId: string): Promise<Lesson[]>;
  createLesson(areaId: string, moduleId: string, sectionId: string, input: CreateLessonInput): Promise<{ id: string; title: string; sectionId: string; order: number }>;
  reorderLessons(areaId: string, moduleId: string, sectionId: string, lessonIds: string[]): Promise<{ updated: number }>;
  createPdfLessons(areaId: string, moduleId: string, sectionId: string, lessons: PdfLessonInput[]): Promise<{ count: number; lessons: Array<{ id: string; title: string; order: number }> }>;

  listLessonAttachments(areaId: string, moduleId: string, sectionId: string, lessonId: string): Promise<LessonAttachment[]>;
  addLessonAttachment(areaId: string, moduleId: string, sectionId: string, lessonId: string, input: AddLessonAttachmentInput): Promise<LessonAttachment>;
  deleteLessonAttachment(areaId: string, moduleId: string, sectionId: string, lessonId: string, attachmentId: string): Promise<void>;

  uploadImage(file: LocalFile, preset?: 'banner'): Promise<{ url: string }>;
  uploadVideo(file: LocalFile): Promise<{ url: string; filePath: string }>;
  uploadAreaFile(areaId: string, file: LocalFile): Promise<{ url: string; filePath: string }>;

  listClasses(areaId: string): Promise<Class[]>;
  createClass(areaId: string, input: CreateClassInput): Promise<Class>;

  listStudents(areaId: string): Promise<Student[]>;
  getStudent(areaId: string, studentId: string): Promise<Student>;
  addStudent(areaId: string, input: AddStudentInput): Promise<{ id: string; authUid: string; emailSent: boolean }>;
  updateStudent(areaId: string, studentId: string, input: UpdateStudentInput): Promise<void>;
  importStudents(areaId: string, input: ImportStudentsInput): Promise<{ summary: ImportStudentsResult; results: any[] }>;
}
