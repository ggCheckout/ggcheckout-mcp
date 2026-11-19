// Turns calculate_rewards / redeem_reward into what the rewards view draws, following the dashboard's
// rewards trail (saas components/roadmap: RewardsRoadmap, ProgressHeader, RewardsTrail) and its
// stops (lib/rewards-redeem.ts). Amounts here are REAIS, as the tool answers them. Pure.

import { isPayload } from '../lib/payload';

export type StopKind = 'community' | 'whatsapp_group' | 'physical';

export interface StopConfig {
  /** The redeem id; the community stop has none. */
  rewardId: string | null;
  title: string;
  targetReais: number;
  kind: StopKind;
  art: 'community' | 'network-group' | 'bracelet' | 'plaque-50k' | 'plaque-100k' | 'plaque-500k' | 'plaque-1m';
  description: string;
}

const PLAQUE = 'Acrílico maciço com o seu marco gravado, entregue no seu endereço.';

/** REWARDS_REDEEM_CONFIG and RewardsRoadmap's copy, with the community stop first, as the trail shows it. */
export const STOPS: StopConfig[] = [
  { rewardId: null, title: 'Comunidade ggCheckout', targetReais: 0, kind: 'community', art: 'community', description: 'WhatsApp e Discord abertos, com gente vendendo todo dia. Você já tem acesso.' },
  { rewardId: 'whatsapp_group_5000', title: 'Grupo Network WhatsApp', targetReais: 5000, kind: 'whatsapp_group', art: 'network-group', description: 'Sala fechada no WhatsApp com os outros sellers da plataforma.' },
  { rewardId: 'bracelet_10000', title: 'Pulseira ggCheckout', targetReais: 10000, kind: 'physical', art: 'bracelet', description: 'Peça de identidade da comunidade, entregue no seu endereço.' },
  { rewardId: 'plaque_50000', title: 'Placa R$ 50K', targetReais: 50000, kind: 'physical', art: 'plaque-50k', description: PLAQUE },
  { rewardId: 'plaque_100000', title: 'Placa R$ 100K', targetReais: 100000, kind: 'physical', art: 'plaque-100k', description: PLAQUE },
  { rewardId: 'plaque_500000', title: 'Placa R$ 500K', targetReais: 500000, kind: 'physical', art: 'plaque-500k', description: PLAQUE },
  { rewardId: 'plaque_1000000', title: 'Placa R$ 1M', targetReais: 1000000, kind: 'physical', art: 'plaque-1m', description: 'A última parada. Acrílico maciço, entregue no seu endereço.' },
];

export type StopState = 'unlocked' | 'current' | 'locked';

export interface Stop extends StopConfig {
  state: StopState;
  /** What is still missing to reach it, in reais; 0 once unlocked. */
  missingReais: number;
  /** 0-100 toward this stop, for the current one. */
  percent: number;
}

export interface Rewards {
  revenueReais: number;
  completed: number;
  total: number;
  stops: Stop[];
  next: Stop | null;
}

const pct = (revenue: number, target: number) => (target > 0 ? Math.min(100, Math.round((revenue / target) * 100)) : 100);

/** calculate_rewards; null for anything else. The milestones the answer lists decide the stops. */
export function summarizeRewards(data: unknown): Rewards | null {
  if (!isPayload(data) || typeof data.currentRevenue !== 'number' || !Array.isArray(data.milestones)) return null;
  const revenue = data.currentRevenue;
  const targets = new Set(data.milestones.filter((m: unknown): m is number => typeof m === 'number'));
  const configs = STOPS.filter((s) => s.kind === 'community' || targets.has(s.targetReais));
  let currentSeen = false;
  const stops = configs.map((c): Stop => {
    if (revenue >= c.targetReais) return { ...c, state: 'unlocked', missingReais: 0, percent: 100 };
    const state: StopState = currentSeen ? 'locked' : 'current';
    currentSeen = true;
    return { ...c, state, missingReais: c.targetReais - revenue, percent: pct(revenue, c.targetReais) };
  });
  const milestones = stops.filter((s) => s.kind !== 'community');
  return {
    revenueReais: revenue,
    completed: typeof data.completedGoals === 'number' ? data.completedGoals : milestones.filter((s) => s.state === 'unlocked').length,
    total: typeof data.totalGoals === 'number' ? data.totalGoals : milestones.length,
    stops,
    next: stops.find((s) => s.state === 'current') ?? null,
  };
}

/** redeem_reward: `{ success, redeemType, redirectUrl, ... }`; null for anything else. */
export function summarizeRedeem(data: unknown): { redirectUrl: string | null } | null {
  if (!isPayload(data) || !('redeemType' in data || 'redirectUrl' in data)) return null;
  return { redirectUrl: typeof data.redirectUrl === 'string' && /^https:\/\//.test(data.redirectUrl) ? data.redirectUrl : null };
}

/** formatRewardCurrency: BRL with no cents. */
export function formatReais(reais: number): string {
  return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

/** The header's number, without the "R$" (drawn apart, smaller). */
export function formatAmount(reais: number): string {
  return Math.floor(reais).toLocaleString('pt-BR');
}
