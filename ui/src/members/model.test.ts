import { describe, expect, it } from 'vitest';
import {
  formatDuration, releaseLine, summarizeArea, summarizeCarousels, summarizeLessons, summarizeModules, typeLabel,
} from './model';

// QA on 2026-11-10 (trimmed).
const qaArea = {
  id: '9p5m', name: 'MCP E2E Members Area', enabled: true,
  stats: { activeStudents: 0, avgCompletion: 0, totalClasses: 2, totalLessons: 1, totalModules: 1, totalSections: 1, totalStudents: 0 },
};
const qaModule = { areaId: '9p5m', id: 'ZuRm', title: 'MCP E2E Module', order: 0, locked: false, dripSettings: null, stats: { totalDuration: 0, totalLessons: 1, totalSections: 1 } };
const qaSection = { id: 'kFCK', moduleId: 'ZuRm', title: 'MCP E2E Section', order: 0, locked: false, dripSettings: null, stats: { totalDuration: 0, totalLessons: 1 } };
const qaLesson = { id: 'cKGP', sectionId: 'kFCK', title: 'MCP E2E Lesson', type: 'text', order: 0, locked: false, duration: 0 };

describe('members', () => {
  it('reads the area with the screen names of its counts', () => {
    expect(summarizeArea({ area: qaArea })).toMatchObject({ name: 'MCP E2E Members Area', carousels: 1, modules: 1, lessons: 1, students: 0 });
  });

  it('reads carousels, modules and lessons in order', () => {
    const carousels = summarizeCarousels({ modules: [{ ...qaModule, id: 'b', order: 1 }, qaModule] })!;
    expect(carousels.map((c) => c.id)).toEqual(['ZuRm', 'b']);
    expect(carousels[0]).toMatchObject({ title: 'MCP E2E Module', modules: 1, lessons: 1, release: 'Liberado' });
    expect(summarizeModules({ sections: [qaSection] })![0]).toMatchObject({ title: 'MCP E2E Section', lessons: 1 });
    expect(summarizeLessons({ lessons: [qaLesson, { ...qaLesson, id: 'v', type: 'video', order: -1, duration: 750 }] })!.map((l) => l.id)).toEqual(['v', 'cKGP']);
  });

  it('words the release as the screen does', () => {
    expect(releaseLine(true, null)).toBe('Bloqueado');
    expect(releaseLine(false, { enabled: true, daysAfterPurchase: 0 })).toBe('Liberado');
    expect(releaseLine(false, { enabled: true, daysAfterPurchase: 1 })).toBe('Libera 1 dia após a compra');
    expect(releaseLine(false, { enabled: true, daysAfterPurchase: 7, referenceDate: 'first_access' })).toBe('Libera 7 dias após o primeiro acesso');
  });

  it('formats type, duration and counts', () => {
    expect(typeLabel('quiz')).toBe('Questionário');
    expect(typeLabel(null)).toBe('Aula');
    expect(summarizeLessons({ lessons: [{ ...qaLesson, type: 'webinar' }] })![0].type).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(750)).toBe('12min 30s');
    expect(formatDuration(600)).toBe('10min');
  });

  it('ignores other payloads', () => {
    expect(summarizeArea({ areas: [] })).toBeNull();
    expect(summarizeCarousels({ upsells: [] })).toBeNull();
    expect(summarizeModules({ modules: [] })).toBeNull();
    expect(summarizeLessons({ sections: [] })).toBeNull();
  });
});
