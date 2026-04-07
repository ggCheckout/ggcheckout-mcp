export type LessonType = 'video' | 'text' | 'pdf' | 'quiz' | 'file';
export type StudentStatus = 'active' | 'inactive' | 'blocked';

export interface ModuleDripSettings {
  enabled: boolean;
  daysAfterPurchase: number;
  referenceDate: 'purchase' | 'enrollment' | 'first_access';
}

export interface MembersAreaSettings {
  allowCertificates?: boolean;
  minCompletionPercentage?: number;
  allowComments?: boolean;
  moderateComments?: boolean;
  progressiveAccess?: boolean;
  allowDownloads?: boolean;
  timezone?: string;
}

export interface MembersAreaStats {
  totalStudents: number;
  totalModules: number;
  totalLessons: number;
  totalDuration: number;
  avgCompletion: number;
  activeStudents: number;
}

export interface MembersArea {
  id: string;
  name: string;
  description?: string;
  productId: string;
  ownerId: string;
  enabled?: boolean;
  purchaseCheckoutId?: string;
  customDomainId?: string | null;
  customization: any;
  settings: MembersAreaSettings;
  stats: MembersAreaStats;
  internalShop?: {
    enabled: boolean;
    selectedProducts: string[];
    productLinks: Record<string, string>;
    productOriginalPrices?: Record<string, number>;
    productButtonTexts?: Record<string, string>;
    bannerUrl?: string;
    buttonText?: string;
    carouselTitle?: string;
    displayMode?: string;
  };
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  areaId: string;
  title: string;
  description: string;
  imageUrl?: string;
  order: number;
  thumbnail?: string;
  duration?: string;
  locked: boolean;
  prerequisiteModuleIds: string[];
  dripSettings?: ModuleDripSettings;
  stats: { totalSections: number; totalLessons: number; totalDuration: number };
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  order: number;
  locked: boolean;
  prerequisiteSectionIds?: string[];
  dripSettings?: ModuleDripSettings;
  stats: { totalLessons: number; totalDuration: number };
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  sectionId: string;
  moduleId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  type: LessonType;
  order: number;
  locked: boolean;
  prerequisiteLessonIds?: string[];
  allowDownload: boolean;
  duration?: number;
  content?: any;
  stats: { totalViews: number; avgWatchPercentage: number; totalComments: number; totalCompletions: number };
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  studentIds?: string[];
  studentsCount?: number;
  capacityMax?: number;
  isDefault: boolean;
  stats: { totalStudents: number; avgCompletion: number; totalOffers: number };
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  email: string;
  name: string;
  authUid: string;
  classId: string;
  avatarUrl?: string;
  purchaseDate: string;
  enrolledDate: string;
  firstAccess?: boolean;
  status: StudentStatus;
  progress?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMembersAreaInput {
  name: string;
  productId: string;
  settings?: Partial<MembersAreaSettings>;
}

export interface CreateModuleInput {
  title: string;
  description?: string;
  imageUrl?: string;
  dripSettings?: ModuleDripSettings;
}

export interface CreateSectionInput {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  order?: number;
  dripSettings?: ModuleDripSettings;
}

export interface CreateLessonInput {
  title: string;
  description?: string;
  type: LessonType;
  order?: number;
  duration?: number;
  content?: any;
  thumbnailUrl?: string;
  videoUrl?: string;
}

export interface CreateClassInput {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  capacityMax?: number;
  isDefault?: boolean;
}

export interface AddStudentInput {
  name: string;
  email: string;
  classId?: string;
  sendWelcomeEmail?: boolean;
}

export interface UpdateStudentInput {
  name?: string;
  email?: string;
  classId?: string;
  status?: StudentStatus;
  avatarUrl?: string;
}

export interface ImportStudentsInput {
  students: Array<{ name?: string; email: string; phone?: string }>;
  classId?: string;
}

export interface ImportStudentsResult {
  total: number;
  success: number;
  errors: number;
  emailsSent: number;
}
