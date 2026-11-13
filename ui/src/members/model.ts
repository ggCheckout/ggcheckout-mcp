// Turns the members area tools into the content tree the members view draws, worded as the seller's
// content screen (saas components/members-area/owner/ModulesTab). The API's names and the screen's
// differ: an API module is a "carrossel" and an API section a "módulo". get_members_area is the area
// with its numbers, list_modules the carousels, list_sections one carousel's modules and list_lessons
// one module's lessons. Pure.

import { type Payload, count, isPayload, text } from '../lib/payload';

const byOrder = (a: Payload, b: Payload) => count(a.order) - count(b.order);

export interface Area {
  id: string;
  name: string;
  enabled: boolean;
  students: number;
  activeStudents: number;
  /** Average completion, 0..100. */
  avgCompletion: number;
  carousels: number;
  modules: number;
  lessons: number;
}

/** get_members_area `{ area }`; null for anything else. */
export function summarizeArea(data: unknown): Area | null {
  if (!isPayload(data) || !isPayload(data.area) || typeof data.area.name !== 'string') return null;
  const a = data.area;
  const stats = isPayload(a.stats) ? a.stats : {};
  return {
    id: String(a.id ?? ''),
    name: a.name,
    enabled: a.enabled !== false,
    students: count(stats.totalStudents),
    activeStudents: count(stats.activeStudents),
    avgCompletion: count(stats.avgCompletion),
    carousels: count(stats.totalModules),
    modules: count(stats.totalSections),
    lessons: count(stats.totalLessons),
  };
}

/** The release line of the screen (releaseLabel.ts): locked, available on purchase or after N days. */
export function releaseLine(locked: boolean, drip: unknown): string {
  if (locked) return 'Bloqueado';
  const d = isPayload(drip) ? drip : null;
  const days = count(d?.daysAfterPurchase);
  if (!d?.enabled || days <= 0) return 'Liberado';
  const reference = d.referenceDate === 'enrollment' ? 'a matrícula' : d.referenceDate === 'first_access' ? 'o primeiro acesso' : 'a compra';
  return `Libera ${days === 1 ? '1 dia' : `${days} dias`} após ${reference}`;
}

export interface Carousel {
  id: string;
  title: string;
  locked: boolean;
  release: string;
  modules: number;
  lessons: number;
}

/** list_modules `{ modules }`; null for anything else. */
export function summarizeCarousels(data: unknown): Carousel[] | null {
  if (!isPayload(data) || !Array.isArray(data.modules)) return null;
  return data.modules.filter(isPayload).sort(byOrder).map((m) => {
    const stats = isPayload(m.stats) ? m.stats : {};
    return {
      id: String(m.id ?? ''),
      title: text(m.title) ?? 'Carrossel',
      locked: m.locked === true,
      release: releaseLine(m.locked === true, m.dripSettings),
      modules: count(stats.totalSections),
      lessons: count(stats.totalLessons),
    };
  });
}

export interface Module {
  id: string;
  title: string;
  locked: boolean;
  release: string;
  lessons: number;
}

/** list_sections `{ sections }`; null for anything else. */
export function summarizeModules(data: unknown): Module[] | null {
  if (!isPayload(data) || !Array.isArray(data.sections)) return null;
  return data.sections.filter(isPayload).sort(byOrder).map((s) => ({
    id: String(s.id ?? ''),
    title: text(s.title) ?? 'Módulo',
    locked: s.locked === true,
    release: releaseLine(s.locked === true, s.dripSettings),
    lessons: count(isPayload(s.stats) ? s.stats.totalLessons : 0),
  }));
}

export type LessonType = 'video' | 'text' | 'file' | 'pdf' | 'quiz';

export interface Lesson {
  id: string;
  title: string;
  type: LessonType | null;
  locked: boolean;
  /** Seconds; 0 when not set. */
  duration: number;
}

const TYPES: Record<LessonType, string> = { video: 'Vídeo', text: 'Texto', file: 'Arquivo', pdf: 'PDF', quiz: 'Questionário' };

/** The content type as the screen names it. */
export function typeLabel(type: LessonType | null): string {
  return type ? TYPES[type] : 'Aula';
}

/** list_lessons `{ lessons }`; null for anything else. */
export function summarizeLessons(data: unknown): Lesson[] | null {
  if (!isPayload(data) || !Array.isArray(data.lessons)) return null;
  return data.lessons.filter(isPayload).sort(byOrder).map((l) => ({
    id: String(l.id ?? ''),
    title: text(l.title) ?? 'Aula',
    type: typeof l.type === 'string' && l.type in TYPES ? (l.type as LessonType) : null,
    locked: l.locked === true,
    duration: count(l.duration),
  }));
}

/** durationConverters.formatDuration: "12min 30s", "45s"; null when not set. */
export function formatDuration(seconds: number): string | null {
  if (seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return rest === 0 ? `${minutes}min` : `${minutes}min ${rest}s`;
}

