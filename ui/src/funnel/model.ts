// Turns get_funnel_lead_stats and get_funnel_lead_analytics answers into what the funnel view draws,
// the way the funnel editor's Leads tab shows them (saas components/funnels/editor/LeadsTab and
// leads-tab/FunnelConversionViz). Rates arrive as integer percent points. Pure.

import { count, isPayload } from '../lib/payload';

export interface FunnelStats {
  visitors: number;
  leads: number;
  interactionRate: number;
  qualified: number;
  completed: number;
}

export interface ConversionStep {
  id: string;
  title: string;
  visitors: number;
  dropOffRate: number;
  /** Bar width in percent of the funnel's visitors, at least 4 so an empty step still shows. */
  width: number;
  /** Red for the worst drop-off, amber above 30%, green otherwise (FunnelConversionViz). */
  color: string;
}

export interface FunnelConversion {
  funnelTitle: string | null;
  steps: ConversionStep[];
  totalVisitors: number;
  conversionRate: number;
}

/** A get_funnel_lead_stats answer (`{ stats }`); null for anything else. */
export function summarizeFunnelStats(data: unknown): FunnelStats | null {
  if (!isPayload(data) || !isPayload(data.stats) || !('interactionRate' in data.stats)) return null;
  const s = data.stats;
  return {
    visitors: count(s.visitors),
    leads: count(s.leads),
    interactionRate: count(s.interactionRate),
    qualified: count(s.qualified),
    completed: count(s.completed),
  };
}

/** A get_funnel_lead_analytics answer; null for anything else. */
export function summarizeFunnelConversion(data: unknown): FunnelConversion | null {
  if (!isPayload(data) || !Array.isArray(data.steps) || !('overallConversionRate' in data)) return null;
  const rows = data.steps.filter(isPayload);
  const totalVisitors = count(data.totalVisitors);
  const max = totalVisitors || 1;
  const worst = rows.reduce<Record<string, unknown> | null>(
    (top, s) => (!top || count(s.dropOffRate) > count(top.dropOffRate) ? s : top),
    null,
  );
  return {
    funnelTitle: typeof data.funnelTitle === 'string' && data.funnelTitle ? data.funnelTitle : null,
    totalVisitors,
    conversionRate: count(data.overallConversionRate),
    steps: rows.map((s, index) => {
      const dropOffRate = count(s.dropOffRate);
      const visitors = count(s.visitors);
      return {
        id: String(s.stepId ?? index),
        title: typeof s.title === 'string' && s.title ? s.title : `Etapa ${index + 1}`,
        visitors,
        dropOffRate,
        width: Math.max((visitors / max) * 100, 4),
        color: s === worst && dropOffRate > 0 ? '#ef4444' : dropOffRate > 30 ? '#f59e0b' : '#22c55e',
      };
    }),
  };
}
