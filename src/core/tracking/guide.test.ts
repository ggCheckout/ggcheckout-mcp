import { describe, expect, it } from 'vitest';
import { explainTracking, GUIDE_PROBLEMS, GUIDE_SECTIONS } from './guide.js';

const TOPICS = ['paths', 'initiate_checkout', 'purchase', 'utms', 'dedup', 'funnel', 'store', 'errors'] as const;

describe('explainTracking', () => {
  it('has one section per topic', () => {
    expect(GUIDE_SECTIONS.map((s) => s.id)).toEqual([...TOPICS]);
  });

  it('answers the whole guide without a topic', () => {
    const guide = explainTracking();
    expect(guide.topic).toBeNull();
    expect(guide.sections).toHaveLength(TOPICS.length);
    expect(guide.problems).toHaveLength(GUIDE_PROBLEMS.length);
  });

  it('keeps one section and the problems that touch the topic', () => {
    const guide = explainTracking('utms');
    expect(guide.topic).toBe('utms');
    expect(guide.sections.map((s) => s.id)).toEqual(['utms']);
    expect(guide.problems.length).toBeGreaterThan(0);
    expect(guide.problems.every((p) => !('topics' in p))).toBe(true);
    expect(guide.problems.map((p) => p.symptom)).toContain('A venda chegou sem UTMs');
  });

  it('has something to say for every topic', () => {
    for (const topic of TOPICS) {
      const { sections, problems } = explainTracking(topic);
      expect(sections[0].items.length, topic).toBeGreaterThan(0);
      expect(problems.length, topic).toBeGreaterThan(0);
    }
  });

  it('writes no em or en dashes', () => {
    expect(JSON.stringify(explainTracking())).not.toMatch(/[–—]/);
  });
});
