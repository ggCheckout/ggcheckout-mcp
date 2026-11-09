import { describe, expect, it } from 'vitest';
import { summarizeFunnelConversion, summarizeFunnelStats } from './model';

// The shape QA answered on 09/11/2026 (ids shortened, titles added by the server).
const analytics = {
  funnelTitle: 'Quiz de marketing',
  steps: [
    { stepId: 's1', title: 'Boas-vindas', visitors: 24, exits: 8, dropOffRate: 33 },
    { stepId: 's2', title: 'Aquisição', visitors: 17, exits: 0, dropOffRate: 0 },
    { stepId: 's3', title: '', visitors: 0, exits: 0, dropOffRate: 0 },
    { stepId: 's4', title: 'Etapa 10', visitors: 43, exits: 26, dropOffRate: 60 },
  ],
  totalVisitors: 95,
  totalCompleted: 18,
  overallConversionRate: 19,
};

describe('summarizeFunnelConversion', () => {
  it('colors the worst drop-off red, above 30% amber, the rest green, as FunnelConversionViz', () => {
    const c = summarizeFunnelConversion(analytics)!;
    expect(c.steps.map((s) => s.color)).toEqual(['#f59e0b', '#22c55e', '#22c55e', '#ef4444']);
    expect(c.conversionRate).toBe(19);
    expect(c.funnelTitle).toBe('Quiz de marketing');
  });

  it('sizes bars by the funnel visitors, never below 4%, and names an untitled step by its place', () => {
    const c = summarizeFunnelConversion(analytics)!;
    expect(c.steps[0].width).toBeCloseTo((24 / 95) * 100);
    expect(c.steps[2]).toMatchObject({ title: 'Etapa 3', width: 4 });
  });

  it('has no red step when nobody left', () => {
    const c = summarizeFunnelConversion({ ...analytics, steps: [{ stepId: 'a', visitors: 3, dropOffRate: 0 }] })!;
    expect(c.steps[0].color).toBe('#22c55e');
  });

  it('is null for another answer', () => {
    expect(summarizeFunnelConversion({ stats: {} })).toBeNull();
  });
});

describe('summarizeFunnelStats', () => {
  it('reads the stats envelope', () => {
    expect(summarizeFunnelStats({ stats: { completed: 18, interactionRate: 20, leads: 19, qualified: 18, visitors: 95 } }))
      .toEqual({ visitors: 95, leads: 19, interactionRate: 20, qualified: 18, completed: 18 });
    expect(summarizeFunnelStats(analytics)).toBeNull();
  });
});
